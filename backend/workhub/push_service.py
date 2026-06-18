import logging

from .models import PushDevice

logger = logging.getLogger(__name__)


def send_mobile_push(user_id: int, title: str, body: str, data: dict | None = None) -> None:
    devices = PushDevice.objects.filter(user_id=user_id)
    if not devices.exists():
        return
    for d in devices:
        logger.info(
            "push_stub user=%s provider=%s title=%s",
            user_id,
            d.provider,
            title[:80],
        )
