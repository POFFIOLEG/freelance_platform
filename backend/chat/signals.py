from django.db.models.signals import post_save
from django.dispatch import receiver

from workhub.notify import push_to_user

from .models import Message


@receiver(post_save, sender=Message)
def notify_chat_recipients(sender, instance, created, **kwargs):
    if not created:
        return
    job = instance.job
    recipients = {job.employer_id, job.assigned_to_id} - {None, instance.sender_id}
    for uid in recipients:
        push_to_user(
            uid,
            {"event": "chat_message", "job_id": job.id, "message_id": instance.id},
        )
