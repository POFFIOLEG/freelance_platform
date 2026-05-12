from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from accounts.serializers import UserSerializer
from jobs.models import Job
from jobs.serializers import JobSerializer
from .models import FeaturedSlot, JobReminder, JobTemplate, PushDevice, SavedSearch, UserJobFavorite


class FreelancerCardSerializer(serializers.ModelSerializer):
    """Краткие данные для карточки на главной и публичного портфолио."""

    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "role", "profile"]

    def get_profile(self, user):
        p = getattr(user, "profile", None)
        if not p:
            return None
        request = self.context.get("request")
        avatar = None
        if p.avatar:
            try:
                avatar = request.build_absolute_uri(p.avatar.url) if request else p.avatar.url
            except Exception:
                avatar = p.avatar.url if p.avatar else None
        card_cover = None
        if getattr(p, "card_cover", None) and p.card_cover:
            try:
                card_cover = request.build_absolute_uri(p.card_cover.url) if request else p.card_cover.url
            except Exception:
                card_cover = None
        return {
            "headline": p.headline,
            "avatar": avatar,
            "card_cover": card_cover,
            "card_specialization": p.card_specialization,
            "card_pitch_lines": p.card_pitch_lines or [],
            "is_pro": p.is_pro,
            "is_verified": p.is_verified,
            "kyc_status": p.kyc_status,
            "location": p.location,
            "hourly_rate": str(p.hourly_rate) if p.hourly_rate is not None else None,
            "social_telegram": p.social_telegram,
            "social_vk": p.social_vk,
        }


class FeaturedSlotPublicSerializer(serializers.ModelSerializer):
    card = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = FeaturedSlot
        fields = ["slot_index", "is_active", "paid_until", "card"]

    def get_is_active(self, obj):
        return bool(obj.paid_until and obj.paid_until > timezone.now() and obj.worker_id)

    def get_card(self, obj):
        if not self.get_is_active(obj) or not obj.worker:
            return None
        return FreelancerCardSerializer(obj.worker, context=self.context).data


class FeaturedPurchaseSerializer(serializers.Serializer):
    slot_index = serializers.IntegerField(min_value=0, max_value=29)


class SavedSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedSearch
        fields = ["id", "name", "query", "created_at"]
        read_only_fields = ["created_at"]


class PushDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = PushDevice
        fields = ["id", "provider", "token", "device_name", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserJobFavoriteSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)
    job_id = serializers.PrimaryKeyRelatedField(
        queryset=Job.objects.all(),
        source="job",
        write_only=True,
    )

    class Meta:
        model = UserJobFavorite
        fields = ["id", "job", "job_id", "created_at"]
        read_only_fields = ["created_at"]


class JobTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobTemplate
        fields = ["id", "name", "title", "body", "category", "created_at"]
        read_only_fields = ["created_at"]


class JobReminderSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobReminder
        fields = ["id", "job", "fire_at", "note", "dismissed", "created_at"]
        read_only_fields = ["created_at"]
