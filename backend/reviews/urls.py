from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ReputationSummaryView, ReviewViewSet

router = DefaultRouter()
router.register("", ReviewViewSet, basename="review")

urlpatterns = [
    path("summary/", ReputationSummaryView.as_view(), name="review-summary"),
] + router.urls

