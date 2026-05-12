"""Простая эвристика антиспама для модерации новых заданий."""

from .models import Job


def job_should_moderate(title: str, description: str) -> bool:
    blob = f"{title or ''}\n{description or ''}".lower()
    markers = (
        "viagra",
        "casino",
        "заработок без вложений",
        "быстрые деньги",
        "перевод получателя",
        "http://bit.ly/",
        "t.me/joinchat",
    )
    return any(m in blob for m in markers)


def moderation_status_for_new_job(title: str, description: str) -> str:
    if job_should_moderate(title, description):
        return Job.ModerationStatus.PENDING
    return Job.ModerationStatus.APPROVED
