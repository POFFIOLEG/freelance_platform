from django.shortcuts import get_object_or_404
from django.db import IntegrityError
from django.db.models import Q, Prefetch
from django.utils import timezone
from decimal import Decimal
import random
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle

from accounts.permissions import IsArbitrator

from .models import Job, JobApplication, WorkSubmission, JobStatusUpdate, JobBid, JobMilestone, JobDispute, JobSpecRevision
from .serializers import (
    JobSerializer,
    JobApplicationSerializer,
    WorkSubmissionSerializer,
    JobStatusUpdateSerializer,
    JobBidSerializer,
    JobMilestoneSerializer,
    JobDisputeSerializer,
    JobSpecRevisionSerializer,
)
from .permissions import IsEmployer, IsWorker
from .spam import moderation_status_for_new_job
from workhub.notify import push_to_user


def _response_if_job_not_accepting_applications(job):
    if job.assigned_to_id is not None:
        return Response(
            {
                "detail": "Исполнитель уже выбран. Новые отклики и ставки по этому заданию не принимаются.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    if job.status != Job.Status.OPEN:
        return Response(
            {"detail": "По этому заданию больше нельзя откликнуться."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


class JobViewSet(viewsets.ModelViewSet):

    queryset = Job.objects.all().select_related("employer", "assigned_to")
    serializer_class = JobSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    throttle_classes = [AnonRateThrottle, UserRateThrottle, ScopedRateThrottle]

    def check_throttles(self, request):
        # create и apply/bid — отдельные scope в REST_FRAMEWORK
        self.throttle_scope = None
        action_name = None
        if hasattr(self, "action_map"):
            action_name = self.action_map.get(request.method.lower())
        if action_name == "create" and request.method == "POST":
            self.throttle_scope = "job_create"
        elif action_name in ("apply", "bid") and request.method == "POST":
            self.throttle_scope = "job_apply"
        super().check_throttles(request)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == Job.Status.COMPLETED:
            from reviews.publication import sync_job_review_publication

            sync_job_review_publication(instance)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def get_permissions(self):
        if self.action in ["create"]:
            return [IsAuthenticated(), IsEmployer()]
        if self.action in [
            "update",
            "partial_update",
            "destroy",
            "assign",
            "set_status",
            "approve_submission",
            "reject_submission",
            "release_assignee",
            "close_application",
            "pick_contest_winner",
        ]:
            return [IsAuthenticated(), IsEmployer()]
        if self.action in ["apply", "submit_result", "bid", "my_applications"]:
            return [IsAuthenticated(), IsWorker()]
        if self.action in [
            "milestones",
            "complete_milestone",
            "open_dispute",
            "resolve_dispute",
            "escalate_dispute",
            "spec_history",
            "disputes",
        ]:
            return [IsAuthenticated()]
        if self.action in ["arbitrate_dispute"]:
            return [IsAuthenticated(), IsArbitrator()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        request = self.request
        mod_ok = Q(moderation_status=Job.ModerationStatus.APPROVED)
        if request.user.is_authenticated:
            mod_ok |= Q(employer=request.user)
            if getattr(request.user, "is_arbitrator", False):
                mod_ok |= Q(disputes__status=JobDispute.Status.ESCALATED)
        qs = qs.filter(mod_ok).distinct()
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        budget_from = request.query_params.get("budget_from")
        if budget_from:
            try:
                qs = qs.filter(budget_max__gte=Decimal(budget_from))
            except (ValueError, ArithmeticError):
                pass
        budget_to = request.query_params.get("budget_to")
        if budget_to:
            try:
                qs = qs.filter(budget_min__lte=Decimal(budget_to))
            except (ValueError, ArithmeticError):
                pass
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category__iexact=category)
        categories = request.query_params.get("categories")
        if categories:
            category_values = [item.strip() for item in categories.split(",") if item.strip()]
            if category_values:
                category_query = Q()
                for item in category_values:
                    category_query |= Q(category__iexact=item)
                qs = qs.filter(category_query)
        subcategory = request.query_params.get("subcategory")
        if subcategory:
            qs = qs.filter(subcategory__iexact=subcategory)
        subcategories = request.query_params.get("subcategories")
        if subcategories:
            subcategory_values = [item.strip() for item in subcategories.split(",") if item.strip()]
            if subcategory_values:
                subcategory_query = Q()
                for item in subcategory_values:
                    subcategory_query |= Q(subcategory__iexact=item)
                qs = qs.filter(subcategory_query)
        country = request.query_params.get("country")
        if country and country != "all":
            qs = qs.filter(country__iexact=country)
        city = request.query_params.get("city")
        if city and city != "all":
            qs = qs.filter(city__iexact=city)
        location = request.query_params.get("location")
        if location:
            qs = qs.filter(location__icontains=location)
        if request.query_params.get("urgent"):
            qs = qs.filter(is_urgent=True)
        if request.query_params.get("without_assignee"):
            qs = qs.filter(assigned_to__isnull=True)
        mine = request.query_params.get("mine")
        if mine and request.user.is_authenticated:
            qs = qs.filter(employer=request.user)
        assigned = request.query_params.get("assigned")
        if assigned and request.user.is_authenticated:
            qs = qs.filter(assigned_to=request.user)
        if request.query_params.get("contest"):
            qs = qs.filter(is_contest=True)
        if request.query_params.get("exchange"):
            qs = qs.filter(is_exchange=True)
        job_type = request.query_params.get("type")
        if job_type == "order":
            qs = qs.filter(is_contest=False, is_exchange=False)
        elif job_type == "contest":
            qs = qs.filter(is_contest=True)
        elif job_type == "exchange":
            qs = qs.filter(is_exchange=True)
        user = request.user
        if user.is_authenticated and getattr(user, "role", None) == "worker":
            qs = qs.prefetch_related(
                Prefetch(
                    "applications",
                    queryset=JobApplication.objects.filter(worker=user).only(
                        "id",
                        "job_id",
                        "status",
                    ),
                    to_attr="_my_worker_application",
                )
            )
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        job = serializer.save(employer=self.request.user)
        job.moderation_status = moderation_status_for_new_job(job.title, job.description)
        job.save(update_fields=["moderation_status"])

    def perform_update(self, serializer):
        instance = self.get_object()
        old_desc = instance.description
        job = serializer.save()
        if old_desc != job.description and job.employer_id == self.request.user.id:
            JobSpecRevision.objects.create(
                job=job,
                previous_description=old_desc,
                edited_by=self.request.user,
            )

    @action(detail=True, methods=["post"])
    def apply(self, request, pk=None):
        job = self.get_object()
        blocked = _response_if_job_not_accepting_applications(job)
        if blocked is not None:
            return blocked
        serializer = JobApplicationSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            JobApplication.objects.create(
                job=job,
                worker=request.user,
                cover_letter=serializer.validated_data.get("cover_letter", ""),
                expected_budget=serializer.validated_data.get("expected_budget", 0),
            )
        except IntegrityError:
            return Response(
                {"detail": "Вы уже откликались на это задание"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"detail": "Отклик отправлен"}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"])
    def bid(self, request, pk=None):
        job = self.get_object()
        if not job.is_exchange:
            return Response({"detail": "Для этого задания торги не включены"}, status=status.HTTP_400_BAD_REQUEST)
        if request.method == "GET":
            # ставки видит только заказчик
            if job.employer != request.user:
                return Response(status=status.HTTP_403_FORBIDDEN)
            serializer = JobBidSerializer(job.bids.select_related("worker"), many=True)
            return Response(serializer.data)
        blocked = _response_if_job_not_accepting_applications(job)
        if blocked is not None:
            return blocked
        serializer = JobBidSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        bid, _ = JobBid.objects.update_or_create(
            job=job,
            worker=request.user,
            defaults={
                "amount": serializer.validated_data["amount"],
                "message": serializer.validated_data.get("message", ""),
            },
        )
        return Response(JobBidSerializer(bid).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def applications(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = JobApplicationSerializer(job.applications.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        application_id = request.data.get("application_id")
        application = get_object_or_404(JobApplication, pk=application_id, job=job)
        job.assigned_to = application.worker
        job.status = Job.Status.IN_PROGRESS
        job.save()
        application.status = JobApplication.Status.ACCEPTED
        application.save()
        JobApplication.objects.filter(job=job).exclude(pk=application.pk).update(
            status=JobApplication.Status.REJECTED
        )
        push_to_user(
            application.worker_id,
            {"event": "worker_assigned", "job_id": job.id, "job_title": job.title},
        )
        return Response({"detail": "Исполнитель назначен"})

    @action(detail=True, methods=["post"])
    def submit_result(self, request, pk=None):
        job = self.get_object()
        if job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if job.status in (Job.Status.COMPLETED, Job.Status.CANCELLED, Job.Status.DISPUTED):
            return Response(
                {"detail": "Сейчас нельзя отправить результат по этому заданию."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content_type = (request.content_type or "").lower()
        if "multipart/form-data" in content_type:
            from django.core.files.storage import default_storage
            from django.utils.text import get_valid_filename

            message = (request.POST.get("message") or "").strip()
            url_part = (request.POST.get("deliverable_url") or "").strip()
            files = list(request.FILES.getlist("deliverable_file"))
            if not files and request.FILES.get("deliverable_file"):
                files = [request.FILES["deliverable_file"]]
            max_files = 8
            max_bytes = 10 * 1024 * 1024
            files = files[:max_files]

            if not message and not files and not url_part:
                return Response(
                    {"detail": "Укажите описание результата, ссылку или прикрепите файл."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            parts = []
            if url_part:
                parts.append(url_part)

            for f in files:
                if getattr(f, "size", 0) > max_bytes:
                    return Response(
                        {"detail": f"Файл «{getattr(f, 'name', '') or 'файл'}» больше 10 МБ."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                fname = get_valid_filename(f.name or "file")
                path = default_storage.save(
                    f"submission_deliverables/{job.id}_{request.user.id}_{fname}",
                    f,
                )
                rel = default_storage.url(path)
                full = rel if rel.startswith("http") else request.build_absolute_uri(rel)
                parts.append(full)

            if not message:
                if files:
                    message = "Материалы во вложении."
                elif url_part:
                    message = "Материалы по ссылке ниже."
                else:
                    message = "Результат отправлен."

            deliverable_combined = "\n".join(parts) if parts else ""
            submission = WorkSubmission.objects.create(
                job=job,
                worker=request.user,
                message=message,
                deliverable_url=deliverable_combined,
            )
        else:
            serializer = WorkSubmissionSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            submission = WorkSubmission.objects.create(
                job=job,
                worker=request.user,
                message=serializer.validated_data["message"],
                deliverable_url=serializer.validated_data.get("deliverable_url", ""),
            )

        job.status = Job.Status.SUBMITTED
        job.save()
        JobStatusUpdate.objects.create(
            job=job,
            status=Job.Status.SUBMITTED,
            note="Исполнитель отправил результат",
            created_by=request.user,
        )
        if job.employer_id:
            push_to_user(
                job.employer_id,
                {"event": "work_submitted", "job_id": job.id, "job_title": job.title},
            )
        return Response(
            WorkSubmissionSerializer(submission).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        status_value = request.data.get("status")
        if status_value not in Job.Status.values:
            return Response({"detail": "Неверный статус"}, status=status.HTTP_400_BAD_REQUEST)
        if job.status != status_value:
            job.status = status_value
            job.save()
            JobStatusUpdate.objects.create(
                job=job,
                status=status_value,
                note=request.data.get("note", ""),
                created_by=request.user,
            )
        return Response(JobSerializer(job).data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def updates(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user and job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = JobStatusUpdateSerializer(job.updates.all(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def submissions(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user and job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        queryset = job.submissions.select_related("worker")
        serializer = WorkSubmissionSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def approve_submission(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        submission_id = request.data.get("submission_id")
        submission = get_object_or_404(WorkSubmission, pk=submission_id, job=job)
        if submission.status != WorkSubmission.Status.SENT:
            return Response(
                {"detail": "Эту версию результата уже нельзя принять таким способом."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        transfer_amount = job.budget_max or job.budget_min or Decimal("0")
        if transfer_amount and job.assigned_to:
            employer_profile = job.employer.profile
            if employer_profile.demo_balance < transfer_amount:
                return Response(
                    {
                        "detail": (
                            "Недостаточно средств на демо-балансе для оплаты исполнителю "
                            f"(нужно {transfer_amount} ₽). Пополните баланс или скорректируйте бюджет задания."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        submission.status = WorkSubmission.Status.APPROVED
        submission.save(update_fields=["status"])
        job.status = Job.Status.COMPLETED
        job.completed_at = timezone.now()
        job.save(update_fields=["status", "completed_at"])
        if transfer_amount and job.assigned_to:
            employer_profile = job.employer.profile
            worker_profile = job.assigned_to.profile
            employer_profile.demo_balance -= transfer_amount
            worker_profile.demo_balance += transfer_amount
            employer_profile.save(update_fields=["demo_balance"])
            worker_profile.save(update_fields=["demo_balance"])
        JobStatusUpdate.objects.create(
            job=job,
            status=Job.Status.COMPLETED,
            note="Работа проверена и принята",
            created_by=request.user,
        )
        return Response({"detail": "Результат принят, задание завершено"})

    @action(detail=True, methods=["post"])
    def reject_submission(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if job.status != Job.Status.SUBMITTED:
            return Response(
                {"detail": "Вернуть на доработку можно только пока результат на проверке."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        submission_id = request.data.get("submission_id")
        submission = get_object_or_404(WorkSubmission, pk=submission_id, job=job)
        if not job.assigned_to_id or submission.worker_id != job.assigned_to_id:
            return Response(
                {"detail": "Эта сдача не от текущего исполнителя."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if submission.status != WorkSubmission.Status.SENT:
            return Response(
                {"detail": "Эта версия уже обработана."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        feedback = (request.data.get("feedback") or request.data.get("note") or "").strip()
        submission.status = WorkSubmission.Status.NEEDS_CHANGES
        submission.save(update_fields=["status"])
        job.status = Job.Status.IN_PROGRESS
        job.save(update_fields=["status"])
        note = "На доработку"
        if feedback:
            note = f"На доработку: {feedback}"[:240]
        JobStatusUpdate.objects.create(
            job=job,
            status=Job.Status.IN_PROGRESS,
            note=note,
            created_by=request.user,
        )
        if job.assigned_to_id:
            push_to_user(
                job.assigned_to_id,
                {"event": "revision_requested", "job_id": job.id, "job_title": job.title},
            )
        return Response(JobSerializer(job, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def release_assignee(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not job.assigned_to_id:
            return Response({"detail": "Исполнитель не назначен."}, status=status.HTTP_400_BAD_REQUEST)
        if job.status not in (Job.Status.IN_PROGRESS, Job.Status.SUBMITTED):
            return Response(
                {"detail": "В текущем статусе нельзя отказаться от исполнителя таким способом."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        former = job.assigned_to
        former_id = job.assigned_to_id
        WorkSubmission.objects.filter(job=job, worker_id=former_id).delete()
        job.assigned_to = None
        job.status = Job.Status.OPEN
        job.save(update_fields=["assigned_to", "status"])
        JobApplication.objects.filter(job=job, worker=former).update(status=JobApplication.Status.REJECTED)
        JobApplication.objects.filter(job=job).exclude(worker=former).update(status=JobApplication.Status.SENT)
        JobStatusUpdate.objects.create(
            job=job,
            status=Job.Status.OPEN,
            note="Заказчик отказался от исполнителя; поиск исполнителя снова открыт",
            created_by=request.user,
        )
        if former_id:
            push_to_user(
                former_id,
                {"event": "released_from_job", "job_id": job.id, "job_title": job.title},
            )
        return Response(JobSerializer(job, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def close_application(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        application_id = request.data.get("application_id")
        application = get_object_or_404(JobApplication, pk=application_id, job=job)
        application.status = JobApplication.Status.REJECTED
        application.save(update_fields=["status"])
        return Response({"detail": "Отклик закрыт"})

    @action(detail=True, methods=["post"])
    def pick_contest_winner(self, request, pk=None):
        job = self.get_object()
        if not job.is_contest:
            return Response({"detail": "Режим розыгрыша не включен"}, status=status.HTTP_400_BAD_REQUEST)
        if job.employer != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        candidates = list(job.applications.filter(status=JobApplication.Status.SENT))
        if not candidates:
            return Response({"detail": "Нет кандидатов для розыгрыша"}, status=status.HTTP_400_BAD_REQUEST)
        winner_application = random.choice(candidates)
        job.assigned_to = winner_application.worker
        job.status = Job.Status.IN_PROGRESS
        job.save(update_fields=["assigned_to", "status"])
        winner_application.status = JobApplication.Status.ACCEPTED
        winner_application.save(update_fields=["status"])
        JobApplication.objects.filter(job=job).exclude(pk=winner_application.pk).update(
            status=JobApplication.Status.REJECTED
        )
        JobStatusUpdate.objects.create(
            job=job,
            status=Job.Status.IN_PROGRESS,
            note="Исполнитель выбран через розыгрыш",
            created_by=request.user,
        )
        push_to_user(
            winner_application.worker_id,
            {"event": "worker_assigned", "job_id": job.id, "job_title": job.title},
        )
        return Response(
            {
                "detail": "Исполнитель выбран случайно",
                "winner": JobApplicationSerializer(winner_application).data,
            }
        )

    @action(detail=True, methods=["get", "post"])
    def milestones(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user and job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if request.method == "GET":
            ser = JobMilestoneSerializer(job.milestones.all(), many=True)
            return Response(ser.data)
        if job.employer != request.user:
            return Response(
                {"detail": "Добавлять этапы может только заказчик."},
                status=status.HTTP_403_FORBIDDEN,
            )
        ser = JobMilestoneSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        m = JobMilestone.objects.create(job=job, **ser.validated_data)
        return Response(JobMilestoneSerializer(m).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def complete_milestone(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user and job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        mid = request.data.get("milestone_id")
        m = get_object_or_404(JobMilestone, pk=mid, job=job)
        m.is_completed = True
        m.completed_at = timezone.now()
        m.save(update_fields=["is_completed", "completed_at"])
        return Response(JobMilestoneSerializer(m).data)

    @action(detail=True, methods=["get"])
    def spec_history(self, request, pk=None):
        job = self.get_object()
        if job.employer != request.user and job.assigned_to != request.user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        ser = JobSpecRevisionSerializer(job.spec_revisions.all(), many=True)
        return Response(ser.data)

    @action(detail=True, methods=["get"])
    def disputes(self, request, pk=None):
        job = self.get_object()
        allowed = job.employer == request.user or job.assigned_to == request.user
        if (
            not allowed
            and getattr(request.user, "is_arbitrator", False)
            and job.disputes.filter(status=JobDispute.Status.ESCALATED).exists()
        ):
            allowed = True
        if not allowed:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(JobDisputeSerializer(job.disputes.all(), many=True).data)

    @action(detail=True, methods=["post"])
    def open_dispute(self, request, pk=None):
        job = self.get_object()
        if request.user not in (job.employer, job.assigned_to):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if job.status not in (Job.Status.IN_PROGRESS, Job.Status.SUBMITTED):
            return Response(
                {"detail": "Спор можно открыть только для задания в работе или на проверке."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if job.disputes.filter(
            status__in=[JobDispute.Status.OPEN, JobDispute.Status.ESCALATED],
        ).exists():
            return Response(
                {"detail": "По этому заданию уже есть активный спор."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        summary = (request.data.get("summary") or "").strip()
        if not summary:
            return Response({"detail": "Опишите суть спора."}, status=status.HTTP_400_BAD_REQUEST)
        prev = job.status
        JobDispute.objects.create(
            job=job,
            opened_by=request.user,
            summary=summary,
            previous_job_status=prev,
        )
        job.status = Job.Status.DISPUTED
        job.save(update_fields=["status"])
        return Response({"detail": "Спор открыт. Согласуйте решение со второй стороной и закройте спор."})

    @action(detail=True, methods=["post"])
    def resolve_dispute(self, request, pk=None):
        job = self.get_object()
        if request.user not in (job.employer, job.assigned_to):
            return Response(status=status.HTTP_403_FORBIDDEN)
        dispute = job.disputes.filter(status=JobDispute.Status.OPEN).order_by("-created_at").first()
        if not dispute:
            return Response({"detail": "Нет спора, который можно закрыть по соглашению сторон."}, status=status.HTTP_400_BAD_REQUEST)
        resolution = (request.data.get("resolution") or "").strip()
        if not resolution:
            return Response(
                {"detail": "Укажите итог спора (как договорились продолжить)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dispute.status = JobDispute.Status.RESOLVED
        dispute.resolution = resolution
        dispute.resolved_at = timezone.now()
        dispute.save(update_fields=["status", "resolution", "resolved_at"])
        if dispute.previous_job_status:
            job.status = dispute.previous_job_status
            job.save(update_fields=["status"])
        return Response({"detail": "Спор закрыт, статус задания восстановлен."})

    @action(detail=True, methods=["post"])
    def escalate_dispute(self, request, pk=None):
        job = self.get_object()
        if request.user not in (job.employer, job.assigned_to):
            return Response(status=status.HTTP_403_FORBIDDEN)
        dispute = job.disputes.filter(status=JobDispute.Status.OPEN).order_by("-created_at").first()
        if not dispute:
            return Response(
                {"detail": "Нет открытого спора для передачи арбитру."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dispute.status = JobDispute.Status.ESCALATED
        dispute.escalated_at = timezone.now()
        dispute.save(update_fields=["status", "escalated_at"])
        return Response({"detail": "Спор передан арбитру. Ожидайте решения."})

    @action(detail=True, methods=["post"])
    def arbitrate_dispute(self, request, pk=None):
        job = self.get_object()
        dispute = job.disputes.filter(status=JobDispute.Status.ESCALATED).order_by("-created_at").first()
        if not dispute:
            return Response({"detail": "Нет спора на арбитраже."}, status=status.HTTP_400_BAD_REQUEST)
        decision = (request.data.get("decision") or "").strip()
        if not decision:
            return Response({"detail": "Укажите решение арбитра."}, status=status.HTTP_400_BAD_REQUEST)
        dispute.status = JobDispute.Status.RESOLVED
        dispute.arbitrator = request.user
        dispute.arbitrator_decision = decision
        dispute.resolution = decision
        dispute.resolved_at = timezone.now()
        dispute.save(
            update_fields=[
                "status",
                "arbitrator",
                "arbitrator_decision",
                "resolution",
                "resolved_at",
            ],
        )
        if dispute.previous_job_status:
            job.status = dispute.previous_job_status
            job.save(update_fields=["status"])
        return Response({"detail": "Решение арбитра зафиксировано, задание выведено из спора."})

    @action(detail=False, methods=["get"], url_path="my-applications")
    def my_applications(self, request):
        apps = (
            JobApplication.objects.filter(worker=request.user)
            .select_related(
                "job",
                "job__employer",
                "job__employer__profile",
                "job__assigned_to",
                "job__assigned_to__profile",
            )
            .prefetch_related("job__applications", "job__submissions")
            .order_by("-created_at")
        )
        data = []
        for app in apps:
            payload = JobSerializer(app.job, context={"request": request}).data
            payload["application_id"] = app.id
            payload["application_status"] = app.status
            payload["cover_letter"] = app.cover_letter
            payload["expected_budget"] = str(app.expected_budget)
            payload["applied_at"] = app.created_at.isoformat()
            data.append(payload)
        return Response(data)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def dashboard(self, request):
        job_qs = Job.objects.select_related(
            "employer",
            "employer__profile",
            "assigned_to",
            "assigned_to__profile",
        ).prefetch_related("applications", "submissions")
        jobs_owned = JobSerializer(
            job_qs.filter(employer=request.user),
            many=True,
            context={"request": request},
        ).data
        jobs_assigned = JobSerializer(
            job_qs.filter(assigned_to=request.user),
            many=True,
            context={"request": request},
        ).data
        applied_jobs = []
        for app in (
            JobApplication.objects.filter(worker=request.user)
            .select_related(
                "job",
                "job__employer",
                "job__employer__profile",
                "job__assigned_to",
                "job__assigned_to__profile",
            )
            .prefetch_related("job__applications", "job__submissions")
            .order_by("-created_at")
        ):
            payload = JobSerializer(app.job, context={"request": request}).data
            payload["my_application_status"] = app.status
            applied_jobs.append(payload)
        return Response(
            {
                "owned": jobs_owned,
                "assigned": jobs_assigned,
                "applied": applied_jobs,
            }
        )

