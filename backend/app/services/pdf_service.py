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
    path = os.path.abspath(settings.REPORTS_DIR)
    os.makedirs(path, exist_ok=True)
    return path


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
    previous_months: Optional[list[dict]] = None,
) -> str:
    """Generates an eye-catching, colorful, publication-quality A4 Monthly Progress Report PDF
    containing student credentials, complete monthly attendance (colored metrics + daily calendar),
    and all academic tests conducted in that month with scores, percentages, grades and 6-month historical track record.
    """
    stats = stats or {}
    tests_stats = tests_stats or {}
    student_details = student_details or {}
    daily_records = daily_records or []
    previous_months = previous_months or []

    reports_dir = _ensure_reports_dir()
    file_name = f"monthly_attendance_{report_id}.pdf"
    file_path = os.path.join(reports_dir, file_name)

    doc = SimpleDocTemplate(
        file_path,
        pagesize=A4,
        leftMargin=1.1 * cm,
        rightMargin=1.1 * cm,
        topMargin=1.0 * cm,
        bottomMargin=1.0 * cm,
    )
    styles = getSampleStyleSheet()

    # Typography & Styles
    header_title_style = ParagraphStyle(
        "HeroTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.white,
        alignment=1,
    )
    header_sub_style = ParagraphStyle(
        "HeroSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor("#38bdf8"),  # Bright Sky Blue
        alignment=1,
    )
    header_period_style = ParagraphStyle(
        "HeroPeriod",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#e2e8f0"),
        alignment=1,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor("#1e1b4b"),
        spaceAfter=3,
    )
    label_style = ParagraphStyle(
        "LabelStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#475569"),
    )
    value_style = ParagraphStyle(
        "ValueStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=10.5,
        textColor=colors.HexColor("#0f172a"),
    )
    code_badge_style = ParagraphStyle(
        "CodeBadge",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=10.5,
        textColor=colors.HexColor("#4338ca"),
    )
    table_header = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=1,
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1e293b"),
        alignment=0,
    )
    table_cell_center = ParagraphStyle(
        "TableCellCenter",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#1e293b"),
        alignment=1,
    )
    kpi_title = ParagraphStyle(
        "KPITitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=8.5,
        alignment=1,
    )
    kpi_val = ParagraphStyle(
        "KPIVal",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=15,
        alignment=1,
    )

    elements: list[Any] = []

    # 1. Hero Header Banner
    header_data = [
        [
            Paragraph(f"<b>{academy_name.upper()}</b>", header_title_style),
        ],
        [
            Paragraph("MONTHLY STUDENT PROGRESS & ATTENDANCE REPORT", header_sub_style),
        ],
        [
            Paragraph(
                f"Evaluation Period: <b>{period_start}</b> to <b>{period_end}</b>  ·  Official Report ID: <b>#{report_id}</b>",
                header_period_style,
            ),
        ],
    ]
    header_table = Table(header_data, colWidths=[18.8 * cm])
    header_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1e1b4b")),  # Royal Navy / Dark Indigo
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
                ("TOPPADDING", (0, 1), (-1, 1), 1),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 2),
                ("TOPPADDING", (0, 2), (-1, 2), 1),
                ("BOTTOMPADDING", (0, 2), (-1, 2), 6),
            ]
        )
    )
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=2.5, color=colors.HexColor("#06b6d4"), spaceBefore=0, spaceAfter=5))

    # 2. Student Profile Card
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
    student_table = Table(student_info_data, colWidths=[3.2 * cm, 6.2 * cm, 3.2 * cm, 6.2 * cm])
    student_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#c7d2fe")),
                ("LINEBEFORE", (0, 0), (0, -1), 3.0, colors.HexColor("#4338ca")),  # Vibrant Indigo accent bar
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(student_table)
    elements.append(Spacer(1, 0.25 * cm))

    # 3. Monthly Attendance Section
    elements.append(Paragraph("<font color='#4338ca'>■</font> 1. MONTHLY ATTENDANCE SUMMARY", section_heading))
    total_classes = stats.get("total_classes", 0)
    present_cnt = stats.get("present", 0)
    late_cnt = stats.get("late", 0)
    absent_cnt = stats.get("absent", 0)
    leave_cnt = stats.get("leave", 0)
    pct = stats.get("percentage", 0.0)

    # 5-Tile Vibrant KPI Cards
    kpi_data = [
        [
            Paragraph("<font color='#475569'>TOTAL CLASSES</font>", kpi_title),
            Paragraph("<font color='#065f46'>PRESENT DAYS</font>", kpi_title),
            Paragraph("<font color='#92400e'>LATE (PRESENT)</font>", kpi_title),
            Paragraph("<font color='#991b1b'>ABSENT DAYS</font>", kpi_title),
            Paragraph("<font color='#075985'>APPROVED LEAVE</font>", kpi_title),
        ],
        [
            Paragraph(f"<font color='#0f172a'><b>{total_classes}</b></font>", kpi_val),
            Paragraph(f"<font color='#059669'><b>{present_cnt}</b></font>", kpi_val),
            Paragraph(f"<font color='#d97706'><b>{late_cnt}</b></font>", kpi_val),
            Paragraph(f"<font color='#dc2626'><b>{absent_cnt}</b></font>", kpi_val),
            Paragraph(f"<font color='#0284c7'><b>{leave_cnt}</b></font>", kpi_val),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[3.76 * cm] * 5)
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 1), colors.HexColor("#f8fafc")),
                ("BACKGROUND", (1, 0), (1, 1), colors.HexColor("#ecfdf5")),
                ("BACKGROUND", (2, 0), (2, 1), colors.HexColor("#fffbeb")),
                ("BACKGROUND", (3, 0), (3, 1), colors.HexColor("#fef2f2")),
                ("BACKGROUND", (4, 0), (4, 1), colors.HexColor("#f0f9ff")),
                ("BOX", (0, 0), (0, 1), 0.75, colors.HexColor("#cbd5e1")),
                ("BOX", (1, 0), (1, 1), 0.75, colors.HexColor("#a7f3d0")),
                ("BOX", (2, 0), (2, 1), 0.75, colors.HexColor("#fde68a")),
                ("BOX", (3, 0), (3, 1), 0.75, colors.HexColor("#fecaca")),
                ("BOX", (4, 0), (4, 1), 0.75, colors.HexColor("#bae6fd")),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    elements.append(kpi_table)

    # Attendance percentage highlight row
    if pct >= 90:
        rate_bg = "#ecfdf5"
        rate_border = "#a7f3d0"
        rate_tag = "<font color='#059669'><b>EXCELLENT ATTENDANCE</b></font>"
    elif pct >= 75:
        rate_bg = "#eff6ff"
        rate_border = "#bfdbfe"
        rate_tag = "<font color='#2563eb'><b>SATISFACTORY ATTENDANCE</b></font>"
    else:
        rate_bg = "#fffbeb"
        rate_border = "#fde68a"
        rate_tag = "<font color='#d97706'><b>NEEDS ATTENTION</b></font>"

    pct_banner_data = [
        [
            Paragraph(
                f"<b>Monthly Attendance Rate:</b> <font color='#4338ca'><b>{pct}%</b></font>  "
                f"<i>(Late arrivals counted as present)</i>  ·  Performance Rating: {rate_tag}",
                value_style,
            )
        ]
    ]
    pct_banner = Table(pct_banner_data, colWidths=[18.8 * cm])
    pct_banner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(rate_bg)),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor(rate_border)),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    elements.append(pct_banner)

    # Full Month Daily Attendance Log in 3 clean columns
    if daily_records and len(daily_records) > 0:
        elements.append(Spacer(1, 0.1 * cm))
        n = len(daily_records)
        col_len = (n + 2) // 3
        col1 = daily_records[0:col_len]
        col2 = daily_records[col_len:col_len * 2]
        col3 = daily_records[col_len * 2:]

        daily_rows = [
            [
                Paragraph("Date", table_header),
                Paragraph("Day", table_header),
                Paragraph("Status", table_header),
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
                return "<font color='#0284c7'><b>Leave</b></font>"
            elif s in ("SUNDAY", "WEEKEND"):
                return "<font color='#64748b'>Sunday</font>"
            elif s in ("OFF", "OFF DAY"):
                return "<font color='#94a3b8'>Off Day</font>"
            return s or "—"

        def _short_date(iso_d: Optional[str]) -> str:
            if not iso_d:
                return ""
            parts = iso_d.split("-")
            if len(parts) == 3:
                try:
                    m_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                    return f"{parts[2]}-{m_names[int(parts[1])]}"
                except Exception:
                    return iso_d
            return iso_d

        for i in range(col_len):
            c1 = col1[i] if i < len(col1) else None
            c2 = col2[i] if i < len(col2) else None
            c3 = col3[i] if i < len(col3) else None

            row = [
                Paragraph(_short_date(c1["date"]) if c1 else "", table_cell_center),
                Paragraph(c1["day"] if c1 else "", table_cell_center),
                Paragraph(_fmt_status(c1["status"]) if c1 else "", table_cell_center),

                Paragraph(_short_date(c2["date"]) if c2 else "", table_cell_center),
                Paragraph(c2["day"] if c2 else "", table_cell_center),
                Paragraph(_fmt_status(c2["status"]) if c2 else "", table_cell_center),

                Paragraph(_short_date(c3["date"]) if c3 else "", table_cell_center),
                Paragraph(c3["day"] if c3 else "", table_cell_center),
                Paragraph(_fmt_status(c3["status"]) if c3 else "", table_cell_center),
            ]
            daily_rows.append(row)

        daily_table = Table(
            daily_rows,
            colWidths=[2.15 * cm, 1.45 * cm, 2.66 * cm, 2.15 * cm, 1.45 * cm, 2.66 * cm, 2.15 * cm, 1.45 * cm, 2.66 * cm],
        )
        daily_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
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

    elements.append(Spacer(1, 0.22 * cm))

    # 4. Monthly Academic Tests Performance Section
    elements.append(Paragraph("<font color='#4338ca'>■</font> 2. MONTHLY TESTS & ACADEMIC EVALUATION", section_heading))
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

            if g in ("A+", "A"):
                grade_html = f"<font color='#059669'><b>{g}</b></font>"
            elif g == "B":
                grade_html = f"<font color='#2563eb'><b>{g}</b></font>"
            elif g == "C":
                grade_html = f"<font color='#d97706'><b>{g}</b></font>"
            elif g in ("D", "F"):
                grade_html = f"<font color='#dc2626'><b>{g}</b></font>"
            else:
                grade_html = g

            test_rows.append(
                [
                    Paragraph(t.get("test_name", "—"), table_cell),
                    Paragraph(t.get("subject", "—"), table_cell),
                    Paragraph(str(t.get("test_date", "—")), table_cell_center),
                    Paragraph(str(t.get("total_marks", "—")), table_cell_center),
                    Paragraph(f"<b>{obt}</b>", table_cell_center),
                    Paragraph(f"<b>{p}</b>", table_cell_center),
                    Paragraph(grade_html, table_cell_center),
                ]
            )

        overall_pct = t_stats.get("overall_percentage", 0.0)
        overall_grd = t_stats.get("overall_grade", "—")
        tot_max = t_stats.get("total_max_marks", 0.0)
        tot_obt = t_stats.get("total_obtained_marks", 0.0)
        tot_tests = t_stats.get("total_tests", len(test_items))

        tests_table = Table(
            test_rows,
            colWidths=[4.3 * cm, 3.5 * cm, 2.5 * cm, 2.1 * cm, 2.2 * cm, 2.1 * cm, 2.1 * cm],
        )
        tests_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#312e81")),  # Deep Violet / Indigo
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 2.2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
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

        summary_p = Paragraph(
            f"<b>ACADEMIC SUMMARY:</b> Tests Taken: <b>{tot_tests}</b>  |  "
            f"Marks: <b>{tot_obt} / {tot_max}</b>  |  "
            f"Average Score: <font color='#4338ca'><b>{overall_pct}%</b></font>  |  "
            f"Overall Grade: <font color='#059669'><b>{overall_grd}</b></font>",
            label_style,
        )
        summary_table = Table([[summary_p]], colWidths=[18.8 * cm])
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ede9fe")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#ddd6fe")),
                    ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(summary_table)
    else:
        no_tests_table = Table(
            [[Paragraph("<i>No academic tests were scheduled or conducted during this monthly period.</i>", value_style)]],
            colWidths=[18.8 * cm],
        )
        no_tests_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(no_tests_table)

    elements.append(Spacer(1, 0.22 * cm))

    # 5. Historical Track Record (Previous 6 Months)
    elements.append(Paragraph("<font color='#4338ca'>■</font> 3. HISTORICAL PERFORMANCE (PREVIOUS 6 MONTHS)", section_heading))
    if previous_months and any(m.get("has_data") for m in previous_months):
        hist_rows = [
            [
                Paragraph("Month", table_header),
                Paragraph("Attendance %", table_header),
                Paragraph("Classes (Pres/Tot)", table_header),
                Paragraph("Tests Taken", table_header),
                Paragraph("Avg Test Score", table_header),
                Paragraph("Grade", table_header),
                Paragraph("Performance Remarks", table_header),
            ]
        ]
        for m in previous_months:
            att_str = f"{m.get('attendance_pct')}%" if m.get("attendance_pct") is not None else "—"
            cls_str = f"{m.get('present_days', 0)} / {m.get('total_classes', 0)}" if m.get("total_classes", 0) > 0 else "—"
            t_taken = f"{m.get('tests_taken', 0)}" if m.get("tests_taken", 0) > 0 else "0"
            t_score = f"{m.get('test_pct')}%" if m.get("test_pct") is not None else "—"
            grd = m.get("grade") or "—"
            rem = m.get("remarks") or "—"

            if rem == "Excellent":
                rem_html = "<font color='#059669'><b>Excellent</b></font>"
            elif rem == "Very Good":
                rem_html = "<font color='#0d9488'><b>Very Good</b></font>"
            elif rem == "Good":
                rem_html = "<font color='#2563eb'><b>Good</b></font>"
            elif rem == "Satisfactory":
                rem_html = "<font color='#d97706'><b>Satisfactory</b></font>"
            elif rem == "Needs Attention":
                rem_html = "<font color='#dc2626'><b>Needs Attention</b></font>"
            else:
                rem_html = f"<font color='#64748b'>{rem}</font>"

            hist_rows.append(
                [
                    Paragraph(m.get("month", "—"), table_cell_center),
                    Paragraph(f"<b>{att_str}</b>", table_cell_center),
                    Paragraph(cls_str, table_cell_center),
                    Paragraph(t_taken, table_cell_center),
                    Paragraph(f"<b>{t_score}</b>", table_cell_center),
                    Paragraph(f"<b>{grd}</b>", table_cell_center),
                    Paragraph(rem_html, table_cell_center),
                ]
            )

        hist_table = Table(
            hist_rows,
            colWidths=[2.8 * cm, 2.8 * cm, 3.2 * cm, 2.2 * cm, 2.6 * cm, 2.3 * cm, 2.9 * cm],
        )
        hist_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#334155")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 2.0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2.0),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f8fafc")],
                    ),
                ]
            )
        )
        elements.append(hist_table)
    else:
        no_hist_table = Table(
            [[Paragraph("<i>No prior monthly academic or attendance records found (Initial enrollment period).</i>", value_style)]],
            colWidths=[18.8 * cm],
        )
        no_hist_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(no_hist_table)

    elements.append(Spacer(1, 0.22 * cm))

    # 6. Teacher Remarks Box
    elements.append(Paragraph("<font color='#4338ca'>■</font> 4. ACADEMIC REMARKS & OBSERVATIONS", section_heading))
    remarks_text = (
        "Demonstrates good classroom engagement and diligence. Regular attendance and sustained focus on "
        "practice tests will continue to yield strong academic progress."
    )
    remarks_table = Table([[Paragraph(remarks_text, value_style)]], colWidths=[18.8 * cm])
    remarks_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    elements.append(remarks_table)
    elements.append(Spacer(1, 0.3 * cm))

    # 7. Official Signatures Block
    sig_data = [
        [
            Paragraph("____________________________<br/><b>Class Teacher</b>", table_cell_center),
            Paragraph("____________________________<br/><b>Academic Incharge</b>", table_cell_center),
            Paragraph("____________________________<br/><b>Principal / Director</b>", table_cell_center),
        ]
    ]
    sig_table = Table(sig_data, colWidths=[6.26 * cm, 6.26 * cm, 6.26 * cm])
    sig_table.setStyle(
        TableStyle(
            [
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    elements.append(sig_table)
    elements.append(Spacer(1, 0.1 * cm))

    # Footer note
    footer_p = Paragraph(
        f"This is an official computer-generated monthly progress report issued by {academy_name}. "
        f"Generated on {date.today().isoformat()}.",
        header_period_style,
    )
    footer_table = Table([[footer_p]], colWidths=[18.8 * cm])
    footer_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1e1b4b")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    elements.append(footer_table)

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
