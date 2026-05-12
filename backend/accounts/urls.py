from django.urls import path
from rest_framework.authtoken import views as drf_views

from .views import (
    AvatarUploadView,
    CardCoverUploadView,
    CurrentUserView,
    DeleteAccountView,
    KycDocumentDestroyView,
    KycDocumentListCreateView,
    LoginView,
    PortfolioItemDetailView,
    PortfolioItemListCreateView,
    ProfileView,
    PublicFreelancerView,
    RegisterView,
    SwitchRoleView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/", drf_views.obtain_auth_token, name="token"),
    path("me/", CurrentUserView.as_view(), name="current-user"),
    path("profile/", ProfileView.as_view(), name="profile"),
    path("profile/avatar/", AvatarUploadView.as_view(), name="profile-avatar"),
    path("profile/card-cover/", CardCoverUploadView.as_view(), name="profile-card-cover"),
    path("kyc/documents/", KycDocumentListCreateView.as_view(), name="kyc-documents"),
    path("kyc/documents/<int:pk>/", KycDocumentDestroyView.as_view(), name="kyc-document"),
    path("portfolio/items/", PortfolioItemListCreateView.as_view(), name="portfolio-items"),
    path("portfolio/items/<int:pk>/", PortfolioItemDetailView.as_view(), name="portfolio-item"),
    path("users/<int:pk>/portfolio/", PublicFreelancerView.as_view(), name="public-portfolio"),
    path("switch-role/", SwitchRoleView.as_view(), name="switch-role"),
    path("delete-account/", DeleteAccountView.as_view(), name="delete-account"),
]

