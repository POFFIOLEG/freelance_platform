from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Roles(models.TextChoices):
        EMPLOYER = "employer", "Работодатель"
        WORKER = "worker", "Исполнитель"

    role = models.CharField(
        max_length=32,
        choices=Roles.choices,
        default=Roles.WORKER,
    )

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    headline = models.CharField(max_length=120, blank=True)
    bio = models.TextField(blank=True)
    skills = models.JSONField(default=list, blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    company = models.CharField(max_length=120, blank=True)
    location = models.CharField(max_length=120, blank=True)
    availability = models.CharField(max_length=120, blank=True)
    portfolio_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile {self.user.username}"
