import logging

from django.conf import settings
from rest_framework import status
from rest_framework.exceptions import Throttled
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


FIELD_LABELS = {
    "non_field_errors": "Форма",
    "username": "Логин",
    "password": "Пароль",
    "password_confirm": "Подтверждение пароля",
    "email": "Email",
    "detail": "Ошибка",
    "title": "Название",
    "description": "Описание",
    "budget_min": "Бюджет от",
    "budget_max": "Бюджет до",
    "expected_budget": "Ожидаемая сумма",
    "amount": "Сумма",
    "cover_letter": "Сопроводительное письмо",
    "message": "Сообщение",
    "text": "Текст",
    "job": "Задание",
    "role": "Роль",
    "token": "Токен",
    "application_id": "Отклик",
    "submission_id": "Сдача работы",
    "status": "Статус",
    "deadline": "Срок",
    "skills_required": "Навыки",
    "attachments": "Вложения",
    "slot_index": "Номер слота",
    "name": "Название",
    "query": "Параметры поиска",
    "note": "Заметка",
    "fire_at": "Напоминание",
    "summary": "Описание ситуации",
    "resolution": "Решение",
    "due_date": "Срок этапа",
    "sort_order": "Порядок",
    "link": "Ссылка",
    "image": "Изображение",
    "gallery": "Галерея",
    "category": "Раздел",
    "video_url": "Видео",
    "tools_skills": "Навыки и инструменты",
    "kyc_full_name": "ФИО для верификации",
    "kyc_comment": "Комментарий к заявке",
    "card_specialization": "Специализация на карточке",
    "card_pitch_lines": "Тексты на карточке",
    "social_telegram": "Telegram",
    "social_vk": "ВКонтакте",
}


def _flatten_errors(data, prefix=""):
    lines = []
    if isinstance(data, dict):
        for key, val in data.items():
            label = FIELD_LABELS.get(key, key.replace("_", " "))
            sub = f"{prefix}{label}: " if prefix else f"{label}: "
            if isinstance(val, (list, tuple)):
                for item in val:
                    if isinstance(item, dict):
                        lines.extend(_flatten_errors(item, sub))
                    else:
                        lines.append(f"{sub}{item}")
            elif isinstance(val, dict):
                lines.extend(_flatten_errors(val, sub))
            else:
                lines.append(f"{sub}{val}")
    elif isinstance(data, (list, tuple)):
        for item in data:
            if isinstance(item, dict):
                if "string" in item:
                    lines.append(str(item["string"]))
                else:
                    lines.extend(_flatten_errors(item, prefix))
            else:
                lines.append(f"{prefix}{item}" if prefix else str(item))
    else:
        lines.append(f"{prefix}{data}" if prefix else str(data))
    return lines


def russian_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        request = context.get("request")
        path = getattr(request, "path", "") if request else ""
        if isinstance(path, str) and path.startswith("/api/"):
            logger.error("Необработанное исключение в API: %s", path, exc_info=True)
            body = {"detail": "Внутренняя ошибка сервера. Повторите позже или обратитесь в поддержку."}
            if settings.DEBUG:
                body["debug"] = f"{exc.__class__.__name__}: {exc}"
            return Response(body, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return None
    if isinstance(exc, Throttled):
        wait = exc.wait
        msg = (
            "Слишком много запросов с этого адреса (ограничение частоты). "
            "Подождите и попробуйте снова."
        )
        if wait is not None:
            msg += f" Обычно достаточно подождать около {int(wait)} с."
        response.data = {"detail": msg}
        return response
    payload = response.data
    if isinstance(payload, dict):
        detail = payload.get("detail")
        if detail is not None and len(payload) == 1:
            if isinstance(detail, list):
                response.data = {"detail": " ".join(str(x) for x in detail)}
            elif not isinstance(detail, dict):
                pass
            else:
                lines = _flatten_errors(detail)
                response.data = {"detail": " ".join(lines) if lines else response.data}
        else:
            lines = _flatten_errors(payload)
            if lines:
                response.data = {"detail": " ".join(lines)}
    elif isinstance(payload, list):
        response.data = {"detail": " ".join(str(x) for x in payload)}
    return response
