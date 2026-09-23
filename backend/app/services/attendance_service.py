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
from app.models.academic_structure import Batch, ClassRoom
from app.models.enums import AttendanceStatus, NotificationType
from app.models.student import Student
from app.schemas.all_enrolled_attendance import (
    AllEnrolledAttendanceSaveRequest,
    AllEnrolledAttendanceSaveResult,
    AllEnrolledDispatchItemOut,
    AllEnrolledStudentItemOut,
)
from app.schemas.attendance import AbsentNotificationOut, BulkAttendanceRequest, BulkAttendanceResult
from app.services.audit_service import record_audit
from app.services.notification_service import create_notification_job, get_template_body, render_template
from app.services.settings_service import get_setting
from app.utils.phone import build_whatsapp_urls


def render_leave_message(student: Student, date_val: date, academy_name: str) -> str:
    """Render bilingual English and Urdu approved leave acknowledgment message."""
    from app.utils.urdu_transliteration import get_guardian_urdu_name, get_student_urdu_name

    guardian_label = student.guardian_name or "Guardian"
    student_name_ur = get_student_urdu_name(student)
    guardian_label_ur = get_guardian_urdu_name(student)

    return (
        f"*LEAVE ACKNOWLEDGMENT*\n*Assalam-o-Alaikum*\n\n"
        f"Dear Parent/Guardian (*{guardian_label}*),\n\n"
        f"This is to inform you that your child *{student.name}* has been marked on approved *LEAVE* on *{date_val.isoformat()}*.\n\n"
        f"We look forward to their return to regular classes.\n\n"
        f"Best regards,\n"
        f"*{academy_name}*\n\n"
        f"-----------------------------------\n\n"
        f"*رخصت کی تصدیق*\n*السلام علیکم*\n\n"
        f"محترم والدین / سرپرست (*{guardian_label_ur}*)،\n\n"
        f"آپ کو مطلع کیا جاتا ہے کہ آپ کے بچے *{student_name_ur}* کی مورخہ *{date_val.isoformat()}* کی *رخصت (Leave)* اکیڈمی ریکارڈ میں درج کر لی گئی ہے۔\n\n"
        f"والسلام،\n"
        f"*{academy_name}*"
    )


def render_late_message(student: Student, date_val: date, academy_name: str) -> str:
    """Render bilingual English and Urdu late arrival notice message."""
    from app.utils.urdu_transliteration import get_guardian_urdu_name, get_student_urdu_name

    guardian_label = student.guardian_name or "Guardian"
    student_name_ur = get_student_urdu_name(student)
    guardian_label_ur = get_guardian_urdu_name(student)

    return (
        f"*LATE ARRIVAL NOTICE*\n*Assalam-o-Alaikum*\n\n"
        f"Dear Parent/Guardian (*{guardian_label}*),\n\n"
        f"This is to inform you that your child *{student.name}* arrived *LATE* at the academy on *{date_val.isoformat()}*.\n\n"
        f"Punctuality is essential for academic discipline. Kindly ensure timely arrival in future classes.\n\n"
        f"Best regards,\n"
        f"*{academy_name}*\n\n"
        f"-----------------------------------\n\n"
        f"*تاخیر سے آمد کی اطلاع*\n*السلام علیکم*\n\n"
        f"محترم والدین / سرپرست (*{guardian_label_ur}*)،\n\n"
        f"آپ کو مطلع کیا جاتا ہے کہ آپ کا بچہ *{student_name_ur}* مورخہ *{date_val.isoformat()}* کو اکیڈمی میں *تاخیر (Late)* سے پہنچا ہے۔\n\n"
        f"بہتر تعلیمی نظم و ضبط کے لیے وقت کی پابندی بے حد ضروری ہے۔ براہِ کرم آئندہ بروقت آمد کو یقینی بنائیں۔\n\n"
        f"والسلام،\n"
        f"*{academy_name}*"
    )


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

    academy_name = get_setting(db, "academy_name") or "Honor Knowledge Academy"

    counts = {status: 0 for status in AttendanceStatus}
    notifications_queued = 0
    absent_notifications: list[AbsentNotificationOut] = []

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

        if record.status in (AttendanceStatus.ABSENT, AttendanceStatus.LEAVE, AttendanceStatus.LATE):
            from app.utils.urdu_transliteration import get_guardian_urdu_name, get_student_urdu_name

            guardian_label = student.guardian_name or "Guardian"
            if record.status == AttendanceStatus.ABSENT:
                job = create_notification_job(
                    db,
                    student,
                    NotificationType.ABSENCE,
                    variables={
                        "student_name": student.name,
                        "student_name_ur": get_student_urdu_name(student),
                        "guardian_name": guardian_label,
                        "guardian_name_ur": get_guardian_urdu_name(student),
                        "date": payload.date.isoformat(),
                        "academy_name": academy_name,
                    },
                    context_ref_type="attendance_absence",
                    context_ref_id=None,  # set after flush below if needed
                )
            elif record.status == AttendanceStatus.LEAVE:
                msg = render_leave_message(student, payload.date, academy_name)
                job = create_notification_job(
                    db,
                    student,
                    NotificationType.ABSENCE,
                    variables={},
                    context_ref_type="attendance_leave",
                    context_ref_id=None,
                    custom_message=msg,
                )
            else:  # LATE
                msg = render_late_message(student, payload.date, academy_name)
                job = create_notification_job(
                    db,
                    student,
                    NotificationType.ABSENCE,
                    variables={},
                    context_ref_type="attendance_late",
                    context_ref_id=None,
                    custom_message=msg,
                )

            notifications_queued += 1
            urls = build_whatsapp_urls(student.whatsapp_number, job.message)
            absent_notifications.append(
                AbsentNotificationOut(
                    notification_id=job.id,
                    student_id=student.id,
                    student_name=student.name,
                    student_code=student.student_code,
                    guardian_name=guardian_label,
                    whatsapp_number=student.whatsapp_number,
                    status_type=record.status.value,
                    message=job.message,
                    whatsapp_web_url=urls["web_url"],
                    whatsapp_app_url=urls["app_url"],
                    status=job.status.value,
                )
            )

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
        absent_notifications=absent_notifications,
    )


def get_absent_notifications(db: Session, date_: date, class_id: int, batch_id: int) -> list[AbsentNotificationOut]:
    """Retrieve absent, leave, and late students for a specific session with rendered WhatsApp messages and URLs."""
    from app.models.notification import NotificationJob

    records = (
        db.query(Attendance)
        .filter(
            Attendance.date == date_,
            Attendance.class_id == class_id,
            Attendance.batch_id == batch_id,
            Attendance.status.in_([AttendanceStatus.ABSENT, AttendanceStatus.LEAVE, AttendanceStatus.LATE]),
        )
        .all()
    )
    if not records:
        return []

    student_ids = [r.student_id for r in records]
    students = {s.id: s for s in db.query(Student).filter(Student.id.in_(student_ids)).all()}
    academy_name = get_setting(db, "academy_name") or "Honor Knowledge Academy"
    default_body = get_template_body(db, NotificationType.ABSENCE)

    # Fetch recent absence/leave/late jobs for these students
    recent_jobs = (
        db.query(NotificationJob)
        .filter(
            NotificationJob.student_id.in_(student_ids),
            NotificationJob.type == NotificationType.ABSENCE,
        )
        .order_by(NotificationJob.id.desc())
        .all()
    )
    job_map = {}
    for j in recent_jobs:
        if j.student_id not in job_map:
            job_map[j.student_id] = j

    results = []
    for rec in records:
        student = students.get(rec.student_id)
        if not student:
            continue
        guardian_label = student.guardian_name or "Guardian"
        job = job_map.get(student.id)
        if job:
            msg = job.message
            notif_id = job.id
            status_val = job.status.value
        else:
            if rec.status == AttendanceStatus.LEAVE:
                msg = render_leave_message(student, date_, academy_name)
            elif rec.status == AttendanceStatus.LATE:
                msg = render_late_message(student, date_, academy_name)
            else:
                from app.utils.urdu_transliteration import get_guardian_urdu_name, get_student_urdu_name

                msg = render_template(
                    default_body,
                    {
                        "student_name": student.name,
                        "student_name_ur": get_student_urdu_name(student),
                        "guardian_name": guardian_label,
                        "guardian_name_ur": get_guardian_urdu_name(student),
                        "date": date_.isoformat(),
                        "academy_name": academy_name,
                    },
                )
            notif_id = None
            status_val = "PENDING"

        urls = build_whatsapp_urls(student.whatsapp_number, msg)
        results.append(
            AbsentNotificationOut(
                notification_id=notif_id,
                student_id=student.id,
                student_name=student.name,
                student_code=student.student_code,
                guardian_name=guardian_label,
                whatsapp_number=student.whatsapp_number,
                status_type=rec.status.value,
                message=msg,
                whatsapp_web_url=urls["web_url"],
                whatsapp_app_url=urls["app_url"],
                status=status_val,
            )
        )
    return results


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


def get_all_enrolled_attendance_roster(db: Session, date_: date) -> list[AllEnrolledStudentItemOut]:
    """Retrieve all active enrolled students across all classes and batches,
    joined with their attendance status on date_.
    """
    students = (
        db.query(Student)
        .filter(Student.is_active.is_(True))
        .order_by(Student.name.asc())
        .all()
    )
    if not students:
        return []

    student_ids = [s.id for s in students]
    attendance_rows = {
        a.student_id: a
        for a in db.query(Attendance)
        .filter(Attendance.date == date_, Attendance.student_id.in_(student_ids))
        .all()
    }

    classes = {c.id: c.name for c in db.query(ClassRoom).all()}
    batches = {b.id: b.name for b in db.query(Batch).all()}

    roster = []
    for s in students:
        att = attendance_rows.get(s.id)
        current_status = att.status if att else AttendanceStatus.PRESENT
        attendance_id = att.id if att else None

        roster.append(
            AllEnrolledStudentItemOut(
                student_id=s.id,
                student_code=s.student_code,
                student_name=s.name,
                guardian_name=s.guardian_name,
                whatsapp_number=s.whatsapp_number,
                class_id=s.class_id,
                class_name=classes.get(s.class_id, "Unknown Class"),
                batch_id=s.batch_id,
                batch_name=batches.get(s.batch_id, "Unknown Batch"),
                current_status=current_status,
                attendance_id=attendance_id,
            )
        )
    return roster


def save_global_attendance(
    db: Session, payload: AllEnrolledAttendanceSaveRequest, user_id: int
) -> AllEnrolledAttendanceSaveResult:
    """Save attendance for all enrolled students across any class/batch in a single atomic transaction.
    Automatically triggers WhatsApp notification jobs for both ABSENT and LEAVE students.
    """
    student_ids = [r.student_id for r in payload.records]
    if not student_ids:
        raise ValidationAppError("No attendance records provided.")
    if len(student_ids) != len(set(student_ids)):
        raise ValidationAppError("Duplicate student_id entries in attendance payload.")

    students = {s.id: s for s in db.query(Student).filter(Student.id.in_(student_ids)).all()}
    missing = [sid for sid in student_ids if sid not in students]
    if missing:
        raise NotFoundError(f"Student(s) not found: {missing}")

    existing_rows = {
        a.student_id: a
        for a in db.query(Attendance)
        .filter(Attendance.date == payload.date, Attendance.student_id.in_(student_ids))
        .all()
    }

    academy_name = get_setting(db, "academy_name") or "Honor Knowledge Academy"
    default_absence_body = get_template_body(db, NotificationType.ABSENCE)

    counts = {status: 0 for status in AttendanceStatus}
    notifications_queued = 0
    dispatches: list[AllEnrolledDispatchItemOut] = []

    for record in payload.records:
        student = students[record.student_id]

        row = existing_rows.get(student.id)
        if row is not None:
            row.status = record.status
            row.updated_by = user_id
        else:
            row = Attendance(
                student_id=student.id,
                date=payload.date,
                status=record.status,
                class_id=student.class_id,
                batch_id=student.batch_id,
                created_by=user_id,
                updated_by=user_id,
            )
            db.add(row)

        counts[record.status] += 1

        # Trigger WhatsApp notification for ABSENT, LEAVE, and LATE
        if record.status in (AttendanceStatus.ABSENT, AttendanceStatus.LEAVE, AttendanceStatus.LATE):
            from app.utils.urdu_transliteration import get_guardian_urdu_name, get_student_urdu_name

            guardian_label = student.guardian_name or "Guardian"
            student_name_ur = get_student_urdu_name(student)
            guardian_label_ur = get_guardian_urdu_name(student)

            if record.status == AttendanceStatus.ABSENT:
                msg = render_template(
                    default_absence_body,
                    {
                        "student_name": student.name,
                        "student_name_ur": student_name_ur,
                        "guardian_name": guardian_label,
                        "guardian_name_ur": guardian_label_ur,
                        "date": payload.date.isoformat(),
                        "academy_name": academy_name,
                    },
                )
                context_ref = "attendance_absence"
            elif record.status == AttendanceStatus.LEAVE:
                msg = render_leave_message(student, payload.date, academy_name)
                context_ref = "attendance_leave"
            else:  # LATE
                msg = render_late_message(student, payload.date, academy_name)
                context_ref = "attendance_late"

            job = create_notification_job(
                db,
                student,
                NotificationType.ABSENCE,
                variables={},
                context_ref_type=context_ref,
                context_ref_id=None,
                custom_message=msg,
            )
            notifications_queued += 1
            urls = build_whatsapp_urls(student.whatsapp_number, job.message)
            dispatches.append(
                AllEnrolledDispatchItemOut(
                    notification_id=job.id,
                    student_id=student.id,
                    student_name=student.name,
                    student_code=student.student_code,
                    guardian_name=guardian_label,
                    whatsapp_number=student.whatsapp_number,
                    status_type=record.status.value,
                    message=job.message,
                    whatsapp_web_url=urls["web_url"],
                    whatsapp_app_url=urls["app_url"],
                    status=job.status.value,
                )
            )

    record_audit(
        db,
        user_id,
        "ALL_ENROLLED_ATTENDANCE_SAVED",
        "attendance",
        None,
        f"Saved attendance for {len(payload.records)} students across academy on {payload.date}",
    )

    db.commit()

    return AllEnrolledAttendanceSaveResult(
        date=payload.date,
        total=len(payload.records),
        present=counts[AttendanceStatus.PRESENT],
        absent=counts[AttendanceStatus.ABSENT],
        late=counts[AttendanceStatus.LATE],
        leave=counts[AttendanceStatus.LEAVE],
        notifications_queued=notifications_queued,
        dispatches=dispatches,
    )
