from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import User, Profile


class ProfileSerializer(serializers.ModelSerializer):
    """Профиль + поля пользователя (имя, фамилия, смена пароля). В ответе также email (только чтение)."""

    first_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    last_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    password_confirm = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Profile
        fields = [
            "demo_balance",
            "headline",
            "bio",
            "skills",
            "experience_years",
            "hourly_rate",
            "company",
            "location",
            "availability",
            "portfolio_url",
            "first_name",
            "last_name",
            "password",
            "password_confirm",
        ]
        read_only_fields = ["demo_balance"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["first_name"] = instance.user.first_name or ""
        data["last_name"] = instance.user.last_name or ""
        data["email"] = instance.user.email or ""
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

        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "first_name", "last_name", "profile"]

    def get_profile(self, obj):
        try:
            return ProfileSerializer(obj.profile).data
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
            raise serializers.ValidationError("Неверный логин или пароль")
        attrs["user"] = user
        return attrs

