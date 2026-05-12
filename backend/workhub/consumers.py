import json

from channels.generic.websocket import AsyncWebsocketConsumer


class NotifyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        if not user.is_authenticated:
            await self.close()
            return
        self.group_name = f"user_{user.id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notify_event(self, event):
        payload = {k: v for k, v in event.items() if k != "type"}
        await self.send(text_data=json.dumps(payload, default=str))
