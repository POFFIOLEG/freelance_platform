"""Валидаторы паролей с сообщениями на русском (вместо стандартных Django)."""

import re

from django.contrib.auth.password_validation import (
    CommonPasswordValidator as DjangoCommonPasswordValidator,
    MinimumLengthValidator as DjangoMinimumLengthValidator,
    NumericPasswordValidator as DjangoNumericPasswordValidator,
    UserAttributeSimilarityValidator as DjangoUserAttributeSimilarityValidator,
)
from django.core.exceptions import ValidationError


class RussianUserAttributeSimilarityValidator(DjangoUserAttributeSimilarityValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user=user)
        except ValidationError:
            raise ValidationError(
                "Пароль слишком похож на персональные данные (логин, имя или email). Придумайте другой пароль.",
            ) from None


class RussianMinimumLengthValidator(DjangoMinimumLengthValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user=user)
        except ValidationError:
            raise ValidationError(
                f"Пароль слишком короткий: нужно не менее {self.min_length} символов.",
            ) from None

    def get_help_text(self):
        return f"Пароль должен содержать не менее {self.min_length} символов."


class RussianCommonPasswordValidator(DjangoCommonPasswordValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user=user)
        except ValidationError:
            raise ValidationError(
                "Этот пароль слишком распространён. Выберите более уникальную комбинацию.",
            ) from None

    def get_help_text(self):
        return "Не используйте простые и частые пароли."


class RussianNumericPasswordValidator(DjangoNumericPasswordValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user=user)
        except ValidationError:
            raise ValidationError("Пароль не может состоять только из цифр.") from None

    def get_help_text(self):
        return "Пароль не должен состоять только из цифр."


class RussianComplexityValidator:
    """Хотя бы одна буква (латиница или кириллица)."""

    def validate(self, password, user=None):
        if not re.search(r"[A-Za-zА-Яа-яЁё]", password):
            raise ValidationError(
                "Пароль должен содержать хотя бы одну букву.",
                code="password_no_letter",
            )

    def get_help_text(self):
        return "Используйте в пароле хотя бы одну букву."
