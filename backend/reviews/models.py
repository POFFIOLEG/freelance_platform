from django.conf import settings
from django.db import models

from jobs.models import Job


class Review(models.Model):
    class PublicationStatus(models.TextChoices):
        PENDING_MATE = "pending_mate", "Ожидает пары"
        PUBLISHED = "published", "Опубликован"

    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_written",
    )
    reviewee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reviews_received",
    )
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True)
    publication_status = models.CharField(
        max_length=20,
        choices=PublicationStatus.choices,
        default=PublicationStatus.PENDING_MATE,
    )
    published_at = models.DateTimeField(null=True, blank=True)
    client_ip = models.GenericIPAddressField(null=True, blank=True)
    trust_multiplier = models.FloatField(
        default=1.0,
        help_text="Множитель доверия (0–1): сеть/IP, паттерны, обмен отзывами.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("reviewer", "job")
        ordering = ["-created_at"]
