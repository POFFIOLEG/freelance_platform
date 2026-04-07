from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


def index(_request):
    return JsonResponse(
        {
            "name": "freelance_platform API",
            "status": "ok",
            "health": "/health/",
            "auth": "/api/auth/",
            "jobs": "/api/jobs/",
            "chat": "/api/chat/",
            "reviews": "/api/reviews/",
        }
    )


urlpatterns = [
    path("", index),
    path("admin/", admin.site.urls),
    path("health/", healthcheck),
    path("api/auth/", include("accounts.urls")),
    path("api/jobs/", include("jobs.urls")),
    path("api/chat/", include("chat.urls")),
    path("api/reviews/", include("reviews.urls")),
]
