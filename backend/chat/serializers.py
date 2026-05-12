from rest_framework import serializers



from accounts.serializers import UserSerializer

from .models import Message





class MessageSerializer(serializers.ModelSerializer):

    sender = UserSerializer(read_only=True)

    attachment = serializers.SerializerMethodField()

    attachments = serializers.SerializerMethodField()



    class Meta:

        model = Message

        fields = ["id", "job", "sender", "text", "attachment", "attachments", "created_at"]

        read_only_fields = ["job", "sender", "created_at"]



    def _abs_url(self, request, file_field):

        if not file_field:

            return None

        try:

            url = file_field.url

            return request.build_absolute_uri(url) if request else url

        except Exception:

            return None



    def get_attachment(self, obj):

        """Первый файл (совместимость со старыми клиентами)."""

        urls = self.get_attachments(obj)

        return urls[0] if urls else None



    def get_attachments(self, obj):

        request = self.context.get("request")

        out = []

        for row in obj.attachment_files.all().order_by("sort_order", "id"):

            u = self._abs_url(request, row.file)

            if u:

                out.append(u)

        if not out and obj.attachment:

            u = self._abs_url(request, obj.attachment)

            if u:

                out.append(u)

        return out


