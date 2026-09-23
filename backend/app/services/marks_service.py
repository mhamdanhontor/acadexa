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
from app.schemas.academics import BulkMarksRequest, BulkMarksResult, MarksDispatchItemOut
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

    academy_name = get_setting(db, "academy_name") or "Honor Knowledge Academy"
    notifications_queued = 0

    dispatches: list[MarksDispatchItemOut] = []

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
        guardian_label = student.guardian_name or "Guardian"
        job = create_notification_job(
            db,
            student,
            NotificationType.MARKS,
            variables={
                "student_name": student.name,
                "guardian_name": guardian_label,
                "subject": test.subject.name if test.subject else "",
                "test_name": test.name,
                "obtained_marks": record.obtained_marks,
                "total_marks": test.total_marks,
                "percentage": percentage,
                "grade": grade,
                "academy_name": academy_name,
            },
            context_ref_type="marks",
            context_ref_id=test.id,
        )
        notifications_queued += 1

        from app.utils.phone import build_whatsapp_urls

        urls = build_whatsapp_urls(student.whatsapp_number, job.message)
        dispatches.append(
            MarksDispatchItemOut(
                notification_id=job.id,
                student_id=student.id,
                student_name=student.name,
                student_code=student.student_code,
                guardian_name=guardian_label,
                whatsapp_number=student.whatsapp_number,
                obtained_marks=record.obtained_marks,
                total_marks=test.total_marks,
                percentage=percentage,
                grade=grade,
                message=job.message,
                whatsapp_web_url=urls["web_url"],
                whatsapp_app_url=urls["app_url"],
                status="PENDING",
            )
        )

    record_audit(
        db, user_id, "MARKS_SAVED", "marks", test.id,
        f"Saved marks for {len(payload.records)} students on test {test.name}",
    )
    db.commit()

    return BulkMarksResult(
        test_id=test.id,
        students_updated=len(payload.records),
        notifications_queued=notifications_queued,
        dispatches=dispatches,
    )


def get_marks_notifications(db: Session, test_id: int) -> list[MarksDispatchItemOut]:
    """Retrieve students who have marks in test_id with rendered WhatsApp messages and URLs."""
    from app.models.notification import NotificationJob
    from app.services.notification_service import get_template_body, render_template
    from app.utils.phone import build_whatsapp_urls

    test = db.get(Test, test_id)
    if test is None:
        raise NotFoundError("Test not found.")

    marks_records = (
        db.query(Marks)
        .filter(Marks.test_id == test_id)
        .order_by(Marks.id.asc())
        .all()
    )
    if not marks_records:
        return []

    student_ids = [m.student_id for m in marks_records]
    students = {s.id: s for s in db.query(Student).filter(Student.id.in_(student_ids)).all()}
    academy_name = get_setting(db, "academy_name") or "Honor Knowledge Academy"
    default_body = get_template_body(db, NotificationType.MARKS)

    # Fetch recent marks notification jobs for this test and these students
    recent_jobs = (
        db.query(NotificationJob)
        .filter(
            NotificationJob.student_id.in_(student_ids),
            NotificationJob.type == NotificationType.MARKS,
            NotificationJob.context_ref_type == "marks",
            NotificationJob.context_ref_id == test_id,
        )
        .order_by(NotificationJob.id.desc())
        .all()
    )
    job_map = {}
    for j in recent_jobs:
        if j.student_id not in job_map:
            job_map[j.student_id] = j

    results = []
    subject_name = test.subject.name if test.subject else ""
    for m in marks_records:
        student = students.get(m.student_id)
        if not student:
            continue
        guardian_label = student.guardian_name or "Guardian"
        job = job_map.get(student.id)
        if job:
            msg = job.message
            notif_id = job.id
            status_val = job.status.value
        else:
            from app.utils.urdu_transliteration import get_guardian_urdu_name, get_student_urdu_name

            msg = render_template(
                default_body,
                {
                    "student_name": student.name,
                    "student_name_ur": get_student_urdu_name(student),
                    "guardian_name": guardian_label,
                    "guardian_name_ur": get_guardian_urdu_name(student),
                    "subject": subject_name,
                    "test_name": test.name,
                    "obtained_marks": m.obtained_marks,
                    "total_marks": m.total_marks,
                    "percentage": m.percentage,
                    "grade": m.grade or compute_grade(m.percentage),
                    "academy_name": academy_name,
                },
            )
            notif_id = None
            status_val = "PENDING"

        urls = build_whatsapp_urls(student.whatsapp_number, msg)
        results.append(
            MarksDispatchItemOut(
                notification_id=notif_id,
                student_id=student.id,
                student_name=student.name,
                student_code=student.student_code,
                guardian_name=guardian_label,
                whatsapp_number=student.whatsapp_number,
                obtained_marks=m.obtained_marks,
                total_marks=m.total_marks,
                percentage=m.percentage,
                grade=m.grade or compute_grade(m.percentage),
                message=msg,
                whatsapp_web_url=urls["web_url"],
                whatsapp_app_url=urls["app_url"],
                status=status_val,
            )
        )
    return results


def save_quick_marks(db: Session, payload: "QuickMarksRequest", user_id: int) -> "QuickMarksResult":
    from app.schemas.academics import MarksDispatchItemOut
    from app.schemas.quick_marks import QuickMarksResult
    from app.services.notification_service import get_template_body, render_template
    from app.utils.phone import build_whatsapp_urls

    student_ids = [r.student_id for r in payload.records]
    if len(student_ids) != len(set(student_ids)):
        raise ValidationAppError("Duplicate student_id entries in marks payload.")

    students = {s.id: s for s in db.query(Student).filter(Student.id.in_(student_ids)).all()}
    missing = [sid for sid in student_ids if sid not in students]
    if missing:
        raise NotFoundError(f"Student(s) not found: {missing}")

    academy_name = get_setting(db, "academy_name") or "Honor Knowledge Academy"
    template_body = get_template_body(db, NotificationType.MARKS)
    notifications_queued = 0
    dispatches: list[MarksDispatchItemOut] = []

    test_name = payload.test_name or "Quiz / Test"
    subject = payload.subject or "General"

    for record in payload.records:
        if record.obtained_marks < 0 or record.obtained_marks > record.total_marks:
            raise ValidationAppError(
                f"Invalid marks for student {record.student_id}: "
                f"obtained ({record.obtained_marks}) must be between 0 and {record.total_marks}.",
                code="INVALID_MARKS_RANGE",
            )

        percentage = round((record.obtained_marks / record.total_marks) * 100, 2)
        grade = compute_grade(percentage)

        student = students[record.student_id]
        guardian_label = student.guardian_name or "Parent/Guardian"
        from app.utils.urdu_transliteration import get_guardian_urdu_name, get_student_urdu_name

        msg = render_template(
            template_body,
            {
                "student_name": student.name,
                "student_name_ur": get_student_urdu_name(student),
                "guardian_name": guardian_label,
                "guardian_name_ur": get_guardian_urdu_name(student),
                "subject": subject,
                "test_name": test_name,
                "obtained_marks": record.obtained_marks,
                "total_marks": record.total_marks,
                "percentage": percentage,
                "grade": grade,
                "academy_name": academy_name,
            },
        )

        job = create_notification_job(
            db,
            student,
            NotificationType.MARKS,
            variables={},
            context_ref_type="quick_marks",
            context_ref_id=None,
            custom_message=msg,
        )
        notifications_queued += 1

        urls = build_whatsapp_urls(student.whatsapp_number, job.message)
        dispatches.append(
            MarksDispatchItemOut(
                notification_id=job.id,
                student_id=student.id,
                student_name=student.name,
                student_code=student.student_code,
                guardian_name=guardian_label,
                whatsapp_number=student.whatsapp_number,
                obtained_marks=record.obtained_marks,
                total_marks=record.total_marks,
                percentage=percentage,
                grade=grade,
                message=job.message,
                whatsapp_web_url=urls["web_url"],
                whatsapp_app_url=urls["app_url"],
                status="PENDING",
            )
        )

    record_audit(
        db, user_id, "QUICK_MARKS_SENT", "marks", None,
        f"Processed quick marks for {len(payload.records)} students on {test_name}",
    )
    db.commit()

    return QuickMarksResult(
        test_name=test_name,
        subject=subject,
        students_processed=len(payload.records),
        notifications_queued=notifications_queued,
        dispatches=dispatches,
    )
