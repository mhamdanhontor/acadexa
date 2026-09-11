"""Monthly report calculation, approval workflow, PDF/Excel generation.

Workflow (requirement #32):
    Calculate -> Generate -> READY -> Admin reviews -> APPROVED -> Send WhatsApp -> SENT
A report must NEVER be sent merely because it was generated/approved-adjacent;
sending only happens after explicit APPROVED state + explicit send action.
"""
import json
import os
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.errors import AppError, ConflictError, NotFoundError
from app.models.attendance import Attendance
from app.models.enums import AttendanceStatus, NotificationType, ReportStatus, ReportType
from app.models.report import MonthlyReport
from app.models.student import Student
from app.services.audit_service import record_audit
from app.services.notification_service import create_notification_job
from app.services.pdf_service import generate_monthly_attendance_pdf
from app.services.settings_service import get_setting


def _attendance_stats_for_student(db: Session, student_id: int, period_start: date, period_end: date) -> dict:
    rows = (
        db.query(Attendance)
        .filter(
            Attendance.student_id == student_id,
            Attendance.date >= period_start,
            Attendance.date <= period_end,
        )
        .all()
    )
    total = len(rows)
    present = sum(1 for r in rows if r.status == AttendanceStatus.PRESENT)
    absent = sum(1 for r in rows if r.status == AttendanceStatus.ABSENT)
    late = sum(1 for r in rows if r.status == AttendanceStatus.LATE)
    leave = sum(1 for r in rows if r.status == AttendanceStatus.LEAVE)

    late_counts_as_present = (get_setting(db, "attendance_late_counts_as_present") or "false").lower() == "true"
    effective_present = present + (late if late_counts_as_present else 0)
    percentage = round((effective_present / total) * 100, 2) if total > 0 else 0.0

    return {
        "total_classes": total, "present": present, "absent": absent,
        "late": late, "leave": leave, "percentage": percentage,
    }


def generate_monthly_attendance_reports(
    db: Session,
    period_start: date,
    period_end: date,
    class_id: int | None,
    batch_id: int | None,
    student_id: int | None,
    generated_by: int,
) -> list[MonthlyReport]:
    """Generates one MonthlyReport per matching student (calculation + PDF), status=READY."""
    query = db.query(Student).filter(Student.is_active.is_(True))
    if student_id is not None:
        query = query.filter(Student.id == student_id)
    if class_id is not None:
        query = query.filter(Student.class_id == class_id)
    if batch_id is not None:
        query = query.filter(Student.batch_id == batch_id)

    students = query.all()
    if not students:
        raise NotFoundError("No matching active students found for report generation.")

    academy_name = get_setting(db, "academy_name") or "Acadexa Academy"
    reports: list[MonthlyReport] = []

    for student in students:
        stats = _attendance_stats_for_student(db, student.id, period_start, period_end)

        # Avoid duplicate reports for the same student/period; regenerate in place if DRAFT/READY.
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
            # Do not silently overwrite an already-approved/sent report.
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
        report.data_json = json.dumps(stats)
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
        )
        report.file_path = pdf_path
        reports.append(report)

    record_audit(
        db, generated_by, "MONTHLY_REPORTS_GENERATED", "monthly_report", None,
        f"Generated {len(reports)} monthly attendance reports for {period_start}..{period_end}",
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
    """Sends an APPROVED report via WhatsApp notification job. Never sends a report
    that has not been explicitly approved (requirement #32)."""
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

    academy_name = get_setting(db, "academy_name") or "Acadexa Academy"
    stats = json.loads(report.data_json) if report.data_json else {}

    create_notification_job(
        db,
        student,
        NotificationType.MONTHLY_REPORT,
        variables={
            "student_name": student.name,
            "guardian_name": student.guardian_name or "Guardian",
            "date": f"{report.period_start} - {report.period_end}",
            "class_name": str(report.class_id or ""),
            "batch_name": str(report.batch_id or ""),
            "academy_name": academy_name,
            **stats,
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
