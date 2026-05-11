from django.conf import settings
from django.db import models


class Job(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        OPEN = "open", "Открыто"
        IN_PROGRESS = "in_progress", "В работе"
        SUBMITTED = "submitted", "Ожидает проверки"
        COMPLETED = "completed", "Завершено"
        CANCELLED = "cancelled", "Отменено"

    employer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="jobs",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_jobs",
    )
    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=120, blank=True)
    subcategory = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=120, blank=True)
    location = models.CharField(max_length=120, blank=True)
    budget_min = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    budget_max = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deadline = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
    )
    skills_required = models.JSONField(default=list, blank=True)
    attachments = models.URLField(blank=True)
    is_urgent = models.BooleanField(default=False)
    is_contest = models.BooleanField(default=False)
    is_exchange = models.BooleanField(default=False)
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Закрытие контракта",
        help_text="Момент перевода задания в «Завершено»; начало 14-дневного окна отзывов.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class JobApplication(models.Model):
    class Status(models.TextChoices):
        SENT = "sent", "Отправлена"
        SHORTLISTED = "shortlisted", "В шорт-листе"
        REJECTED = "rejected", "Отклонена"
        ACCEPTED = "accepted", "Принята"

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="applications")
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    cover_letter = models.TextField(blank=True)
    expected_budget = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SENT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("job", "worker")

    def __str__(self):
        return f"{self.worker} -> {self.job}"


class WorkSubmission(models.Model):
    class Status(models.TextChoices):
        SENT = "sent", "Отправлен"
        NEEDS_CHANGES = "needs_changes", "Нужны правки"
        APPROVED = "approved", "Принят"

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="submissions")
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="submissions",
    )
    message = models.TextField()
    deliverable_url = models.URLField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SENT,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Submission {self.job_id} by {self.worker_id}"


class JobStatusUpdate(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="updates")
    status = models.CharField(max_length=20, choices=Job.Status.choices)
    note = models.CharField(max_length=240, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="status_updates",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class JobBid(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="bids")
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bids",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    message = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["amount", "created_at"]
        unique_together = ("job", "worker")

    def __str__(self):
        return f"Bid {self.amount} for {self.job_id} by {self.worker_id}"
