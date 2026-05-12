from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ReputationSummaryView, ReviewLeaderboardView, ReviewViewSet

router = DefaultRouter()
router.register("", ReviewViewSet, basename="review")

urlpatterns = [
    path("leaderboard/", ReviewLeaderboardView.as_view(), name="review-leaderboard"),
    path("summary/", ReputationSummaryView.as_view(), name="review-summary"),
] + router.urls
