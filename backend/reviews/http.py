"""HTTP-утилиты для антифрода (IP; устройство и платёжный метод — при появлении данных)."""


def get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()[:45]
    ip = request.META.get("REMOTE_ADDR")
    return ip[:45] if ip else None
