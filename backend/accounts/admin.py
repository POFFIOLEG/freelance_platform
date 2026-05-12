from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User, Profile, PortfolioItem, PortfolioItemGalleryFile, KycDocument


class PortfolioGalleryInline(admin.TabularInline):
    model = PortfolioItemGalleryFile
    extra = 0


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Роль и доступ", {"fields": ("role", "is_moderator", "is_arbitrator")}),
    )
    list_display = ("username", "email", "role", "is_moderator", "is_arbitrator", "is_active")


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "headline", "location", "is_verified", "kyc_status")
    search_fields = ("user__username", "headline", "kyc_full_name")
    list_filter = ("is_verified", "kyc_status", "is_pro")


@admin.register(PortfolioItem)
class PortfolioItemAdmin(admin.ModelAdmin):
    list_display = ("title", "profile", "sort_order", "category")
    search_fields = ("title", "profile__user__username", "category")
    inlines = [PortfolioGalleryInline]


@admin.register(KycDocument)
class KycDocumentAdmin(admin.ModelAdmin):
    list_display = ("profile", "doc_type", "uploaded_at")
    list_filter = ("doc_type",)
    search_fields = ("profile__user__username",)

