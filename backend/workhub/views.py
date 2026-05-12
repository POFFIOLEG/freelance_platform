from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from accounts.models import Profile, User
from jobs.models import JobMilestone
from jobs.serializers import JobMilestoneSerializer

from .calendar_xlsx import build_calendar_xlsx_bytes
from .ics_calendar import build_calendar_ics
from .models import FeaturedSlot, JobReminder, JobTemplate, PushDevice, SavedSearch, UserJobFavorite
from .serializers import (
    FeaturedPurchaseSerializer,
    FeaturedSlotPublicSerializer,
    FreelancerCardSerializer,
    JobReminderSerializer,
    JobTemplateSerializer,
    PushDeviceSerializer,
    SavedSearchSerializer,
    UserJobFavoriteSerializer,
)


class FeaturedListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        slots = FeaturedSlot.objects.select_related("worker", "worker__profile").order_by("slot_index")
        ser = FeaturedSlotPublicSerializer(slots, many=True, context={"request": request})
        return Response(ser.data)


class FeaturedPurchaseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != User.Roles.WORKER:
            return Response(
                {"detail": "Платное размещение в блоке на главной доступно только исполнителям."},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = FeaturedPurchaseSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        idx = ser.validated_data["slot_index"]
        now = timezone.now()
        price = Decimal(str(FeaturedSlot.FEATURED_PRICE))
        period = timedelta(days=FeaturedSlot.PERIOD_DAYS)
        with transaction.atomic():
            slot = FeaturedSlot.objects.select_for_update().get(slot_index=idx)
            profile = Profile.objects.select_for_update().get(user=request.user)
            occupied = (
                slot.worker_id
                and slot.worker_id != request.user.id
                and slot.paid_until
                and slot.paid_until > now
            )
            if occupied:
                return Response(
                    {"detail": "Этот слот занят другим исполнителем до окончания оплаченного периода."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if profile.demo_balance < price:
                return Response(
                    {
                        "detail": (
                            "Недостаточно средств на демо-балансе. Стоимость размещения "
                            f"{int(FeaturedSlot.FEATURED_PRICE)} ₽ на {FeaturedSlot.PERIOD_DAYS} дней."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile.demo_balance -= price
            profile.save(update_fields=["demo_balance"])
            if slot.worker_id == request.user.id and slot.paid_until and slot.paid_until > now:
                base = slot.paid_until
            else:
                base = now
            slot.worker = request.user
            slot.paid_until = base + period
            slot.save(update_fields=["worker", "paid_until"])
        return Response(
            FeaturedSlotPublicSerializer(slot, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class SavedSearchViewSet(viewsets.ModelViewSet):
    serializer_class = SavedSearchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedSearch.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class UserJobFavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = UserJobFavoriteSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return UserJobFavorite.objects.filter(user=self.request.user).select_related(
            "job",
            "job__employer",
            "job__assigned_to",
        )

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "Это задание уже добавлено в избранное."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class JobTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = JobTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return JobTemplate.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class JobReminderViewSet(viewsets.ModelViewSet):
    serializer_class = JobReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        u = self.request.user
        return JobReminder.objects.filter(user=u).filter(
            Q(job__employer=u) | Q(job__assigned_to=u),
        )

    def perform_create(self, serializer):
        job = serializer.validated_data["job"]
        if job.employer != self.request.user and job.assigned_to != self.request.user:
            raise PermissionDenied("Вы не участвуете в этом задании.")
        serializer.save(user=self.request.user)


class CalendarAggregateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        jobs_q = Q(job__employer=u) | Q(job__assigned_to=u)
        milestones = JobMilestone.objects.filter(jobs_q).select_related("job").order_by("due_date", "id")
        reminders = JobReminder.objects.filter(user=u, dismissed=False).filter(jobs_q).select_related("job")
        return Response(
            {
                "milestones": JobMilestoneSerializer(milestones, many=True).data,
                "reminders": JobReminderSerializer(reminders, many=True).data,
            },
        )


class RecommendedWorkersView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        qs = (
            User.objects.filter(role=User.Roles.WORKER)
            .select_related("profile")
            .order_by("-profile__is_verified", "-date_joined")[:16]
        )
        return Response(FreelancerCardSerializer(qs, many=True, context={"request": request}).data)


class CalendarIcsExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        jobs_q = Q(job__employer=u) | Q(job__assigned_to=u)
        milestones = JobMilestone.objects.filter(jobs_q).select_related("job").order_by("due_date", "id")
        reminders = (
            JobReminder.objects.filter(user=u, dismissed=False)
            .filter(jobs_q)
            .select_related("job")
            .order_by("fire_at", "id")
        )
        body = build_calendar_ics(milestones=milestones, reminders=reminders)
        resp = HttpResponse(body, content_type="text/calendar; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="taskora-calendar.ics"'
        return resp


class CalendarXlsxExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        jobs_q = Q(job__employer=u) | Q(job__assigned_to=u)
        milestones = JobMilestone.objects.filter(jobs_q).select_related("job").order_by("due_date", "id")
        reminders = (
            JobReminder.objects.filter(user=u, dismissed=False)
            .filter(jobs_q)
            .select_related("job")
            .order_by("fire_at", "id")
        )
        raw = build_calendar_xlsx_bytes(milestones=milestones, reminders=reminders)
        resp = HttpResponse(
            raw,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        resp["Content-Disposition"] = 'attachment; filename="taskora-calendar.xlsx"'
        return resp


class PushDeviceViewSet(viewsets.ModelViewSet):
    serializer_class = PushDeviceSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]

    def check_throttles(self, request):
        self.throttle_scope = "push_register" if request.method == "POST" else None
        super().check_throttles(request)

    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return PushDevice.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            return Response(
                {"detail": "Это устройство уже зарегистрировано."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
