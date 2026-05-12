"""Экспорт этапов и напоминаний в Excel (.xlsx)."""
from __future__ import annotations

from io import BytesIO
from typing import Iterable

from openpyxl import Workbook
from openpyxl.styles import Font


def build_calendar_xlsx_bytes(*, milestones: Iterable, reminders: Iterable) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Календарь"
    headers = ("Тип", "Заголовок", "Дата / время", "Задание ID", "Примечание")
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True)

    for m in milestones:
        title = (getattr(m, "title", None) or "").strip() or "Этап"
        due = getattr(m, "due_date", None)
        due_s = due.strftime("%Y-%m-%d") if due else ""
        ws.append(("Этап", title, due_s, getattr(m, "job_id", "") or "", ""))

    for r in reminders:
        fire = getattr(r, "fire_at", None)
        if not fire:
            continue
        note = (getattr(r, "note", None) or "").strip() or "Напоминание"
        fire_s = fire.strftime("%Y-%m-%d %H:%M") if fire else ""
        ws.append(("Напоминание", note, fire_s, getattr(r, "job_id", "") or "", ""))

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
