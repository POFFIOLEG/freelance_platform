from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import User, Profile, KycDocument
from .portfolio_serializers import PortfolioItemSerializer


class ProfileSerializer(serializers.ModelSerializer):

    portfolio_url = serializers.URLField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    last_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Profile
        fields = [
            "demo_balance",
            "avatar",
            "headline",
            "bio",
            "skills",
            "experience_years",
            "hourly_rate",
            "company",
            "location",
            "availability",
            "portfolio_url",
            "card_specialization",
            "card_pitch_lines",
            "card_cover",
            "is_pro",
            "is_verified",
            "kyc_status",
            "kyc_full_name",
            "kyc_comment",
            "social_telegram",
            "social_vk",
            "social_other",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
        ]
        read_only_fields = [
            "demo_balance",
            "avatar",
            "card_cover",
            "is_verified",
            "kyc_status",
            "is_pro",
        ]

    def validate_hourly_rate(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Ставка не может быть отрицательной.")
        return value

    def validate_card_pitch_lines(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Ожидается список строк.")
        if len(value) > 24:
            raise serializers.ValidationError("Не более 24 пунктов на карточке.")
        for line in value:
            if not isinstance(line, str) or len(line) > 280:
                raise serializers.ValidationError("Каждая строка — текст до 280 символов.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["first_name"] = instance.user.first_name or ""
        data["last_name"] = instance.user.last_name or ""
        data["email"] = instance.user.email or ""
        request = self.context.get("request")
        if instance.avatar:
            try:
                url = instance.avatar.url
                data["avatar"] = request.build_absolute_uri(url) if request else url
            except Exception:
                data["avatar"] = None
        else:
            data["avatar"] = None
        if instance.card_cover:
            try:
                url = instance.card_cover.url
                data["card_cover"] = request.build_absolute_uri(url) if request else url
            except Exception:
                data["card_cover"] = None
        else:
            data["card_cover"] = None
        return data

    def validate(self, attrs):
        p = (attrs.get("password") or "").strip()
        c = (attrs.get("password_confirm") or "").strip()
        if p or c:
            if p != c:
                raise serializers.ValidationError({"password_confirm": "Пароли не совпадают."})
            if p:
                user = self.context.get("request").user if self.context.get("request") else None
                if user:
                    validate_password(p, user)
        return attrs

    def update(self, instance, validated_data):
        first_name = validated_data.pop("first_name", serializers.empty)
        last_name = validated_data.pop("last_name", serializers.empty)
        password = validated_data.pop("password", None)
        validated_data.pop("password_confirm", None)

        user = instance.user
        if first_name is not serializers.empty:
            user.first_name = first_name or ""
        if last_name is not serializers.empty:
            user.last_name = last_name or ""
        if password and str(password).strip():
            user.set_password(password)
        user.save()

        inst = super().update(instance, validated_data)
        kyc_name = (inst.kyc_full_name or "").strip()
        if kyc_name and inst.kyc_status == Profile.KycStatus.NONE:
            Profile.objects.filter(pk=inst.pk).update(kyc_status=Profile.KycStatus.PENDING)
            inst.refresh_from_db()
        return inst


class KycDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = KycDocument
        fields = ["id", "doc_type", "file", "note", "uploaded_at"]
        read_only_fields = ["uploaded_at"]

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


class UserSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "first_name",
            "last_name",
            "is_moderator",
            "is_arbitrator",
            "profile",
        ]

    def get_profile(self, obj):
        try:
            return ProfileSerializer(obj.profile, context=self.context).data
        except ObjectDoesNotExist:
            return None


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    profile = ProfileSerializer(required=False)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "role",
            "first_name",
            "last_name",
            "profile",
        ]

    def create(self, validated_data):
        profile_data = validated_data.pop("profile", {})
        password = validated_data.pop("password")
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        if profile_data:
            ProfileSerializer().update(user.profile, profile_data)
        Token.objects.create(user=user)
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs["username"], password=attrs["password"])
        if not user:
            raise serializers.ValidationError(
                {"non_field_errors": "Неверный логин или пароль. Проверьте раскладку и регистр."},
            )
        attrs["user"] = user
        return attrs

