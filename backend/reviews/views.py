from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from jobs.models import Job
from .http import get_client_ip
from .models import Review
from .publication import sync_job_review_publication
from .rating import compute_reputation_summary
from .serializers import ReviewSerializer
from .trust import recompute_trust_for_job


class ReviewLeaderboardView(APIView):
    """Топ пользователей по средней оценке полученных отзывов (только опубликованные)."""

    permission_classes = [AllowAny]

    def get(self, request):
        limit = min(max(int(request.query_params.get("limit", 12)), 1), 50)
        pub = Review.PublicationStatus.PUBLISHED
        qs = (
            User.objects.filter(is_active=True, role=User.Roles.WORKER)
            .annotate(
                avg_received=Avg(
                    "reviews_received__rating",
                    filter=Q(reviews_received__publication_status=pub),
                ),
                review_count=Count(
                    "reviews_received",
                    filter=Q(reviews_received__publication_status=pub),
                ),
            )
            .filter(review_count__gte=1, avg_received__isnull=False)
            .order_by("-avg_received", "-review_count")[:limit]
        )
        data = [
            {
                "id": u.id,
                "username": u.username,
                "avg_rating": round(float(u.avg_received), 2),
                "review_count": u.review_count,
            }
            for u in qs
        ]
        return Response(data)


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related("job", "reviewer", "reviewee")
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = Review.objects.select_related("job", "reviewer", "reviewee")
        user_id = self.request.query_params.get("user")
        job_id = self.request.query_params.get("job")
        user = self.request.user

        if job_id:
            qs = qs.filter(job_id=job_id)
            job = Job.objects.filter(pk=job_id).first()
            if not job:
                return qs.none()
            if user.is_authenticated and (user == job.employer or user == job.assigned_to):
                return qs
            return qs.filter(publication_status=Review.PublicationStatus.PUBLISHED)

        if user_id:
            return qs.filter(
                reviewee_id=user_id,
                publication_status=Review.PublicationStatus.PUBLISHED,
            )

        return qs.filter(publication_status=Review.PublicationStatus.PUBLISHED)

    def perform_create(self, serializer):
        job = serializer.validated_data["job"]
        user = self.request.user
        reviewee = job.assigned_to if user == job.employer else job.employer
        serializer.save(
            reviewer=user,
            reviewee=reviewee,
            client_ip=get_client_ip(self.request),
            publication_status=Review.PublicationStatus.PENDING_MATE,
            trust_multiplier=1.0,
        )
        recompute_trust_for_job(job)
        sync_job_review_publication(job)


class ReputationSummaryView(APIView):
    """Публичный рейтинг (байесовское сглаживание) и внутренний скоринг для ранжирования."""

    permission_classes = [AllowAny]

    def get(self, request):
        user_id = request.query_params.get("user")
        if not user_id and request.user.is_authenticated:
            user_id = request.user.id
        if not user_id:
            return Response(
                {"detail": "Укажите параметр user (id пользователя)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        get_object_or_404(User, pk=user_id)
        stats = compute_reputation_summary(int(user_id))
        return Response(stats)
