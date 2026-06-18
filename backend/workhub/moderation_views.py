from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Profile
from accounts.permissions import IsModerator
from accounts.serializers import KycDocumentSerializer, UserSerializer
from jobs.models import Job
from jobs.serializers import JobSerializer


class ModerationPendingJobsView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        qs = (
            Job.objects.filter(moderation_status=Job.ModerationStatus.PENDING)
            .select_related("employer", "employer__profile", "assigned_to")
            .order_by("-created_at")
        )
        return Response(JobSerializer(qs, many=True, context={"request": request}).data)


class ModerationJobDecisionView(APIView):
    permission_classes = [IsModerator]

    def post(self, request, pk):
        job = get_object_or_404(Job, pk=pk)
        action = (request.data.get("action") or "").strip().lower()
        note = (request.data.get("note") or "").strip()[:240]
        if action not in ("approve", "reject"):
            return Response(
                {"detail": "Укажите action: approve или reject."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if job.moderation_status != Job.ModerationStatus.PENDING:
            return Response(
                {"detail": "Задание не в очереди на модерации."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if action == "approve":
            job.moderation_status = Job.ModerationStatus.APPROVED
            job.moderation_note = ""
        else:
            job.moderation_status = Job.ModerationStatus.REJECTED
            job.moderation_note = note or "Отклонено модератором."
        job.save()
        return Response(JobSerializer(job, context={"request": request}).data)


class ModerationKycQueueView(APIView):
    permission_classes = [IsModerator]

    def get(self, request):
        qs = (
            Profile.objects.filter(kyc_status=Profile.KycStatus.PENDING)
            .select_related("user")
            .order_by("-updated_at")
        )
        out = []
        for p in qs:
            doc_n = p.kyc_documents.count()
            out.append(
                {
                    "profile_id": p.id,
                    "user": UserSerializer(p.user, context={"request": request}).data,
                    "kyc_full_name": p.kyc_full_name,
                    "kyc_comment": p.kyc_comment,
                    "documents_count": doc_n,
                }
            )
        return Response(out)


class ModerationKycDocumentsView(APIView):
    permission_classes = [IsModerator]

    def get(self, request, profile_id):
        profile = get_object_or_404(Profile, pk=profile_id)
        docs = profile.kyc_documents.all()
        return Response(KycDocumentSerializer(docs, many=True, context={"request": request}).data)


class ModerationKycDecisionView(APIView):
    permission_classes = [IsModerator]

    @transaction.atomic
    def post(self, request, profile_id):
        profile = get_object_or_404(Profile, pk=profile_id)
        action = (request.data.get("action") or "").strip().lower()
        if action not in ("approve", "reject"):
            return Response(
                {"detail": "Укажите action: approve или reject."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if profile.kyc_status != Profile.KycStatus.PENDING:
            return Response(
                {"detail": "Заявка KYC не на проверке."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if action == "approve":
            profile.kyc_status = Profile.KycStatus.APPROVED
            profile.is_verified = True
        else:
            profile.kyc_status = Profile.KycStatus.REJECTED
            profile.is_verified = False
        profile.save(update_fields=["kyc_status", "is_verified", "updated_at"])
        return Response({"detail": "Решение сохранено.", "profile_id": profile.id})
