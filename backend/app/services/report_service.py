"""Monthly report calculation, approval workflow, PDF/Excel generation.

Workflow:
    Calculate -> Generate -> READY -> Admin reviews -> APPROVED -> Send WhatsApp -> SENT
A report must NEVER be sent merely because it was generated/approved-adjacent;
sending only happens after explicit APPROVED state + explicit send action,
or via explicit "Approve & Send" user confirmation.
"""
import calendar
import json
import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.academic_structure import Batch, ClassRoom
from app.models.academics import Marks, Test
from app.models.attendance import Attendance
from app.models.enums import AttendanceStatus, NotificationType, ReportStatus, ReportType
from app.models.report import MonthlyReport
from app.models.student import Student
from app.services.audit_service import record_audit
from app.services.marks_service import compute_grade
from app.services.notification_service import create_notification_job
from app.services.pdf_service import generate_monthly_attendance_pdf
from app.services.settings_service import get_setting


def _attendance_stats_for_student(
    db: Session, student_id: int, period_start: date, period_end: date
) -> tuple[dict, list[dict]]:
    rows = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student_id,
            Attendance.date >= period_start,
            Attendance.date <= period_end,
        )
        .order_by(Attendance.date.asc())
        .all()
    )
    total = len(rows)
    present = sum(1 for r in rows if r.status == AttendanceStatus.PRESENT)
    absent = sum(1 for r in rows if r.status == AttendanceStatus.ABSENT)
    late = sum(1 for r in rows if r.status == AttendanceStatus.LATE)
    leave = sum(1 for r in rows if r.status == AttendanceStatus.LEAVE)

    late_counts_as_present = (
        get_setting(db, "attendance_late_counts_as_present") or "true"
    ).lower() == "true"
    effective_present = present + (late if late_counts_as_present else 0)
    percentage = round((effective_present / total) * 100, 2) if total > 0 else 0.0

    stats = {
        "total_classes": total,
        "present": present,
        "absent": absent,
        "late": late,
        "leave": leave,
        "percentage": percentage,
    }

    # Full month calendar: account for every calendar day in [period_start, period_end]
    rows_map = {r.date: r for r in rows}
    daily_records = []
    curr = period_start
    while curr <= period_end:
        day_str = curr.strftime("%a")
        r = rows_map.get(curr)
        if r:
            status_val = r.status.value
        elif curr.weekday() == 6:  # Sunday
            status_val = "SUNDAY"
        else:
            status_val = "OFF"
        daily_records.append(
            {
                "date": curr.isoformat(),
                "day": day_str,
                "status": status_val,
            }
        )
        curr += timedelta(days=1)

    return stats, daily_records


def _tests_summary_for_student(
    db: Session, student: Student, period_start: date, period_end: date
) -> dict:
    """Finds all tests conducted in [period_start, period_end] for the student's class,
    batch, or any test the student took, along with obtained marks, percentages and grades.
    """
    # 1. Tests where student has marks recorded
    marked_test_ids = [
        m.test_id
        for m in db.query(Marks.test_id)
        .join(Test, Marks.test_id == Test.id)
        .filter(
            Marks.student_id == student.id,
            Test.test_date >= period_start,
            Test.test_date <= period_end,
        )
        .all()
    ]

    # 2. Query all tests for student's class / batch or general or where student has marks
    query_filter = (
        (Test.test_date >= period_start)
        & (Test.test_date <= period_end)
        & (
            (Test.class_id == student.class_id)
            | (Test.batch_id == student.batch_id)
            | (Test.class_id.is_(None))
            | (Test.id.in_(marked_test_ids))
        )
    )

    tests = (
        db.query(Test)
        .options(joinedload(Test.subject))
        .filter(query_filter)
        .order_by(Test.test_date.asc())
        .all()
    )

    test_ids = [t.id for t in tests]
    marks_map: dict[int, Marks] = {}
    if test_ids:
        marks_rows = (
            db.query(Marks)
            .filter(Marks.student_id == student.id, Marks.test_id.in_(test_ids))
            .all()
        )
        marks_map = {m.test_id: m for m in marks_rows}

    items = []
    total_max = 0.0
    total_obtained = 0.0

    for t in tests:
        m = marks_map.get(t.id)
        subj_name = t.subject.name if t.subject else "General"
        obtained = m.obtained_marks if m else None
        pct = m.percentage if m else None
        grade = m.grade or (compute_grade(pct) if pct is not None else None)

        if obtained is not None:
            total_max += t.total_marks
            total_obtained += obtained

        items.append(
            {
                "test_id": t.id,
                "test_name": t.name,
                "subject": subj_name,
                "test_date": t.test_date.isoformat(),
                "total_marks": t.total_marks,
                "obtained_marks": obtained,
                "percentage": pct,
                "grade": grade,
            }
        )

    overall_pct = (
        round((total_obtained / total_max) * 100, 2) if total_max > 0 else 0.0
    )
    overall_grade = compute_grade(overall_pct) if total_max > 0 else "—"

    return {
        "tests": items,
        "total_tests": len(items),
        "tests_attempted": len([i for i in items if i["obtained_marks"] is not None]),
        "total_max_marks": total_max,
        "total_obtained_marks": total_obtained,
        "overall_percentage": overall_pct,
        "overall_grade": overall_grade,
    }


def _get_previous_months_summary(
    db: Session, student_id: int, current_period_start: date, num_months: int = 6
) -> list[dict]:
    """Generates an oneliner historical performance summary for up to `num_months`
    prior to `current_period_start`.
    """
    history = []
    year = current_period_start.year
    month = current_period_start.month

    for _ in range(num_months):
        month -= 1
        if month < 1:
            month = 12
            year -= 1

        last_day = calendar.monthrange(year, month)[1]
        m_start = date(year, month, 1)
        m_end = date(year, month, last_day)
        m_label = m_start.strftime("%b %Y")

        past_rep = (
            db.query(MonthlyReport)
            .filter(
                MonthlyReport.student_id == student_id,
                MonthlyReport.period_start == m_start,
                MonthlyReport.period_end == m_end,
            )
            .first()
        )

        att_pct = None
        att_present = 0
        att_total = 0
        tests_count = 0
        test_pct = None
        grade = "—"
        remarks = "—"

        if past_rep and past_rep.data_json:
            try:
                pj = json.loads(past_rep.data_json)
                att_data = pj.get("attendance", {})
                att_pct = att_data.get("percentage")
                att_present = att_data.get("present", 0) + att_data.get("late", 0)
                att_total = att_data.get("total_classes", 0)

                acad_data = pj.get("academics", {})
                tests_count = acad_data.get("total_tests", 0)
                test_pct = acad_data.get("overall_percentage")
                grade = acad_data.get("overall_grade", "—")
            except Exception:
                pass

        if att_pct is None:
            # Query attendance directly
            att_rows = (
                db.query(Attendance)
                .filter(
                    Attendance.student_id == student_id,
                    Attendance.date >= m_start,
                    Attendance.date <= m_end,
                )
                .all()
            )
            if att_rows:
                att_total = len(att_rows)
                present_c = sum(1 for r in att_rows if r.status == AttendanceStatus.PRESENT)
                late_c = sum(1 for r in att_rows if r.status == AttendanceStatus.LATE)
                att_present = present_c + late_c
                att_pct = round((att_present / att_total) * 100, 1) if att_total > 0 else 0.0

            # Query marks directly
            m_rows = (
                db.query(Marks)
                .join(Test, Marks.test_id == Test.id)
                .filter(
                    Marks.student_id == student_id,
                    Test.test_date >= m_start,
                    Test.test_date <= m_end,
                )
                .all()
            )
            if m_rows:
                tests_count = len(m_rows)
                tot_max = sum(m.test.total_marks for m in m_rows if m.test)
                tot_obt = sum(m.obtained_marks for m in m_rows if m.obtained_marks is not None)
                if tot_max > 0:
                    test_pct = round((tot_obt / tot_max) * 100, 1)
                    grade = compute_grade(test_pct)

        has_data = (att_total > 0) or (tests_count > 0)
        if not has_data:
            remarks = "No Record"
        else:
            score = test_pct if test_pct is not None else att_pct
            if score is not None:
                if score >= 90:
                    remarks = "Excellent"
                elif score >= 80:
                    remarks = "Very Good"
                elif score >= 70:
                    remarks = "Good"
                elif score >= 60:
                    remarks = "Satisfactory"
                else:
                    remarks = "Needs Attention"

        history.append(
            {
                "month": m_label,
                "period_start": m_start.isoformat(),
                "period_end": m_end.isoformat(),
                "has_data": has_data,
                "attendance_pct": att_pct,
                "present_days": att_present,
                "total_classes": att_total,
                "tests_taken": tests_count,
                "test_pct": test_pct,
                "grade": grade,
                "remarks": remarks,
            }
        )

    return history


def ensure_report_pdf(db: Session, report: MonthlyReport) -> str:
    """Ensures the PDF file for a MonthlyReport exists on disk.
    If missing (e.g. after container restart or ephemeral wipe), regenerates it dynamically.
    """
    if report.file_path and os.path.isfile(report.file_path) and os.path.getsize(report.file_path) > 0:
        return report.file_path

    student = report.student or (db.get(Student, report.student_id) if report.student_id else None)
    if not student:
        raise NotFoundError("Student associated with report not found.")

    academy_name = get_setting(db, "academy_name") or "Honor Knowledge Academy"

    payload = {}
    if report.data_json:
        try:
            payload = json.loads(report.data_json)
        except Exception:
            payload = {}

    stats = payload.get("attendance")
    daily_records = payload.get("daily_records")
    tests_stats = payload.get("academics")
    prev_months = payload.get("previous_months")

    if not stats or not daily_records:
        stats, daily_records = _attendance_stats_for_student(
            db, student.id, report.period_start, report.period_end
        )
    if not tests_stats:
        tests_stats = _tests_summary_for_student(
            db, student, report.period_start, report.period_end
        )
    if not prev_months:
        prev_months = _get_previous_months_summary(db, student.id, report.period_start)

    full_payload = {
        "student_name": student.name,
        "student_code": student.student_code,
        "class_name": student.class_room.name if student.class_room else "",
        "batch_name": student.batch.name if student.batch else "",
        "guardian_name": student.guardian_name or "Parent/Guardian",
        "whatsapp_number": student.whatsapp_number,
        "period_start": report.period_start.isoformat(),
        "period_end": report.period_end.isoformat(),
        "attendance": stats,
        "daily_records": daily_records,
        "academics": tests_stats,
        "previous_months": prev_months,
    }
    report.data_json = json.dumps(full_payload)

    pdf_path = generate_monthly_attendance_pdf(
        academy_name=academy_name,
        student_name=student.name,
        student_code=student.student_code,
        period_start=report.period_start,
        period_end=report.period_end,
        stats=stats,
        report_id=report.id,
        tests_stats=tests_stats,
        student_details=full_payload,
        daily_records=daily_records,
        previous_months=prev_months,
    )
    report.file_path = pdf_path
    db.commit()
    db.refresh(report)
    return pdf_path


def generate_monthly_attendance_reports(
    db: Session,
    period_start: date,
    period_end: date,
    class_id: int | None,
    batch_id: int | None,
    student_id: int | None,
    generated_by: int,
) -> list[MonthlyReport]:
    """Generates one MonthlyReport per matching student (calculation + PDF), status=READY.
    Students are sorted in ascending order of Student ID.
    Includes full monthly attendance and all tests taken during the month.
    """
    query = (
        db.query(Student)
        .options(joinedload(Student.class_room), joinedload(Student.batch))
        .filter(Student.is_active.is_(True))
    )
    if student_id is not None:
        query = query.filter(Student.id == student_id)
    if class_id is not None:
        query = query.filter(Student.class_id == class_id)
    if batch_id is not None:
        query = query.filter(Student.batch_id == batch_id)

    students = query.order_by(Student.student_code.asc(), Student.id.asc()).all()
    if not students:
        raise NotFoundError("No matching active students found for report generation.")

    academy_name = get_setting(db, "academy_name") or "Honor Knowledge Academy"
    reports: list[MonthlyReport] = []

    for student in students:
        stats, daily_records = _attendance_stats_for_student(
            db, student.id, period_start, period_end
        )
        tests_stats = _tests_summary_for_student(
            db, student, period_start, period_end
        )
        prev_months = _get_previous_months_summary(db, student.id, period_start)

        existing = (
            db.query(MonthlyReport)
            .filter(
                MonthlyReport.report_type == ReportType.MONTHLY_ATTENDANCE,
                MonthlyReport.student_id == student.id,
                MonthlyReport.period_start == period_start,
                MonthlyReport.period_end == period_end,
            )
            .first()
        )
        if existing and existing.status in (ReportStatus.APPROVED, ReportStatus.SENT):
            reports.append(existing)
            continue

        report = existing or MonthlyReport(
            report_type=ReportType.MONTHLY_ATTENDANCE,
            student_id=student.id,
            class_id=student.class_id,
            batch_id=student.batch_id,
            period_start=period_start,
            period_end=period_end,
        )

        full_payload = {
            "student_name": student.name,
            "student_code": student.student_code,
            "class_name": student.class_room.name if student.class_room else "",
            "batch_name": student.batch.name if student.batch else "",
            "guardian_name": student.guardian_name or "Parent/Guardian",
            "whatsapp_number": student.whatsapp_number,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "attendance": stats,
            "daily_records": daily_records,
            "academics": tests_stats,
            "previous_months": prev_months,
        }
        report.data_json = json.dumps(full_payload)
        report.status = ReportStatus.READY

        db.add(report)
        db.flush()

        pdf_path = generate_monthly_attendance_pdf(
            academy_name=academy_name,
            student_name=student.name,
            student_code=student.student_code,
            period_start=period_start,
            period_end=period_end,
            stats=stats,
            report_id=report.id,
            tests_stats=tests_stats,
            student_details=full_payload,
            daily_records=daily_records,
            previous_months=prev_months,
        )
        report.file_path = pdf_path
        reports.append(report)

    record_audit(
        db,
        generated_by,
        "MONTHLY_REPORTS_GENERATED",
        "monthly_report",
        None,
        f"Generated {len(reports)} monthly reports for {period_start}..{period_end}",
    )
    db.commit()
    for r in reports:
        db.refresh(r)
    return reports


def approve_report(db: Session, report_id: int, approved: bool, user_id: int) -> MonthlyReport:
    report = db.get(MonthlyReport, report_id)
    if report is None:
        raise NotFoundError("Report not found.")
    if report.status not in (ReportStatus.READY, ReportStatus.DRAFT):
        raise ConflictError(
            f"Report is in status {report.status.value} and cannot be approved/rejected again.",
            code="REPORT_INVALID_STATE",
        )

    if approved:
        report.status = ReportStatus.APPROVED
        report.approved_by = user_id
        report.approved_at = datetime.now(timezone.utc)
        action = "REPORT_APPROVED"
    else:
        report.status = ReportStatus.DRAFT
        action = "REPORT_REJECTED"

    record_audit(db, user_id, action, "monthly_report", report.id, None)
    db.commit()
    db.refresh(report)
    return report


def send_report(db: Session, report_id: int, user_id: int) -> MonthlyReport:
    """Sends an APPROVED report via WhatsApp notification job."""
    report = db.get(MonthlyReport, report_id)
    if report is None:
        raise NotFoundError("Report not found.")
    if report.status != ReportStatus.APPROVED:
        raise ConflictError("Only APPROVED reports can be sent.", code="REPORT_NOT_APPROVED")
    if report.student_id is None:
        raise AppError("Cannot send a report with no associated student.", code="REPORT_NO_STUDENT")

    student = db.get(Student, report.student_id)
    if student is None:
        raise NotFoundError("Student not found for this report.")

    academy_name = get_setting(db, "academy_name") or "Honor Knowledge Academy"
    parsed_data = json.loads(report.data_json) if report.data_json else {}
    att_stats = parsed_data.get("attendance", parsed_data)
    acad_stats = parsed_data.get("academics", {})

    cls_name = student.class_room.name if student.class_room else str(report.class_id or "")
    btch_name = student.batch.name if student.batch else str(report.batch_id or "")

    create_notification_job(
        db,
        student,
        NotificationType.MONTHLY_REPORT,
        variables={
            "student_name": student.name,
            "student_code": student.student_code,
            "guardian_name": student.guardian_name or "Guardian",
            "date": f"{report.period_start} - {report.period_end}",
            "class_name": cls_name,
            "batch_name": btch_name,
            "academy_name": academy_name,
            "attendance_percentage": f"{att_stats.get('percentage', 0)}%",
            "total_classes": str(att_stats.get("total_classes", 0)),
            "present_days": str(att_stats.get("present", 0)),
            "late_days": str(att_stats.get("late", 0)),
            "absent_days": str(att_stats.get("absent", 0)),
            "total_tests": str(acad_stats.get("total_tests", 0)),
            "academic_percentage": f"{acad_stats.get('overall_percentage', 0)}%",
            "academic_grade": str(acad_stats.get("overall_grade", "—")),
            **att_stats,
        },
        context_ref_type="report",
        context_ref_id=report.id,
    )

    report.status = ReportStatus.SENT
    report.sent_at = datetime.now(timezone.utc)
    record_audit(db, user_id, "REPORT_SENT", "monthly_report", report.id, None)
    db.commit()
    db.refresh(report)
    return report


def approve_and_send_report(db: Session, report_id: int, user_id: int) -> MonthlyReport:
    """Convenience workflow: marks report APPROVED and immediately dispatches it via WhatsApp."""
    report = db.get(MonthlyReport, report_id)
    if report is None:
        raise NotFoundError("Report not found.")
    if report.status == ReportStatus.SENT:
        raise ConflictError("Report has already been sent.", code="REPORT_ALREADY_SENT")

    # Approve
    report.status = ReportStatus.APPROVED
    report.approved_by = user_id
    report.approved_at = datetime.now(timezone.utc)
    record_audit(db, user_id, "REPORT_APPROVED", "monthly_report", report.id, "Auto-approved during send")
    db.commit()
    db.refresh(report)

    # Send
    return send_report(db, report_id, user_id)


def approve_and_send_all_reports(
    db: Session,
    user_id: int,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    class_id: Optional[int] = None,
    batch_id: Optional[int] = None,
) -> list[MonthlyReport]:
    """Approve and dispatch all READY or APPROVED reports for the given filter."""
    q = db.query(MonthlyReport).filter(
        MonthlyReport.status.in_([ReportStatus.READY, ReportStatus.DRAFT, ReportStatus.APPROVED])
    )
    if period_start:
        q = q.filter(MonthlyReport.period_start == period_start)
    if period_end:
        q = q.filter(MonthlyReport.period_end == period_end)
    if class_id:
        q = q.filter(MonthlyReport.class_id == class_id)
    if batch_id:
        q = q.filter(MonthlyReport.batch_id == batch_id)

    reports = q.all()
    results = []
    for r in reports:
        try:
            sent_r = approve_and_send_report(db, r.id, user_id)
            results.append(sent_r)
        except Exception:
            pass
    return results


def get_month_end_reminder(db: Session) -> dict:
    """Calculates whether today is in the last 2 days of the current month and summarizes
    pending/ready monthly reports needing generation and dispatch.
    """
    today = date.today()
    days_in_month = calendar.monthrange(today.year, today.month)[1]
    is_last_two_days = today.day >= (days_in_month - 1)
    days_remaining = max(0, days_in_month - today.day)
    month_name = today.strftime("%B")
    period_start = today.replace(day=1)
    period_end = today.replace(day=days_in_month)

    pending_count = (
        db.query(MonthlyReport)
        .filter(
            MonthlyReport.period_start == period_start,
            MonthlyReport.period_end == period_end,
            MonthlyReport.status.in_([ReportStatus.DRAFT, ReportStatus.READY]),
        )
        .count()
    )
    approved_count = (
        db.query(MonthlyReport)
        .filter(
            MonthlyReport.period_start == period_start,
            MonthlyReport.period_end == period_end,
            MonthlyReport.status == ReportStatus.APPROVED,
        )
        .count()
    )

    day_label = f"{days_remaining} day{'s' if days_remaining != 1 else ''} remaining"
    if days_remaining == 0:
        day_label = "Final day of the month"

    message = (
        f"Month-End Reminder: Today is day {today.day} of {month_name} ({day_label}). "
        f"Please ensure all monthly attendance and test reports for {month_name} are generated, "
        f"approved, and dispatched to parents on WhatsApp."
    )

    return {
        "is_reminder_active": is_last_two_days,
        "current_day": today.day,
        "days_in_month": days_in_month,
        "days_remaining": days_remaining,
        "month_name": month_name,
        "period_start": period_start,
        "period_end": period_end,
        "message": message,
        "pending_reports_count": pending_count,
        "ready_reports_count": pending_count,
        "approved_reports_count": approved_count,
    }
