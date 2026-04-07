from rest_framework import serializers

from accounts.serializers import UserSerializer
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "job", "sender", "text", "created_at"]
        read_only_fields = ["job", "sender", "created_at"]

