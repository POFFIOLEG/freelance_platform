"""Сериализаторы работ портфолио: обложка, до 4 вложений, размещение в списке."""

import json
import os

from django.db import transaction
from django.db.models import F, Max
from rest_framework import serializers

from .models import PortfolioItem, PortfolioItemGalleryFile

MAX_GALLERY_FILES = 4
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_COVER_EXT = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_GALLERY_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm"}


def _parse_tools_skills(data) -> list[str]:
    """Читает tools_skills из request.data (dict, QueryDict и т.п.)."""
    if data is None or not hasattr(data, "get"):
        return []
    raw = data.get("tools_skills")
    if raw is None:
        return []
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, str):
        raw = raw.strip()
        if not raw:
            return []
        try:
            items = json.loads(raw)
        except json.JSONDecodeError:
            return []
    else:
        return []
    if not isinstance(items, list):
        return []
    out: list[str] = []
    for x in items[:20]:
        if isinstance(x, str) and (s := x.strip()):
            out.append(s[:200])
    return out


def _placement_from_request(request) -> str:
    if not request:
        return "last"
    raw = request.data.get("placement")
    if raw is None:
        return "last"
    if isinstance(raw, (list, tuple)) and raw:
        raw = raw[-1]
    s = str(raw).strip().lower()
    return s if s else "last"


def _check_upload(f, allowed: set[str]) -> None:
    if f.size > MAX_UPLOAD_BYTES:
        raise serializers.ValidationError(f"Файл «{getattr(f, 'name', '')}» больше 10 МБ.")
    ext = os.path.splitext(getattr(f, "name", "") or "")[1].lower()
    if ext not in allowed:
        raise serializers.ValidationError(
            f"Недопустимый тип файла ({ext or '—'}). Разрешены: {', '.join(sorted(allowed))}.",
        )


class PortfolioGalleryFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PortfolioItemGalleryFile
        fields = ["id", "file", "sort_order"]
        read_only_fields = ["id", "sort_order"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if instance.file:
            try:
                url = instance.file.url
                data["file"] = request.build_absolute_uri(url) if request else url
            except Exception:
                data["file"] = None
        else:
            data["file"] = None
        return data


class PortfolioItemSerializer(serializers.ModelSerializer):
    gallery = PortfolioGalleryFileSerializer(many=True, read_only=True, source="gallery_files")
    tools_skills = serializers.SerializerMethodField()

    class Meta:
        model = PortfolioItem
        fields = [
            "id",
            "title",
            "description",
            "image",
            "link",
            "video_url",
            "category",
            "tools_skills",
            "gallery",
            "sort_order",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_tools_skills(self, obj):
        return list(obj.tools_skills or [])

    def validate_title(self, value):
        s = (value or "").strip()
        if not s:
            raise serializers.ValidationError("Укажите название работы.")
        if len(s) > 120:
            raise serializers.ValidationError("Не более 120 символов.")
        return s

    def validate_description(self, value):
        text = value or ""
        if len(text) > 1500:
            raise serializers.ValidationError("Описание не длиннее 1500 символов.")
        return text

    def validate_image(self, value):
        if value:
            _check_upload(value, ALLOWED_COVER_EXT)
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if instance.image:
            try:
                url = instance.image.url
                data["image"] = request.build_absolute_uri(url) if request else url
            except Exception:
                data["image"] = None
        else:
            data["image"] = None
        return data

    def _save_gallery_from_request(self, item, request) -> None:
        files = request.FILES.getlist("gallery") if request else []
        if not files:
            return
        if len(files) > MAX_GALLERY_FILES:
            raise serializers.ValidationError({"gallery": f"Не более {MAX_GALLERY_FILES} файлов."})
        for f in files:
            _check_upload(f, ALLOWED_GALLERY_EXT)
        item.gallery_files.all().delete()
        for i, f in enumerate(files[:MAX_GALLERY_FILES]):
            PortfolioItemGalleryFile.objects.create(portfolio_item=item, file=f, sort_order=i)

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        profile = request.user.profile
        validated_data.pop("sort_order", None)
        placement = _placement_from_request(request)

        if placement == "first":
            profile.portfolio_items.update(sort_order=F("sort_order") + 1)
            sort_order = 0
        elif placement == "manual":
            try:
                sort_order = max(0, int(request.data.get("sort_order_manual", 0)))
            except (TypeError, ValueError):
                sort_order = 0
        else:
            agg = profile.portfolio_items.aggregate(m=Max("sort_order"))
            sort_order = (agg["m"] or 0) + 1

        validated_data["sort_order"] = sort_order
        validated_data["tools_skills"] = _parse_tools_skills(request.data)
        item = PortfolioItem.objects.create(profile=profile, **validated_data)
        self._save_gallery_from_request(item, request)
        return item

    @transaction.atomic
    def update(self, instance, validated_data):
        request = self.context["request"]
        if "tools_skills" in request.data:
            validated_data["tools_skills"] = _parse_tools_skills(request.data)
        item = super().update(instance, validated_data)
        files = request.FILES.getlist("gallery")
        if files:
            self._save_gallery_from_request(item, request)
        return item
