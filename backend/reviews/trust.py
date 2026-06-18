from __future__ import annotations

from .models import Review


def compute_trust_multiplier(review: Review, peers: list[Review] | None = None) -> float:
    peers = peers if peers is not None else list(Review.objects.filter(job_id=review.job_id).exclude(pk=review.pk))
    m = 1.0

    # один IP у обеих сторон
    for o in peers:
        if review.client_ip and o.client_ip and review.client_ip == o.client_ip:
            m *= 0.28

    # взаимные отзывы за 5 мин без текста
    for o in peers:
        delta = abs((review.created_at - o.created_at).total_seconds())
        if delta <= 300:
            if review.rating in (1, 5) and o.rating in (1, 5):
                if len((review.comment or "").strip()) < 12 and len((o.comment or "").strip()) < 12:
                    m *= 0.42

    # у автора все оценки одинаковые
    hist = list(
        Review.objects.filter(reviewer_id=review.reviewer_id)
        .exclude(pk=review.pk)
        .values_list("rating", flat=True)[:50],
    )
    if len(hist) >= 2:
        ratings = hist + [review.rating]
        if all(x == 5 for x in ratings) or all(x == 1 for x in ratings):
            m *= 0.52

    if review.rating in (1, 5) and len((review.comment or "").strip()) < 4:
        m *= 0.82

    return max(0.05, min(1.0, m))


def recompute_trust_for_job(job):
    reviews = list(Review.objects.filter(job_id=job.pk))
    for r in reviews:
        peers = [x for x in reviews if x.pk != r.pk]
        mult = compute_trust_multiplier(r, peers)
        if abs(float(r.trust_multiplier or 1.0) - mult) > 1e-6:
            r.trust_multiplier = mult
            r.save(update_fields=["trust_multiplier"])
