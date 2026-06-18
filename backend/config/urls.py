from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.shortcuts import render


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
            "hub": "/api/hub/",
        }
    )


def custom_404(request, exception):
    return render(request, "404.html", status=404)


def custom_500(request):
    return render(request, "500.html", status=500)


urlpatterns = [
    path("", index),
    path("admin/", admin.site.urls),
    path("health/", healthcheck),
    path("api/auth/", include("accounts.urls")),
    path("api/jobs/", include("jobs.urls")),
    path("api/chat/", include("chat.urls")),
    path("api/reviews/", include("reviews.urls")),
    path("api/hub/", include("workhub.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

handler404 = "config.urls.custom_404"
handler500 = "config.urls.custom_500"
