"""Веса отзывов, байесовское сглаживание публичного рейтинга и внутренний скоринг."""

from __future__ import annotations

import math

from django.db.models import Avg
from django.utils import timezone

from jobs.models import Job, JobApplication

from .models import Review

BAYESIAN_PRIOR_STRENGTH = 10.0


def temporal_weight(created_at, now=None):
    now = now or timezone.now()
    if timezone.is_naive(created_at):
        created_at = timezone.make_aware(created_at, timezone.get_current_timezone())
    days = (now - created_at).days
    if days <= 90:
        return 1.0
    if days <= 365:
        return 0.45
    return 0.15


def job_transaction_weight(job: Job) -> float:
    w = 1.0
    budget = float(job.budget_max or job.budget_min or 0)
    if budget >= 500_000:
        w *= 1.35
    elif budget >= 100_000:
        w *= 1.2
    elif budget >= 50_000:
        w *= 1.1
    if job.is_urgent:
        w *= 1.1
    if job.is_contest:
        w *= 1.08
    w *= 1.05
    return min(w, 2.5)


def reviewer_credibility_weight(reviewer) -> float:
    n = count_completed_deals(reviewer)
    if n <= 0:
        return 0.75
    t = math.log10(1 + n) / math.log10(1 + 50)
    w = 0.75 + 1.25 * t
    return min(max(w, 0.65), 2.0)


def count_completed_deals(user) -> int:
    as_employer = Job.objects.filter(employer=user, status=Job.Status.COMPLETED).count()
    as_worker = Job.objects.filter(assigned_to=user, status=Job.Status.COMPLETED).count()
    return as_employer + as_worker


def count_cancelled_deals(user) -> int:
    as_employer = Job.objects.filter(employer=user, status=Job.Status.CANCELLED).count()
    as_worker = Job.objects.filter(assigned_to=user, status=Job.Status.CANCELLED).count()
    return as_employer + as_worker


def platform_rating_prior() -> float:
    v = (
        Review.objects.filter(publication_status=Review.PublicationStatus.PUBLISHED)
        .aggregate(a=Avg("rating"))
        .get("a")
    )
    return float(v) if v is not None else 4.0


def single_review_base_weight(review: Review, now=None) -> float:
    now = now or timezone.now()
    tw = temporal_weight(review.created_at, now)
    jw = job_transaction_weight(review.job)
    rw = reviewer_credibility_weight(review.reviewer)
    trust = float(review.trust_multiplier or 1.0)
    return tw * jw * rw * trust


def aggregate_review_weights_for_user(user_id: int, now=None, only_published: bool = True) -> dict:
    now = now or timezone.now()
    qs = Review.objects.filter(reviewee_id=user_id).select_related("job", "reviewer")
    if only_published:
        qs = qs.filter(publication_status=Review.PublicationStatus.PUBLISHED)
    weighted_sum = 0.0
    total_w = 0.0
    simple_sum = 0
    count = 0
    for r in qs:
        w = single_review_base_weight(r, now)
        weighted_sum += float(r.rating) * w
        total_w += w
        simple_sum += r.rating
        count += 1
    return {
        "weighted_sum": weighted_sum,
        "total_w": total_w,
        "simple_average": round(simple_sum / count, 2) if count else None,
        "review_count": count,
        "weighted_rating_raw": round(weighted_sum / total_w, 2) if total_w > 0 else None,
    }


def _worker_acceptance_ratio_percent(user) -> float:
    qs = JobApplication.objects.filter(worker=user)
    total = qs.count()
    if total == 0:
        return 70.0
    accepted = qs.filter(status=JobApplication.Status.ACCEPTED).count()
    return 100.0 * accepted / total


def compute_internal_score(user, now=None) -> float:
    """
    Внутренний скоринг 0–100 для ранжирования (не дублирует звёзды 1:1).
    """
    now = now or timezone.now()
    agg = aggregate_review_weights_for_user(user.id, now, only_published=True)
    wr = agg["weighted_rating_raw"] or 3.0
    quality = (wr - 1) / 4 * 100
    completed = count_completed_deals(user)
    cancelled = count_cancelled_deals(user)
    denom = max(1, completed + cancelled)
    stability = 100.0 * completed / denom
    text_scores = []
    for r in Review.objects.filter(
        reviewee_id=user.id,
        publication_status=Review.PublicationStatus.PUBLISHED,
    ):
        L = len((r.comment or "").strip())
        text_scores.append(min(100.0, L * 0.5))
    text_avg = sum(text_scores) / len(text_scores) if text_scores else 50.0
    acceptance = _worker_acceptance_ratio_percent(user)
    internal = (
        0.32 * quality
        + 0.28 * stability
        + 0.18 * text_avg
        + 0.12 * acceptance
        + 0.10 * 72.0
    )
    return round(min(100.0, max(0.0, internal)), 2)


def _public_confidence_label(review_count: int, total_w: float) -> str:
    if review_count <= 0:
        return "none"
    if review_count < 3 or total_w < 4.0:
        return "low"
    if review_count < 10 or total_w < 12.0:
        return "medium"
    return "high"


def compute_reputation_summary(user_id: int, now=None) -> dict:
    from accounts.models import User

    now = now or timezone.now()
    user = User.objects.get(pk=user_id)
    prior = platform_rating_prior()
    agg = aggregate_review_weights_for_user(user_id, now, only_published=True)
    weighted_sum = agg["weighted_sum"]
    total_w = agg["total_w"]

    if total_w <= 0:
        public = None
    else:
        public = (BAYESIAN_PRIOR_STRENGTH * prior + weighted_sum) / (BAYESIAN_PRIOR_STRENGTH + total_w)

    internal = compute_internal_score(user, now)

    return {
        "public_rating": round(public, 2) if public is not None else None,
        "public_rating_display": f"{public:.1f}" if public is not None else None,
        "bayesian_prior_mean": round(prior, 3),
        "bayesian_prior_strength": BAYESIAN_PRIOR_STRENGTH,
        "weighted_rating_raw": agg["weighted_rating_raw"],
        "simple_average": agg["simple_average"],
        "review_count": agg["review_count"],
        "total_effective_weight": round(total_w, 3) if total_w else 0.0,
        "public_confidence": _public_confidence_label(agg["review_count"], total_w),
        "internal_score": internal,
        "completed_deals": count_completed_deals(user),
        "cancelled_deals": count_cancelled_deals(user),
        "weighting_note": (
            "Публичная оценка сглажена к среднему по платформе при малом числе отзывов (байесовское приорное среднее). "
            "В расчёте участвуют только опубликованные отзывы; вес снижается при подозрительных паттернах и совпадении IP. "
            "Внутренний скоринг используется для ранжирования и учитывает сделки, отклики и полноту текста отзывов."
        ),
    }
