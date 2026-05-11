"""Двусторонняя публикация отзывов и дедлайн после закрытия контракта."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from jobs.models import Job

from .models import Review

REVIEW_WINDOW_DAYS = 14


def contract_close_timestamp(job: Job):
    return job.completed_at or job.updated_at


def sync_job_review_publication(job: Job) -> None:
    """
    Публикует отзывы по заданию, если:
    - оба участника оставили отзыв (взаимная публикация), или
    - с момента закрытия контракта прошло 14 дней (остаётся то, что успели оставить).
    """
    reviews = list(Review.objects.filter(job_id=job.pk))
    if not reviews:
        return
    now = timezone.now()
    close = contract_close_timestamp(job)
    if close and timezone.is_naive(close):
        close = timezone.make_aware(close, timezone.get_current_timezone())
    deadline = close + timedelta(days=REVIEW_WINDOW_DAYS) if close else None

    should_publish = len(reviews) >= 2 or (deadline is not None and now >= deadline)
    if not should_publish:
        return

    pending_ids = [
        r.pk
        for r in reviews
        if r.publication_status != Review.PublicationStatus.PUBLISHED
    ]
    if not pending_ids:
        return
    Review.objects.filter(pk__in=pending_ids).update(
        publication_status=Review.PublicationStatus.PUBLISHED,
        published_at=now,
    )
