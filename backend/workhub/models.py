from django.conf import settings
from django.db import models
from django.utils import timezone


class FeaturedSlot(models.Model):

    FEATURED_PRICE = 100
    PERIOD_DAYS = 30

    slot_index = models.PositiveSmallIntegerField(unique=True)
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="featured_slots",
    )
    paid_until = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["slot_index"]

    def __str__(self):
        return f"Слот {self.slot_index}"


class SavedSearch(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_searches",
    )
    name = models.CharField(max_length=120)
    query = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class UserJobFavorite(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_favorites",
    )
    job = models.ForeignKey("jobs.Job", on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "job")


class JobTemplate(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_templates",
    )
    name = models.CharField(max_length=120)
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    category = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PushDevice(models.Model):

    class Provider(models.TextChoices):
        FCM = "fcm", "Firebase Cloud Messaging"
        APNS = "apns", "Apple Push Notification"
        WEB_PUSH = "web_push", "Web Push (endpoint)"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="push_devices",
    )
    provider = models.CharField(max_length=16, choices=Provider.choices, default=Provider.FCM)
    token = models.TextField()
    device_name = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "provider", "token")
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user.username} {self.provider}"


class JobReminder(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_reminders",
    )
    job = models.ForeignKey("jobs.Job", on_delete=models.CASCADE, related_name="reminders")
    fire_at = models.DateTimeField()
    note = models.CharField(max_length=240, blank=True)
    dismissed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["fire_at"]
