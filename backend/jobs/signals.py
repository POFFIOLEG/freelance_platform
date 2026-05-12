from django.db.models.signals import post_save
from django.dispatch import receiver

from workhub.notify import push_to_user

from .models import JobApplication


@receiver(post_save, sender=JobApplication)
def notify_employer_new_application(sender, instance, created, **kwargs):
    if not created:
        return
    job = instance.job
    if job.employer_id:
        push_to_user(
            job.employer_id,
            {"event": "new_application", "job_id": job.id, "application_id": instance.id},
        )
