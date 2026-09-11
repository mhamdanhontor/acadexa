"""Excel/CSV export using openpyxl (requirement #34)."""
import os
from datetime import datetime
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

from app.core.config import settings


def _style_header(ws, num_cols: int):
    header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    for col in range(1, num_cols + 1):
        cell = ws.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font


def export_students_to_excel(students: list) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Students"
    headers = ["Student ID", "Name", "Guardian", "WhatsApp", "Class", "Batch", "Status", "Admission Date"]
    ws.append(headers)
    _style_header(ws, len(headers))

    for s in students:
        ws.append(
            [
                s.student_code,
                s.name,
                s.guardian_name or "",
                s.whatsapp_number,
                s.class_room.name if s.class_room else "",
                s.batch.name if s.batch else "",
                "Active" if s.is_active else "Inactive",
                s.admission_date.isoformat() if s.admission_date else "",
            ]
        )

    for col in ws.columns:
        max_len = max((len(str(c.value)) for c in col if c.value), default=10)
        ws.column_dimensions[col[0].column_letter].width = max_len + 4

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def export_attendance_to_excel(attendance_rows: list) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Attendance"
    headers = ["Date", "Student ID", "Status", "Class ID", "Batch ID"]
    ws.append(headers)
    _style_header(ws, len(headers))

    for a in attendance_rows:
        ws.append([a.date.isoformat(), a.student_id, a.status.value, a.class_id, a.batch_id])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def export_marks_to_excel(marks_rows: list) -> BytesIO:
    wb = Workbook()
    ws = wb.active
    ws.title = "Marks"
    headers = ["Student ID", "Test ID", "Obtained", "Total", "Percentage", "Grade"]
    ws.append(headers)
    _style_header(ws, len(headers))

    for m in marks_rows:
        ws.append([m.student_id, m.test_id, m.obtained_marks, m.total_marks, m.percentage, m.grade or ""])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
