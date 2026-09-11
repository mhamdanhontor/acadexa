"""PDF report generation using ReportLab (requirement #33)."""
import os
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.config import settings


def _ensure_reports_dir() -> str:
    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    return settings.REPORTS_DIR


def generate_monthly_attendance_pdf(
    academy_name: str,
    student_name: str,
    student_code: str,
    period_start: date,
    period_end: date,
    stats: dict,
    report_id: int,
) -> str:
    reports_dir = _ensure_reports_dir()
    file_name = f"monthly_attendance_{report_id}.pdf"
    file_path = os.path.join(reports_dir, file_name)

    doc = SimpleDocTemplate(file_path, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(academy_name, styles["Title"]))
    elements.append(Paragraph("Monthly Attendance Report", styles["Heading2"]))
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(Paragraph(f"Student: {student_name} ({student_code})", styles["Normal"]))
    elements.append(Paragraph(f"Period: {period_start} to {period_end}", styles["Normal"]))
    elements.append(Spacer(1, 0.5 * cm))

    data = [
        ["Metric", "Value"],
        ["Total Classes", str(stats.get("total_classes", 0))],
        ["Present", str(stats.get("present", 0))],
        ["Absent", str(stats.get("absent", 0))],
        ["Late", str(stats.get("late", 0))],
        ["Leave", str(stats.get("leave", 0))],
        ["Attendance Percentage", f"{stats.get('percentage', 0)}%"],
    ]
    table = Table(data, colWidths=[8 * cm, 6 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(table)

    doc.build(elements)
    return file_path


def generate_test_result_pdf(
    academy_name: str,
    test_name: str,
    subject_name: str,
    test_date: date,
    total_marks: float,
    rows: list[dict],
    file_suffix: str,
) -> str:
    """rows: list of {student_name, obtained_marks, percentage, grade}"""
    reports_dir = _ensure_reports_dir()
    file_name = f"test_result_{file_suffix}.pdf"
    file_path = os.path.join(reports_dir, file_name)

    doc = SimpleDocTemplate(file_path, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph(academy_name, styles["Title"]),
        Paragraph(f"Test Result: {test_name} ({subject_name})", styles["Heading2"]),
        Paragraph(f"Date: {test_date} | Total Marks: {total_marks}", styles["Normal"]),
        Spacer(1, 0.5 * cm),
    ]

    data = [["Student", "Obtained", "Percentage", "Grade"]]
    for row in rows:
        data.append(
            [row["student_name"], str(row["obtained_marks"]), f"{row['percentage']}%", row.get("grade", "")]
        )

    table = Table(data, colWidths=[7 * cm, 3 * cm, 3 * cm, 3 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(table)
    doc.build(elements)
    return file_path
