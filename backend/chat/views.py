"""Сообщения по заданию: список и создание (в т.ч. вложения); отдельный лимит на POST — chat_send."""
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle

from jobs.models import Job
from .models import Message, MessageAttachment
from .serializers import MessageSerializer

MAX_CHAT_ATTACHMENTS = 12
MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024

CHAT_CLOSED_DETAIL = (
    "Чат по этому заданию доступен только заказчику и текущему исполнителю, пока исполнитель назначен."
)


def _can_access_job_chat(job, user):
    """Переписка по сделке только при активном назначении (после снятия исполнителя — недоступна)."""
    if job.assigned_to_id is None:
        return False
    return user.id in (job.employer_id, job.assigned_to_id)


class JobMessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]

    def check_throttles(self, request):
        self.throttle_scope = "chat_send" if request.method == "POST" else None
        super().check_throttles(request)

    def get_queryset(self):
        job_id = self.kwargs["job_id"]
        job = get_object_or_404(Job, pk=job_id)
        if not _can_access_job_chat(job, self.request.user):
            return Message.objects.none()
        return (
            Message.objects.filter(job=job)
            .select_related("sender")
            .prefetch_related("attachment_files")
            .order_by("created_at")
        )

    def list(self, request, *args, **kwargs):
        job_id = self.kwargs["job_id"]
        job = get_object_or_404(Job, pk=job_id)
        if not _can_access_job_chat(job, request.user):
            return Response({"detail": CHAT_CLOSED_DETAIL}, status=status.HTTP_403_FORBIDDEN)
        qs = (
            Message.objects.filter(job=job)
            .select_related("sender")
            .prefetch_related("attachment_files")
            .order_by("created_at")
        )
        try:
            limit = min(int(request.query_params.get("limit", 100)), 200)
        except ValueError:
            limit = 100
        try:
            offset = max(int(request.query_params.get("offset", 0)), 0)
        except ValueError:
            offset = 0
        if request.query_params.get("paginate") != "1":
            rows = list(qs[:400])
            return Response(self.get_serializer(rows, many=True).data)
        total = qs.count()
        rows = list(qs[offset : offset + limit])
        return Response(
            {
                "results": self.get_serializer(rows, many=True).data,
                "total": total,
                "offset": offset,
                "limit": limit,
            },
        )

    def post(self, request, *args, **kwargs):
        job = get_object_or_404(Job, pk=self.kwargs["job_id"])
        if not _can_access_job_chat(job, request.user):
            return Response({"detail": CHAT_CLOSED_DETAIL}, status=status.HTTP_403_FORBIDDEN)

        text = (request.data.get("text") or "").strip()
        files = list(request.FILES.getlist("attachments"))
        if not files and request.FILES.get("attachment"):
            files = [request.FILES["attachment"]]
        files = files[:MAX_CHAT_ATTACHMENTS]
        for f in files:
            if getattr(f, "size", 0) > MAX_CHAT_FILE_BYTES:
                return Response(
                    {"detail": "Файл больше 10 МБ."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if not text and not files:
            return Response(
                {"detail": "Введите текст сообщения или прикрепите файл."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        msg = Message.objects.create(job=job, sender=request.user, text=text)
        for i, f in enumerate(files):
            MessageAttachment.objects.create(message=msg, file=f, sort_order=i)

        msg.refresh_from_db()
        return Response(
            MessageSerializer(msg, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
