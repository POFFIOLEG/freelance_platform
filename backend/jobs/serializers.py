from rest_framework import serializers

from accounts.serializers import UserSerializer
from .models import Job, JobApplication, WorkSubmission, JobStatusUpdate, JobBid


class JobSerializer(serializers.ModelSerializer):
    employer = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    applications_count = serializers.SerializerMethodField()
    submissions_count = serializers.SerializerMethodField()
    my_application_status = serializers.SerializerMethodField()

    def get_applications_count(self, obj):
        return obj.applications.count()

    def get_submissions_count(self, obj):
        return obj.submissions.count()

    def get_my_application_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if getattr(request.user, "role", None) != "worker":
            return None
        pref = getattr(obj, "_my_worker_application", None)
        if pref:
            return pref[0].status
        try:
            return (
                JobApplication.objects.only("status")
                .get(job=obj, worker=request.user)
                .status
            )
        except JobApplication.DoesNotExist:
            return None

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        elif isinstance(data, dict):
            data = dict(data)
        if isinstance(data, dict) and data.get("deadline") == "":
            data["deadline"] = None
        return super().to_internal_value(data)

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
            "completed_at",
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
            "my_application_status",
        ]
        read_only_fields = ["status", "employer", "assigned_to", "completed_at"]
        extra_kwargs = {
            "attachments": {"allow_blank": True, "required": False},
            "deadline": {"allow_null": True, "required": False},
        }


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

