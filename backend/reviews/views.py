from rest_framework import viewsets, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from jobs.models import Job
from .models import Review
from .serializers import ReviewSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related("job", "reviewer", "reviewee")
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        user_id = self.request.query_params.get("user")
        job_id = self.request.query_params.get("job")
        if user_id:
            qs = qs.filter(reviewee_id=user_id)
        if job_id:
            qs = qs.filter(job_id=job_id)
        return qs

    def perform_create(self, serializer):
        job = Job.objects.get(pk=self.request.data.get("job"))
        if self.request.user == job.employer and job.assigned_to:
            reviewee = job.assigned_to
        elif self.request.user == job.assigned_to:
            reviewee = job.employer
        else:
            raise ValidationError("Вы не можете оставить отзыв по этой задаче")

        serializer.save(reviewer=self.request.user, reviewee=reviewee)

