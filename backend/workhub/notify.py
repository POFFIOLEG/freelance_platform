"""Доставка уведомлений: WebSocket (Channels) + заготовка мобильного push по сохранённым токенам."""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from workhub.push_service import send_mobile_push


def push_to_user(user_id: int, payload: dict) -> None:
    layer = get_channel_layer()
    if layer:
        async_to_sync(layer.group_send)(
            f"user_{user_id}",
            {"type": "notify.event", **payload},
        )
    event = payload.get("event") or "notify"
    if event == "chat_message":
        title = "Новое сообщение в чате"
        body = f"Задание #{payload.get('job_id')}"
    elif event == "new_application":
        title = "Новый отклик"
        body = f"По заданию #{payload.get('job_id')}"
    elif event == "revision_requested":
        title = "Работа на доработке"
        body = f"Задание #{payload.get('job_id')}"
    elif event == "released_from_job":
        title = "Сняли с задания"
        body = f"Задание #{payload.get('job_id')}"
    elif event == "worker_assigned":
        title = "Вас выбрали исполнителем"
        body = f"Задание #{payload.get('job_id')}"
    elif event == "work_submitted":
        title = "Результат на проверке"
        body = f"Задание #{payload.get('job_id')}"
    else:
        title = "Уведомление"
        body = str(event)
    send_mobile_push(user_id, title, body, payload)
