"""Attendance business logic.

Implements backend requirement #17 (transactional save) and #18 (absence
notification creation). The whole bulk-save operation happens in ONE
transaction: if anything fails, nothing is written (attendance rows AND
notification jobs are all-or-nothing).
"""
from datetime import date

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationAppError
from app.models.attendance import Attendance
from app.models.enums import AttendanceStatus, NotificationType
from app.models.student import Student
from app.schemas.attendance import BulkAttendanceRequest, BulkAttendanceResult
from app.services.audit_service import record_audit
from app.services.notification_service import create_notification_job
from app.services.settings_service import get_setting


def save_bulk_attendance(db: Session, payload: BulkAttendanceRequest, user_id: int) -> BulkAttendanceResult:
    student_ids = [r.student_id for r in payload.records]
    if not student_ids:
        raise ValidationAppError("No attendance records provided.")
    if len(student_ids) != len(set(student_ids)):
        raise ValidationAppError("Duplicate student_id entries in attendance payload.")

    students = {s.id: s for s in db.query(Student).filter(Student.id.in_(student_ids)).all()}
    missing = [sid for sid in student_ids if sid not in students]
    if missing:
        raise NotFoundError(f"Student(s) not found: {missing}")

    # Load any attendance already recorded for this date to support "correction"
    # (update in place) rather than crashing on the unique constraint.
    existing_rows = {
        a.student_id: a
        for a in db.query(Attendance)
        .filter(Attendance.date == payload.date, Attendance.student_id.in_(student_ids))
        .all()
    }

    academy_name = get_setting(db, "academy_name") or "Acadexa Academy"

    counts = {status: 0 for status in AttendanceStatus}
    notifications_queued = 0

    for record in payload.records:
        student = students[record.student_id]

        row = existing_rows.get(record.student_id)
        if row is not None:
            row.status = record.status
            row.updated_by = user_id
        else:
            row = Attendance(
                student_id=student.id,
                date=payload.date,
                status=record.status,
                class_id=payload.class_id,
                batch_id=payload.batch_id,
                created_by=user_id,
                updated_by=user_id,
            )
            db.add(row)

        counts[record.status] += 1

        if record.status == AttendanceStatus.ABSENT:
            create_notification_job(
                db,
                student,
                NotificationType.ABSENCE,
                variables={
                    "student_name": student.name,
                    "guardian_name": student.guardian_name or "Guardian",
                    "date": payload.date.isoformat(),
                    "academy_name": academy_name,
                },
                context_ref_type="attendance",
                context_ref_id=None,  # set after flush below if needed
            )
            notifications_queued += 1

    record_audit(
        db,
        user_id,
        "ATTENDANCE_SAVED",
        "attendance",
        None,
        f"Saved attendance for {len(payload.records)} students on {payload.date} "
        f"(class={payload.class_id}, batch={payload.batch_id})",
    )

    db.commit()

    return BulkAttendanceResult(
        date=payload.date,
        class_id=payload.class_id,
        batch_id=payload.batch_id,
        present=counts[AttendanceStatus.PRESENT],
        absent=counts[AttendanceStatus.ABSENT],
        late=counts[AttendanceStatus.LATE],
        leave=counts[AttendanceStatus.LEAVE],
        notifications_queued=notifications_queued,
    )


def calculate_attendance_summary(db: Session, student_id: int, date_from: date, date_to: date) -> dict:
    rows = (
        db.query(Attendance)
        .filter(Attendance.student_id == student_id, Attendance.date >= date_from, Attendance.date <= date_to)
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
        "total_classes": total,
        "present": present,
        "absent": absent,
        "late": late,
        "leave": leave,
        "percentage": percentage,
    }
