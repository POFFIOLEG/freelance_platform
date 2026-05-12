from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from accounts.serializers import UserSerializer
from .models import (
    Job,
    JobApplication,
    JobBid,
    JobDispute,
    JobMilestone,
    JobSpecRevision,
    WorkSubmission,
    JobStatusUpdate,
)


class JobSerializer(serializers.ModelSerializer):
    employer = UserSerializer(read_only=True)
    assigned_to = UserSerializer(read_only=True)
    applications_count = serializers.SerializerMethodField()
    submissions_count = serializers.SerializerMethodField()
    my_application_status = serializers.SerializerMethodField()
    my_latest_submission_status = serializers.SerializerMethodField()

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

    def get_my_latest_submission_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        if obj.assigned_to_id != request.user.id:
            return None
        latest = None
        for s in obj.submissions.all():
            if s.worker_id != request.user.id:
                continue
            if latest is None or s.created_at > latest.created_at:
                latest = s
        return latest.status if latest else None

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        elif isinstance(data, dict):
            data = dict(data)
        if isinstance(data, dict) and data.get("deadline") == "":
            data["deadline"] = None
        return super().to_internal_value(data)

    def validate(self, attrs):
        mn = attrs.get("budget_min")
        mx = attrs.get("budget_max")
        if mn is not None and mn < 0:
            raise serializers.ValidationError({"budget_min": "Бюджет не может быть отрицательным."})
        if mx is not None and mx < 0:
            raise serializers.ValidationError({"budget_max": "Бюджет не может быть отрицательным."})
        if mn is not None and mx is not None and mn > mx:
            raise serializers.ValidationError(
                {"budget_max": "Верхняя граница бюджета не может быть меньше нижней."},
            )
        if self.instance is None:
            title = (attrs.get("title") or "").strip()
            if not title:
                raise serializers.ValidationError({"title": "Укажите название задания."})
            desc = (attrs.get("description") or "").strip()
            if not desc:
                raise serializers.ValidationError({"description": "Укажите описание."})
            if not (attrs.get("category") or "").strip():
                raise serializers.ValidationError({"category": "Выберите категорию."})
            if not (attrs.get("subcategory") or "").strip():
                raise serializers.ValidationError({"subcategory": "Выберите подкатегорию."})
            if attrs.get("deadline") is None:
                raise serializers.ValidationError({"deadline": "Укажите срок сдачи."})
            if mn is None:
                raise serializers.ValidationError({"budget_min": "Укажите бюджет «от»."})
            if mx is None:
                raise serializers.ValidationError({"budget_max": "Укажите бюджет «до»."})

        dl = attrs.get("deadline")
        if dl is not None and dl < timezone.localdate():
            raise serializers.ValidationError(
                {"deadline": "Срок сдачи не может быть в прошлом."},
            )
        return attrs

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
            "my_latest_submission_status",
            "moderation_status",
            "moderation_note",
        ]
        read_only_fields = [
            "status",
            "employer",
            "assigned_to",
            "completed_at",
            "moderation_status",
            "moderation_note",
        ]
        extra_kwargs = {
            "attachments": {"allow_blank": True, "required": False},
            "deadline": {"allow_null": True, "required": False},
        }


class JobApplicationSerializer(serializers.ModelSerializer):
    worker = UserSerializer(read_only=True)

    def validate_expected_budget(self, value):
        if value is None:
            return Decimal("0")
        if value < 0:
            raise serializers.ValidationError("Ожидаемая сумма не может быть отрицательной.")
        return value

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
    deliverable_url = serializers.CharField(required=False, allow_blank=True)

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

    def validate_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Ставка не может быть отрицательной.")
        return value

    class Meta:
        model = JobBid
        fields = ["id", "job", "worker", "amount", "message", "created_at"]
        read_only_fields = ["job", "worker", "created_at"]


class JobMilestoneSerializer(serializers.ModelSerializer):
    def validate_amount(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Сумма этапа не может быть отрицательной.")
        return value

    class Meta:
        model = JobMilestone
        fields = [
            "id",
            "job",
            "title",
            "description",
            "due_date",
            "amount",
            "is_completed",
            "completed_at",
            "sort_order",
            "created_at",
        ]
        read_only_fields = ["job", "completed_at", "created_at"]


class JobDisputeSerializer(serializers.ModelSerializer):
    opened_by = UserSerializer(read_only=True)
    arbitrator = UserSerializer(read_only=True)

    class Meta:
        model = JobDispute
        fields = [
            "id",
            "job",
            "opened_by",
            "status",
            "summary",
            "previous_job_status",
            "resolution",
            "resolved_at",
            "escalated_at",
            "arbitrator",
            "arbitrator_decision",
            "created_at",
        ]
        read_only_fields = [
            "job",
            "opened_by",
            "previous_job_status",
            "resolved_at",
            "escalated_at",
            "arbitrator",
            "arbitrator_decision",
            "created_at",
        ]


class JobSpecRevisionSerializer(serializers.ModelSerializer):
    edited_by = UserSerializer(read_only=True)

    class Meta:
        model = JobSpecRevision
        fields = ["id", "job", "previous_description", "edited_by", "note", "created_at"]
        read_only_fields = ["job", "previous_description", "edited_by", "note", "created_at"]

