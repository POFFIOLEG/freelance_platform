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
    is_moderator = models.BooleanField(
        default=False,
        help_text="Доступ к очереди модерации заданий и KYC.",
    )
    is_arbitrator = models.BooleanField(
        default=False,
        help_text="Может выносить решения по спорам на арбитраже.",
    )

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Profile(models.Model):
    class KycStatus(models.TextChoices):
        NONE = "none", "Не подавали"
        PENDING = "pending", "На проверке"
        APPROVED = "approved", "Подтверждено"
        REJECTED = "rejected", "Отклонено"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    demo_balance = models.DecimalField(max_digits=12, decimal_places=2, default=100000)
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    headline = models.CharField(max_length=120, blank=True)
    bio = models.TextField(blank=True)
    skills = models.JSONField(default=list, blank=True)
    experience_years = models.PositiveIntegerField(default=0)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    company = models.CharField(max_length=120, blank=True)
    location = models.CharField(max_length=120, blank=True)
    availability = models.CharField(max_length=120, blank=True)
    portfolio_url = models.URLField(blank=True)
    card_specialization = models.CharField(
        max_length=120,
        blank=True,
        help_text="Подпись на карточке на главной (например «Копирайтинг»).",
    )
    card_pitch_lines = models.JSONField(
        default=list,
        blank=True,
        help_text="Список коротких строк для карточки исполнителя.",
    )
    card_cover = models.ImageField(
        upload_to="card_covers/",
        blank=True,
        null=True,
        verbose_name="Изображение карточки на главной",
        help_text="Баннер над текстом карточки в блоке на главной странице.",
    )
    is_pro = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    kyc_status = models.CharField(
        max_length=20,
        choices=KycStatus.choices,
        default=KycStatus.NONE,
    )
    kyc_full_name = models.CharField(max_length=200, blank=True)
    kyc_comment = models.TextField(blank=True)
    social_telegram = models.CharField(max_length=120, blank=True)
    social_vk = models.URLField(blank=True)
    social_other = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile {self.user.username}"


class PortfolioItem(models.Model):
    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="portfolio_items",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="portfolio/", blank=True, null=True, verbose_name="Обложка")
    link = models.URLField(blank=True)
    video_url = models.URLField(blank=True, help_text="YouTube, RuTube, Vimeo и т.п.")
    category = models.CharField(
        max_length=120,
        blank=True,
        help_text="Раздел портфолио (специализация).",
    )
    tools_skills = models.JSONField(default=list, blank=True, help_text="До 20 инструментов и навыков.")
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self):
        return self.title


class PortfolioItemGalleryFile(models.Model):
    """До 4 файлов на работу: изображения или короткое видео (иллюстрация процесса)."""

    portfolio_item = models.ForeignKey(
        PortfolioItem,
        on_delete=models.CASCADE,
        related_name="gallery_files",
    )
    file = models.FileField(upload_to="portfolio/gallery/")
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]


class KycDocument(models.Model):
    """Файлы для верификации личности (паспорт, селфи и т.д.)."""

    class DocType(models.TextChoices):
        ID_FRONT = "id_front", "Документ (лицевая)"
        ID_BACK = "id_back", "Документ (оборот)"
        SELFIE = "selfie", "Селфи с документом"
        OTHER = "other", "Другое"

    profile = models.ForeignKey(
        Profile,
        on_delete=models.CASCADE,
        related_name="kyc_documents",
    )
    doc_type = models.CharField(max_length=20, choices=DocType.choices, default=DocType.ID_FRONT)
    file = models.FileField(upload_to="kyc/")
    note = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.get_doc_type_display()} ({self.profile.user.username})"
