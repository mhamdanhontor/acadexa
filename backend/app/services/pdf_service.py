"""PDF report generation using ReportLab (requirement #33)."""
import os
from datetime import date
from typing import Any, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

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
    tests_stats: Optional[dict] = None,
    student_details: Optional[dict] = None,
    daily_records: Optional[list[dict]] = None,
) -> str:
    """Generates an elegant, publication-quality A4 Monthly Progress Report PDF
    containing student credentials, complete monthly attendance (metrics + daily log),
    and all academic tests conducted in that month with scores, percentages and grades.
    """
    reports_dir = _ensure_reports_dir()
    file_name = f"monthly_attendance_{report_id}.pdf"
    file_path = os.path.join(reports_dir, file_name)

    doc = SimpleDocTemplate(
        file_path,
        pagesize=A4,
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=20,
        textColor=colors.HexColor("#1e1b4b"),
        alignment=1,  # Center
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#4338ca"),
        alignment=1,
    )
    period_style = ParagraphStyle(
        "ReportPeriod",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=4,
    )
    label_style = ParagraphStyle(
        "LabelStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#475569"),
    )
    value_style = ParagraphStyle(
        "ValueStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
    )
    code_badge_style = ParagraphStyle(
        "CodeBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=11,
        textColor=colors.HexColor("#4338ca"),
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
        alignment=1,
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
        alignment=0,
    )
    table_cell_center = ParagraphStyle(
        "TableCellCenter",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
        alignment=1,
    )
    kpi_title = ParagraphStyle(
        "KPITitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )
    kpi_val = ParagraphStyle(
        "KPIVal",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=15,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,
    )

    elements: list[Any] = []

    # 1. Header Banner
    elements.append(Paragraph(academy_name.upper(), title_style))
    elements.append(Paragraph("MONTHLY ACADEMIC & ATTENDANCE PROGRESS REPORT", subtitle_style))
    elements.append(
        Paragraph(
            f"Evaluation Period: <b>{period_start}</b> to <b>{period_end}</b>  ·  Official Report ID: #{report_id}",
            period_style,
        )
    )
    elements.append(Spacer(1, 0.25 * cm))

    # 2. Student Information Card
    details = student_details or {}
    class_name = details.get("class_name") or "—"
    batch_name = details.get("batch_name") or "—"
    guardian_name = details.get("guardian_name") or "Parent/Guardian"
    whatsapp_number = details.get("whatsapp_number") or "—"

    student_info_data = [
        [
            Paragraph("Student Name:", label_style),
            Paragraph(f"<b>{student_name}</b>", value_style),
            Paragraph("Student ID:", label_style),
            Paragraph(f"<b>{student_code}</b>", code_badge_style),
        ],
        [
            Paragraph("Class / Grade:", label_style),
            Paragraph(class_name, value_style),
            Paragraph("Batch / Shift:", label_style),
            Paragraph(batch_name, value_style),
        ],
        [
            Paragraph("Guardian Name:", label_style),
            Paragraph(guardian_name, value_style),
            Paragraph("WhatsApp Contact:", label_style),
            Paragraph(whatsapp_number, value_style),
        ],
    ]
    student_table = Table(student_info_data, colWidths=[3.2 * cm, 6.1 * cm, 3.2 * cm, 6.1 * cm])
    student_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(student_table)
    elements.append(Spacer(1, 0.35 * cm))

    # 3. Monthly Attendance Section
    elements.append(Paragraph("1. MONTHLY ATTENDANCE SUMMARY", section_heading))
    total_classes = stats.get("total_classes", 0)
    present_cnt = stats.get("present", 0)
    late_cnt = stats.get("late", 0)
    absent_cnt = stats.get("absent", 0)
    leave_cnt = stats.get("leave", 0)
    pct = stats.get("percentage", 0.0)

    # 5-Tile KPI block
    kpi_data = [
        [
            Paragraph("TOTAL CLASSES", kpi_title),
            Paragraph("PRESENT", kpi_title),
            Paragraph("LATE (PRESENT)", kpi_title),
            Paragraph("ABSENT", kpi_title),
            Paragraph("LEAVE", kpi_title),
        ],
        [
            Paragraph(str(total_classes), kpi_val),
            Paragraph(f"<font color='#059669'>{present_cnt}</font>", kpi_val),
            Paragraph(f"<font color='#d97706'>{late_cnt}</font>", kpi_val),
            Paragraph(f"<font color='#dc2626'>{absent_cnt}</font>", kpi_val),
            Paragraph(f"<font color='#2563eb'>{leave_cnt}</font>", kpi_val),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[3.72 * cm] * 5)
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    elements.append(kpi_table)

    # Attendance percentage highlight row
    perf_status = "Excellent" if pct >= 90 else ("Satisfactory" if pct >= 75 else "Needs Improvement")
    pct_banner_data = [
        [
            Paragraph(
                f"<b>Overall Attendance Rate:</b> <font color='#4338ca'><b>{pct}%</b></font>  "
                f"<i>(Late arrivals counted as present)</i>  ·  Status: <b>{perf_status}</b>",
                value_style,
            )
        ]
    ]
    pct_banner = Table(pct_banner_data, colWidths=[18.6 * cm])
    pct_banner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#e0e7ff")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#c7d2fe")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(pct_banner)

    # Optional Compact Daily Attendance Log (placed in 2 parallel sub-columns if records exist)
    if daily_records and len(daily_records) > 0:
        elements.append(Spacer(1, 0.15 * cm))
        mid = (len(daily_records) + 1) // 2
        left_recs = daily_records[:mid]
        right_recs = daily_records[mid:]

        daily_rows = [
            [
                Paragraph("Date", table_header),
                Paragraph("Day", table_header),
                Paragraph("Status", table_header),
                Paragraph("Date", table_header),
                Paragraph("Day", table_header),
                Paragraph("Status", table_header),
            ]
        ]

        def _fmt_status(s: str) -> str:
            if s == "PRESENT":
                return "<font color='#059669'><b>Present</b></font>"
            elif s == "LATE":
                return "<font color='#d97706'><b>Late</b></font>"
            elif s == "ABSENT":
                return "<font color='#dc2626'><b>Absent</b></font>"
            elif s == "LEAVE":
                return "<font color='#2563eb'><b>Leave</b></font>"
            return s

        for i in range(mid):
            l = left_recs[i] if i < len(left_recs) else None
            r = right_recs[i] if i < len(right_recs) else None
            row = [
                Paragraph(l["date"] if l else "", table_cell_center),
                Paragraph(l["day"] if l else "", table_cell_center),
                Paragraph(_fmt_status(l["status"]) if l else "", table_cell_center),
                Paragraph(r["date"] if r else "", table_cell_center),
                Paragraph(r["day"] if r else "", table_cell_center),
                Paragraph(_fmt_status(r["status"]) if r else "", table_cell_center),
            ]
            daily_rows.append(row)

        daily_table = Table(
            daily_rows,
            colWidths=[3.1 * cm, 2.5 * cm, 3.7 * cm, 3.1 * cm, 2.5 * cm, 3.7 * cm],
        )
        daily_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f8fafc")],
                    ),
                ]
            )
        )
        elements.append(daily_table)

    elements.append(Spacer(1, 0.35 * cm))

    # 4. Monthly Academic Tests Performance Section
    elements.append(Paragraph("2. MONTHLY TESTS & ACADEMIC EVALUATION", section_heading))
    t_stats = tests_stats or {}
    test_items = t_stats.get("tests", [])

    if test_items:
        test_rows = [
            [
                Paragraph("Test Name", table_header),
                Paragraph("Subject", table_header),
                Paragraph("Date", table_header),
                Paragraph("Max Marks", table_header),
                Paragraph("Obtained", table_header),
                Paragraph("Score %", table_header),
                Paragraph("Grade", table_header),
            ]
        ]
        for t in test_items:
            obt = str(t.get("obtained_marks")) if t.get("obtained_marks") is not None else "—"
            p = f"{t.get('percentage')}%" if t.get("percentage") is not None else "—"
            g = t.get("grade") or "—"
            test_rows.append(
                [
                    Paragraph(t.get("test_name", "—"), table_cell),
                    Paragraph(t.get("subject", "—"), table_cell),
                    Paragraph(str(t.get("test_date", "—")), table_cell_center),
                    Paragraph(str(t.get("total_marks", "—")), table_cell_center),
                    Paragraph(f"<b>{obt}</b>", table_cell_center),
                    Paragraph(f"<b>{p}</b>", table_cell_center),
                    Paragraph(f"<b>{g}</b>", table_cell_center),
                ]
            )

        # Summary Row
        overall_pct = t_stats.get("overall_percentage", 0.0)
        overall_grd = t_stats.get("overall_grade", "—")
        tot_max = t_stats.get("total_max_marks", 0.0)
        tot_obt = t_stats.get("total_obtained_marks", 0.0)
        tot_tests = t_stats.get("total_tests", len(test_items))

        summary_p = Paragraph(
            f"<b>ACADEMIC SUMMARY:</b> Tests Taken: <b>{tot_tests}</b>  |  "
            f"Marks: <b>{tot_obt} / {tot_max}</b>  |  "
            f"Average Score: <font color='#4338ca'><b>{overall_pct}%</b></font>  |  "
            f"Overall Grade: <font color='#059669'><b>{overall_grd}</b></font>",
            label_style,
        )

        tests_table = Table(
            test_rows,
            colWidths=[4.1 * cm, 3.5 * cm, 2.5 * cm, 2.1 * cm, 2.2 * cm, 2.1 * cm, 2.1 * cm],
        )
        tests_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e1b4b")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f8fafc")],
                    ),
                ]
            )
        )
        elements.append(tests_table)

        summary_table = Table([[summary_p]], colWidths=[18.6 * cm])
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ede9fe")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd6fe")),
                    ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        elements.append(summary_table)
    else:
        no_tests_table = Table(
            [[Paragraph("<i>No academic tests were scheduled or conducted during this monthly period.</i>", value_style)]],
            colWidths=[18.6 * cm],
        )
        no_tests_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(no_tests_table)

    elements.append(Spacer(1, 0.35 * cm))

    # 5. Teacher Remarks Box
    elements.append(Paragraph("3. ACADEMIC REMARKS & OBSERVATIONS", section_heading))
    remarks_text = (
        "Demonstrates good classroom engagement and diligence. Regular attendance and sustained focus on "
        "practice tests will continue to yield strong academic progress."
    )
    remarks_table = Table([[Paragraph(remarks_text, value_style)]], colWidths=[18.6 * cm])
    remarks_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    elements.append(remarks_table)
    elements.append(Spacer(1, 0.45 * cm))

    # 6. Official Signatures Block
    sig_data = [
        [
            Paragraph("____________________________<br/><b>Class Teacher</b>", table_cell_center),
            Paragraph("____________________________<br/><b>Academic Incharge</b>", table_cell_center),
            Paragraph("____________________________<br/><b>Principal / Director</b>", table_cell_center),
        ]
    ]
    sig_table = Table(sig_data, colWidths=[6.2 * cm, 6.2 * cm, 6.2 * cm])
    sig_table.setStyle(
        TableStyle(
            [
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(sig_table)
    elements.append(Spacer(1, 0.2 * cm))

    # Footer note
    footer_p = Paragraph(
        f"This is an official computer-generated monthly progress report issued by {academy_name}. "
        f"Generated on {date.today().isoformat()}.",
        period_style,
    )
    elements.append(footer_p)

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
