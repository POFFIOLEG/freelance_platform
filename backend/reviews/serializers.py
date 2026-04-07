from rest_framework import serializers

from accounts.serializers import UserSerializer
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserSerializer(read_only=True)
    reviewee = UserSerializer(read_only=True)

    class Meta:
        model = Review
        fields = ["id", "job", "reviewer", "reviewee", "rating", "comment", "created_at"]
        read_only_fields = ["reviewer", "reviewee"]

