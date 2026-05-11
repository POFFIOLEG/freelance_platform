from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from accounts.serializers import UserSerializer
from jobs.models import Job
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)
    reviewee = UserSerializer(read_only=True)
    publication_pending = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id",
            "job",
            "reviewer",
            "reviewee",
            "rating",
            "comment",
            "created_at",
            "publication_status",
            "published_at",
            "publication_pending",
        ]
        read_only_fields = [
            "reviewer",
            "reviewee",
            "created_at",
            "publication_status",
            "published_at",
            "publication_pending",
        ]

    def get_publication_pending(self, obj):
        return obj.publication_status != Review.PublicationStatus.PUBLISHED

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise ValidationError("Оценка от 1 до 5.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            raise ValidationError("Требуется авторизация.")

        job = attrs.get("job")
        if job is None and self.instance:
            job = self.instance.job
        if job is None:
            raise ValidationError({"job": "Укажите задание."})

        job = get_object_or_404(
            Job.objects.select_related("employer", "assigned_to"),
            pk=job.pk,
        )

        if job.status != Job.Status.COMPLETED:
            raise ValidationError({"job": "Отзыв можно оставить только после закрытия контракта."})
        if not job.assigned_to:
            raise ValidationError({"job": "У задания не был назначен исполнитель."})
        if user != job.employer and user != job.assigned_to:
            raise ValidationError({"job": "Вы не можете оставить отзыв по этой сделке."})
        if not self.instance and Review.objects.filter(reviewer=user, job=job).exists():
            raise ValidationError({"job": "Вы уже оставили отзыв по этому заданию."})

        if not self.instance:
            close = job.completed_at or job.updated_at
            if close:
                if timezone.is_naive(close):
                    close = timezone.make_aware(close, timezone.get_current_timezone())
                now = timezone.now()
                if now > close + timedelta(days=14):
                    raise ValidationError(
                        {
                            "job": "Истёк срок (14 дней после закрытия контракта), отзыв по этому заданию больше нельзя оставить.",
                        },
                    )

        attrs["job"] = job
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["job"] = {"id": instance.job_id, "title": instance.job.title}
        request = self.context.get("request")
        viewer = getattr(request, "user", None) if request else None
        if instance.publication_status != Review.PublicationStatus.PUBLISHED:
            if not (viewer and viewer.is_authenticated and viewer.pk == instance.reviewer_id):
                data["rating"] = None
                data["comment"] = None
        return data
