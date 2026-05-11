from django.shortcuts import get_object_or_404
from django.db.models import Q
from decimal import Decimal
import random
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import Job, JobApplication, WorkSubmission, JobStatusUpdate, JobBid
from .serializers import (
    JobSerializer,
    JobApplicationSerializer,
    WorkSubmissionSerializer,
    JobStatusUpdateSerializer,
    JobBidSerializer,
)
from .permissions import IsEmployer, IsWorker, IsJobOwner


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all().select_related("employer", "assigned_to")
    serializer_class = JobSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action in ["create"]:
            return [IsAuthenticated(), IsEmployer()]
        if self.action in [
            "update",
            "partial_update",
            "destroy",
            "assign",
            "set_status",
            "approve_submission",
            "close_application",
            "pick_contest_winner",
        ]:
            return [IsAuthenticated(), IsEmployer()]
        if self.action in ["apply", "submit_result", "bid"]:
            return [IsAuthenticated(), IsWorker()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        request = self.request
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(title__icontains=q)
        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        budget_from = request.query_params.get("budget_from")
        if budget_from:
            try:
                qs = qs.filter(budget_max__gte=Decimal(budget_from))
            except (ValueError, ArithmeticError):
                pass
        budget_to = request.query_params.get("budget_to")
        if budget_to:
            try:
                qs = qs.filter(budget_min__lte=Decimal(budget_to))
            except (ValueError, ArithmeticError):
                pass
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)
        categories = request.query_params.get("categories")
        if categories:
            category_values = [item.strip() for item in categories.split(",") if item.strip()]
            if category_values:
                category_query = Q()
                for item in category_values:
                    category_query |= Q(category__iexact=item)
                qs = qs.filter(category_query)
        subcategory = request.query_params.get("subcategory")
        if subcategory:
            qs = qs.filter(subcategory__iexact=subcategory)
        subcategories = request.query_params.get("subcategories")
        if subcategories:
            subcategory_values = [item.strip() for item in subcategories.split(",") if item.strip()]
            if subcategory_values:
                subcategory_query = Q()
                for item in subcategory_values:
                    subcategory_query |= Q(subcategory__iexact=item)
                qs = qs.filter(subcategory_query)
        country = request.query_params.get("country")
        if country and country != "all":
            qs = qs.filter(country__iexact=country)
        city = request.query_params.get("city")
        if city and city != "all":
            qs = qs.filter(city__iexact=city)
        location = request.query_params.get("location")
        if location:
            qs = qs.filter(location__icontains=location)
        if request.query_params.get("urgent"):
            qs = qs.filter(is_urgent=True)
        if request.query_params.get("without_assignee"):
            qs = qs.filter(assigned_to__isnull=True)
        mine = request.query_params.get("mine")
        if mine and request.user.is_authenticated:
            qs = qs.filter(employer=request.user)
        assigned = request.query_params.get("assigned")
        if assigned and request.user.is_authenticated:
            qs = qs.filter(assigned_to=request.user)
        if request.query_params.get("contest"):
            qs = qs.filter(is_contest=True)
        if request.query_params.get("exchange"):
            qs = qs.filter(is_exchange=True)
        job_type = request.query_params.get("type")
        if job_type == "order":
            qs = qs.filter(is_contest=False, is_exchange=False)
        elif job_type == "contest":
            qs = qs.filter(is_contest=True)
        elif job_type == "exchange":
            qs = qs.filter(is_exchange=True)
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(employer=self.request.user)

    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        job = self.get_object()
        serializer = JobApplicationSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        JobApplication.objects.create(
            job=job,
            worker=request.user,
            cover_letter=serializer.validated_data.get("cover_letter", ""),
            expected_budget=serializer.validated_data.get("expected_budget", 0),
        )
        return Response({"detail": "Отклик отправлен"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"])
    def bid(self, request, pk=None):
        job = self.get_object()
        if not job.is_exchange:
            return Response({"detail": "Для этого задания торги не включены"}, status=status.HTTP_400_BAD_REQUEST)
        if request.method == "GET":
            if job.employer != request.user and job.assigned_to != request.user and request.user.role != "worker":
                return Response(status=status.HTTP_403_FORBIDDEN)
            serializer = JobBidSerializer(job.bids.select_related("worker"), many=True)
            return Response(serializer.data)
        serializer = JobBidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        bid, _ = JobBid.objects.update_or_create(
            job=job,
            worker=request.user,
            defaults={
                "amount": serializer.validated_data["amount"],
                "message": serializer.validated_data.get("message", ""),
            },
        )
        return Response(JobBidSerializer(bid).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def applications(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = JobApplicationSerializer(job.applications.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        application_id = request.data.get("application_id")
        application = get_object_or_404(JobApplication, pk=application_id, job=job)
        job.assigned_to = application.worker
        job.status = Job.Status.IN_PROGRESS
        job.save()
        application.status = JobApplication.Status.ACCEPTED
        application.save()
        return Response({"detail": "Исполнитель назначен"})

    @action(detail=True, methods=["post"])
    def submit_result(self, request, pk=None):
        job = self.get_object()
        if job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = WorkSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = WorkSubmission.objects.create(
            job=job,
            worker=request.user,
            message=serializer.validated_data["message"],
            deliverable_url=serializer.validated_data.get("deliverable_url", ""),
        )
        job.status = Job.Status.SUBMITTED
        job.save()
        JobStatusUpdate.objects.create(
            job=job,
            status=Job.Status.SUBMITTED,
            note="Исполнитель отправил результат",
            created_by=request.user,
        )
        return Response(
            WorkSubmissionSerializer(submission).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        status_value = request.data.get("status")
        if status_value not in Job.Status.values:
            return Response({"detail": "Неверный статус"}, status=status.HTTP_400_BAD_REQUEST)
        if job.status != status_value:
            job.status = status_value
            job.save()
            JobStatusUpdate.objects.create(
                job=job,
                status=status_value,
                note=request.data.get("note", ""),
                created_by=request.user,
            )
        return Response(JobSerializer(job).data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def updates(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user and job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = JobStatusUpdateSerializer(job.updates.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def submissions(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user and job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        queryset = job.submissions.select_related("worker")
        serializer = WorkSubmissionSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def approve_submission(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        submission_id = request.data.get("submission_id")
        submission = get_object_or_404(WorkSubmission, pk=submission_id, job=job)
        submission.status = WorkSubmission.Status.APPROVED
        submission.save(update_fields=["status"])
        job.status = Job.Status.COMPLETED
        job.save(update_fields=["status"])
        transfer_amount = job.budget_max or job.budget_min or Decimal("0")
        if transfer_amount and job.assigned_to:
            employer_profile = job.employer.profile
            worker_profile = job.assigned_to.profile
            if employer_profile.demo_balance >= transfer_amount:
                employer_profile.demo_balance -= transfer_amount
                worker_profile.demo_balance += transfer_amount
                employer_profile.save(update_fields=["demo_balance"])
                worker_profile.save(update_fields=["demo_balance"])
        JobStatusUpdate.objects.create(
            job=job,
            status=Job.Status.COMPLETED,
            note="Работа проверена и принята",
            created_by=request.user,
        )
        return Response({"detail": "Результат принят, задание завершено"})

    @action(detail=True, methods=["post"])
    def close_application(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        application_id = request.data.get("application_id")
        application = get_object_or_404(JobApplication, pk=application_id, job=job)
        application.status = JobApplication.Status.REJECTED
        application.save(update_fields=["status"])
        return Response({"detail": "Отклик закрыт"})

    @action(detail=True, methods=["post"])
    def pick_contest_winner(self, request, pk=None):
        job = self.get_object()
        if not job.is_contest:
            return Response({"detail": "Режим розыгрыша не включен"}, status=status.HTTP_400_BAD_REQUEST)
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        candidates = list(job.applications.filter(status=JobApplication.Status.SENT))
        if not candidates:
            return Response({"detail": "Нет кандидатов для розыгрыша"}, status=status.HTTP_400_BAD_REQUEST)
        winner_application = random.choice(candidates)
        job.assigned_to = winner_application.worker
        job.status = Job.Status.IN_PROGRESS
        job.save(update_fields=["assigned_to", "status"])
        winner_application.status = JobApplication.Status.ACCEPTED
        winner_application.save(update_fields=["status"])
        JobStatusUpdate.objects.create(
            job=job,
            status=Job.Status.IN_PROGRESS,
            note="Исполнитель выбран через розыгрыш",
            created_by=request.user,
        )
        return Response(
            {
                "detail": "Исполнитель выбран случайно",
                "winner": JobApplicationSerializer(winner_application).data,
            }
        )

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def dashboard(self, request):
        jobs_owned = JobSerializer(request.user.jobs.all(), many=True).data
        jobs_assigned = JobSerializer(
            request.user.assigned_jobs.all(),
            many=True,
        ).data
        return Response({"owned": jobs_owned, "assigned": jobs_assigned})

