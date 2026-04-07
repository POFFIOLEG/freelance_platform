from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from jobs.models import Job
from .models import Message
from .serializers import MessageSerializer


class JobMessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        job_id = self.kwargs["job_id"]
        job = Job.objects.get(pk=job_id)
        if job.employer != self.request.user and job.assigned_to != self.request.user:
            return Message.objects.none()
        return Message.objects.filter(job=job)

    def post(self, request, *args, **kwargs):
        job = Job.objects.get(pk=self.kwargs["job_id"])
        if job.employer != request.user and job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Message.objects.create(
            job=job,
            sender=request.user,
            text=serializer.validated_data["text"],
        )
        return Response({"detail": "Сообщение отправлено"}, status=status.HTTP_201_CREATED)

