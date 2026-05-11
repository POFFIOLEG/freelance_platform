from django.urls import path
from rest_framework.authtoken import views as drf_views

from .views import RegisterView, LoginView, ProfileView, CurrentUserView, SwitchRoleView, DeleteAccountView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/", drf_views.obtain_auth_token, name="token"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("switch-role/", SwitchRoleView.as_view(), name="switch-role"),
    path("delete-account/", DeleteAccountView.as_view(), name="delete-account"),
]

