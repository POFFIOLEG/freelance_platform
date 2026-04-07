from django.urls import path

from .views import JobMessageListCreateView

urlpatterns = [
    path("<int:job_id>/", JobMessageListCreateView.as_view(), name="job-messages"),
]

