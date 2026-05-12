"""Регистрация, вход, профиль, портфолио, аватар, KYC-документы, публичное портфолио исполнителя."""
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from .models import Profile, User, KycDocument
from .serializers import (
    KycDocumentSerializer,
    LoginSerializer,
    PortfolioItemSerializer,
    ProfileSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "auth_register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = Token.objects.get(user=user)
        return Response(
            {"token": token.key, "user": UserSerializer(user, context={"request": request}).data},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "auth_login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "user": UserSerializer(user, context={"request": request}).data})


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile


class CurrentUserView(generics.RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class SwitchRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        role = request.data.get("role")
        if role not in User.Roles.values:
            return Response({"detail": "Неверная роль"}, status=status.HTTP_400_BAD_REQUEST)
        request.user.role = role
        request.user.save(update_fields=["role"])
        return Response({"user": UserSerializer(request.user, context={"request": request}).data})


class DeleteAccountView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        Token.objects.filter(user=user).delete()
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PortfolioItemListCreateView(generics.ListCreateAPIView):
    serializer_class = PortfolioItemSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return self.request.user.profile.portfolio_items.all()

    def perform_create(self, serializer):
        # profile задаётся внутри PortfolioItemSerializer.create — не передавать сюда, иначе TypeError (два profile).
        serializer.save()


class PortfolioItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PortfolioItemSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return self.request.user.profile.portfolio_items.all()


class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        upload = request.FILES.get("avatar")
        if not upload:
            return Response(
                {"detail": "Не выбран файл. Используйте поле формы с именем «avatar»."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile = request.user.profile
        profile.avatar = upload
        profile.save(update_fields=["avatar"])
        return Response(ProfileSerializer(profile, context={"request": request}).data)


class CardCoverUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        upload = request.FILES.get("card_cover")
        if not upload:
            return Response(
                {"detail": "Не выбран файл. Используйте поле формы с именем «card_cover»."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile = request.user.profile
        profile.card_cover = upload
        profile.save(update_fields=["card_cover"])
        return Response(ProfileSerializer(profile, context={"request": request}).data)


class KycDocumentListCreateView(generics.ListCreateAPIView):
    serializer_class = KycDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return KycDocument.objects.filter(profile=self.request.user.profile)

    def perform_create(self, serializer):
        profile = self.request.user.profile
        serializer.save(profile=profile)
        if profile.kyc_status in (Profile.KycStatus.NONE, Profile.KycStatus.REJECTED):
            Profile.objects.filter(pk=profile.pk).update(kyc_status=Profile.KycStatus.PENDING)


class KycDocumentDestroyView(generics.DestroyAPIView):
    serializer_class = KycDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return KycDocument.objects.filter(profile=self.request.user.profile)


class PublicFreelancerView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        from reviews.rating import compute_reputation_summary
        from workhub.serializers import FreelancerCardSerializer

        user = get_object_or_404(User, pk=pk)
        card = FreelancerCardSerializer(user, context={"request": request}).data
        items = PortfolioItemSerializer(
            user.profile.portfolio_items.all(),
            many=True,
            context={"request": request},
        ).data
        rep = compute_reputation_summary(int(user.id))
        return Response({"card": card, "portfolio": items, "reputation": rep})

