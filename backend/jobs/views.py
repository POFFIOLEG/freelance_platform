from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from .models import Job, JobApplication, WorkSubmission, JobStatusUpdate
from .serializers import (
    JobSerializer,
    JobApplicationSerializer,
    WorkSubmissionSerializer,
    JobStatusUpdateSerializer,
)
from .permissions import IsEmployer, IsWorker, IsJobOwner


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all().select_related("employer", "assigned_to")
    serializer_class = JobSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.action in ["create"]:
            return [IsAuthenticated(), IsEmployer()]
        if self.action in ["update", "partial_update", "destroy", "assign", "set_status"]:
            return [IsAuthenticated(), IsEmployer()]
        if self.action in ["apply", "submit_result"]:
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
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)
        location = request.query_params.get("location")
        if location:
            qs = qs.filter(location__icontains=location)
        mine = request.query_params.get("mine")
        if mine and request.user.is_authenticated:
            qs = qs.filter(employer=request.user)
        assigned = request.query_params.get("assigned")
        if assigned and request.user.is_authenticated:
            qs = qs.filter(assigned_to=request.user)
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

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def dashboard(self, request):
        jobs_owned = JobSerializer(request.user.jobs.all(), many=True).data
        jobs_assigned = JobSerializer(
            request.user.assigned_jobs.all(),
            many=True,
        ).data
        return Response({"owned": jobs_owned, "assigned": jobs_assigned})

