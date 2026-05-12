from django.conf import settings
from django.db import models


class Job(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        OPEN = "open", "Открыто"
        IN_PROGRESS = "in_progress", "В работе"
        SUBMITTED = "submitted", "Ожидает проверки"
        DISPUTED = "disputed", "Спор"
        COMPLETED = "completed", "Завершено"
        CANCELLED = "cancelled", "Отменено"

    class ModerationStatus(models.TextChoices):
        APPROVED = "approved", "Одобрено"
        PENDING = "pending", "На модерации"
        REJECTED = "rejected", "Отклонено"

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
    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.APPROVED,
    )
    moderation_note = models.CharField(max_length=240, blank=True)
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
    deliverable_url = models.TextField(blank=True)
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


class JobMilestone(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="milestones")
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]


class JobDispute(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Открыт"
        ESCALATED = "escalated", "На арбитраже"
        RESOLVED = "resolved", "Закрыт"

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="disputes")
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="opened_disputes",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    summary = models.TextField()
    previous_job_status = models.CharField(max_length=20, blank=True)
    resolution = models.TextField(blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    escalated_at = models.DateTimeField(null=True, blank=True)
    arbitrator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="arbitrated_disputes",
    )
    arbitrator_decision = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class JobSpecRevision(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="spec_revisions")
    previous_description = models.TextField()
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_spec_edits",
    )
    note = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
