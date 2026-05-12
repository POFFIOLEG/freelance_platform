"""Маршруты расширений: избранное, шаблоны, календарь, модерация, push-устройства, featured-слоты."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .moderation_views import (
    ModerationJobDecisionView,
    ModerationKycDecisionView,
    ModerationKycDocumentsView,
    ModerationKycQueueView,
    ModerationPendingJobsView,
)
from .views import (
    CalendarAggregateView,
    CalendarIcsExportView,
    CalendarXlsxExportView,
    FeaturedListView,
    FeaturedPurchaseView,
    JobReminderViewSet,
    JobTemplateViewSet,
    PushDeviceViewSet,
    RecommendedWorkersView,
    SavedSearchViewSet,
    UserJobFavoriteViewSet,
)

router = DefaultRouter()
router.register("saved-searches", SavedSearchViewSet, basename="saved-search")
router.register("favorites", UserJobFavoriteViewSet, basename="job-favorite")
router.register("templates", JobTemplateViewSet, basename="job-template")
router.register("reminders", JobReminderViewSet, basename="job-reminder")
router.register("push-devices", PushDeviceViewSet, basename="push-device")

urlpatterns = [
    path("featured/", FeaturedListView.as_view(), name="featured-list"),
    path("featured/purchase/", FeaturedPurchaseView.as_view(), name="featured-purchase"),
    path("calendar/", CalendarAggregateView.as_view(), name="calendar"),
    path("calendar/export.ics", CalendarIcsExportView.as_view(), name="calendar-ics"),
    path("calendar/export.xlsx", CalendarXlsxExportView.as_view(), name="calendar-xlsx"),
    path("recommended-workers/", RecommendedWorkersView.as_view(), name="recommended-workers"),
    path("moderation/jobs/", ModerationPendingJobsView.as_view(), name="moderation-jobs"),
    path("moderation/jobs/<int:pk>/decision/", ModerationJobDecisionView.as_view(), name="moderation-job-decision"),
    path("moderation/kyc/", ModerationKycQueueView.as_view(), name="moderation-kyc-queue"),
    path(
        "moderation/kyc/<int:profile_id>/documents/",
        ModerationKycDocumentsView.as_view(),
        name="moderation-kyc-documents",
    ),
    path(
        "moderation/kyc/<int:profile_id>/decision/",
        ModerationKycDecisionView.as_view(),
        name="moderation-kyc-decision",
    ),
    path("", include(router.urls)),
]
