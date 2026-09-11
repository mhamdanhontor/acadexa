"""Marks & Tests business logic.

Implements backend requirement #28 (server-side validation: 0 <= obtained
<= total, percentage calculated server-side, never trusting the frontend)
and #30 (marks notification job created immediately on save, without
blocking on WhatsApp delivery).
"""
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, ValidationAppError
from app.models.academics import Marks, Test
from app.models.enums import NotificationType
from app.models.student import Student
from app.schemas.academics import BulkMarksRequest, BulkMarksResult
from app.services.audit_service import record_audit
from app.services.notification_service import create_notification_job
from app.services.settings_service import get_setting


def compute_grade(percentage: float) -> str:
    if percentage >= 90:
        return "A+"
    if percentage >= 80:
        return "A"
    if percentage >= 70:
        return "B"
    if percentage >= 60:
        return "C"
    if percentage >= 50:
        return "D"
    return "F"


def save_bulk_marks(db: Session, payload: BulkMarksRequest, user_id: int) -> BulkMarksResult:
    test = db.get(Test, payload.test_id)
    if test is None:
        raise NotFoundError("Test not found.")

    student_ids = [r.student_id for r in payload.records]
    students = {s.id: s for s in db.query(Student).filter(Student.id.in_(student_ids)).all()}
    missing = [sid for sid in student_ids if sid not in students]
    if missing:
        raise NotFoundError(f"Student(s) not found: {missing}")

    existing_rows = {
        m.student_id: m
        for m in db.query(Marks).filter(Marks.test_id == test.id, Marks.student_id.in_(student_ids)).all()
    }

    academy_name = get_setting(db, "academy_name") or "Acadexa Academy"
    notifications_queued = 0

    for record in payload.records:
        # Server-side validation — never trust the frontend (requirement #28).
        if record.obtained_marks < 0 or record.obtained_marks > test.total_marks:
            raise ValidationAppError(
                f"Invalid marks for student {record.student_id}: "
                f"obtained ({record.obtained_marks}) must be between 0 and {test.total_marks}.",
                code="INVALID_MARKS_RANGE",
            )

        percentage = round((record.obtained_marks / test.total_marks) * 100, 2)
        grade = compute_grade(percentage)

        row = existing_rows.get(record.student_id)
        if row is not None:
            row.obtained_marks = record.obtained_marks
            row.total_marks = test.total_marks
            row.percentage = percentage
            row.grade = grade
            row.entered_by = user_id
        else:
            row = Marks(
                student_id=record.student_id,
                test_id=test.id,
                obtained_marks=record.obtained_marks,
                total_marks=test.total_marks,
                percentage=percentage,
                grade=grade,
                entered_by=user_id,
            )
            db.add(row)

        student = students[record.student_id]
        create_notification_job(
            db,
            student,
            NotificationType.MARKS,
            variables={
                "student_name": student.name,
                "guardian_name": student.guardian_name or "Guardian",
                "subject": test.subject.name if test.subject else "",
                "test_name": test.name,
                "obtained_marks": record.obtained_marks,
                "total_marks": test.total_marks,
                "percentage": percentage,
                "academy_name": academy_name,
            },
            context_ref_type="marks",
            context_ref_id=test.id,
        )
        notifications_queued += 1

    record_audit(
        db, user_id, "MARKS_SAVED", "marks", test.id,
        f"Saved marks for {len(payload.records)} students on test {test.name}",
    )
    db.commit()

    return BulkMarksResult(
        test_id=test.id,
        students_updated=len(payload.records),
        notifications_queued=notifications_queued,
    )
