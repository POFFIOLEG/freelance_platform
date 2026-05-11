from rest_framework import serializers

from accounts.serializers import UserSerializer
from .models import Job, JobApplication, WorkSubmission, JobStatusUpdate, JobBid


class JobSerializer(serializers.ModelSerializer):
    employer = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    applications_count = serializers.IntegerField(
        source="applications.count",
        read_only=True,
    )
    submissions_count = serializers.IntegerField(
        source="submissions.count",
        read_only=True,
    )

    class Meta:
        model = Job
        fields = [
            "id",
            "title",
            "description",
            "category",
            "subcategory",
            "country",
            "city",
            "location",
            "budget_min",
            "budget_max",
            "deadline",
            "status",
            "skills_required",
            "attachments",
            "is_urgent",
            "is_contest",
            "is_exchange",
            "employer",
            "assigned_to",
            "applications_count",
            "created_at",
            "updated_at",
            "submissions_count",
        ]
        read_only_fields = ["status", "employer", "assigned_to"]


class JobApplicationSerializer(serializers.ModelSerializer):
    worker = UserSerializer(read_only=True)

    class Meta:
        model = JobApplication
        fields = [
            "id",
            "job",
            "worker",
            "cover_letter",
            "expected_budget",
            "status",
            "created_at",
        ]
        read_only_fields = ["status", "worker", "job"]
        extra_kwargs = {"job": {"required": False}}


class WorkSubmissionSerializer(serializers.ModelSerializer):
    worker = UserSerializer(read_only=True)
    deliverable_url = serializers.URLField(required=False, allow_blank=True)

    class Meta:
        model = WorkSubmission
        fields = [
            "id",
            "job",
            "worker",
            "message",
            "deliverable_url",
            "status",
            "created_at",
        ]
        read_only_fields = ["status", "worker", "job"]
        extra_kwargs = {"job": {"required": False}}


class JobStatusUpdateSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = JobStatusUpdate
        fields = ["id", "status", "note", "created_by", "created_at"]


class JobBidSerializer(serializers.ModelSerializer):
    worker = UserSerializer(read_only=True)

    class Meta:
        model = JobBid
        fields = ["id", "job", "worker", "amount", "message", "created_at"]
        read_only_fields = ["job", "worker", "created_at"]

