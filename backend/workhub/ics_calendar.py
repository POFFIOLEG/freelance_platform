from __future__ import annotations

from datetime import datetime, timezone as dt_timezone
from typing import Iterable

from django.utils import timezone


def _ics_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def _fmt_utc(dt: datetime) -> str:
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    dt = dt.astimezone(dt_timezone.utc)
    return dt.strftime("%Y%m%dT%H%M%SZ")


def build_calendar_ics(
    *,
    milestones: Iterable,
    reminders: Iterable,
    cal_name: str = "Taskora",
) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Taskora//RU",
        "CALSCALE:GREGORIAN",
        f"X-WR-CALNAME:{_ics_escape(cal_name)}",
    ]
    now = _fmt_utc(timezone.now())

    for m in milestones:
        title = _ics_escape(getattr(m, "title", "") or "Этап")
        if getattr(m, "due_date", None):
            uid = f"milestone-{m.pk}@taskora"
            lines.extend(
                [
                    "BEGIN:VEVENT",
                    f"UID:{uid}",
                    f"DTSTAMP:{now}",
                    f"DTSTART;VALUE=DATE:{m.due_date.strftime('%Y%m%d')}",
                    f"SUMMARY:{title}",
                    "END:VEVENT",
                ]
            )

    for r in reminders:
        fire = getattr(r, "fire_at", None)
        if not fire:
            continue
        note = _ics_escape((getattr(r, "note", None) or "").strip() or "Напоминание")
        uid = f"reminder-{r.pk}@taskora"
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{now}",
                f"DTSTART:{_fmt_utc(fire)}",
                f"SUMMARY:{note}",
                f"DESCRIPTION:{_ics_escape('Задание #%s' % r.job_id)}",
                "END:VEVENT",
            ]
        )

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
