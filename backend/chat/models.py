from django.conf import settings

from django.db import models



from jobs.models import Job





class Message(models.Model):

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="messages")

    sender = models.ForeignKey(

        settings.AUTH_USER_MODEL,

        on_delete=models.CASCADE,

        related_name="messages",

    )

    text = models.TextField(blank=True)

    attachment = models.FileField(upload_to="chat_attachments/", blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)



    class Meta:

        ordering = ["created_at"]





class MessageAttachment(models.Model):

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="attachment_files")

    file = models.FileField(upload_to="chat_attachments/")

    sort_order = models.PositiveSmallIntegerField(default=0)



    class Meta:

        ordering = ["sort_order", "id"]

