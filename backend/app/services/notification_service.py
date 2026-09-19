"""Notification job creation & template rendering.

Business rule: creating a notification job is CHEAP and synchronous (just an
INSERT within the caller's transaction). Actual WhatsApp delivery happens
later, asynchronously, via the notification worker. This ensures attendance
and marks saving never wait on external WhatsApp API latency.
"""
import re
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.enums import NotificationType
from app.models.notification import NotificationJob, NotificationTemplate
from app.models.student import Student

TEMPLATE_VAR_PATTERN = re.compile(r"\{(\w+)\}")

DEFAULT_TEMPLATES: dict[NotificationType, str] = {
    NotificationType.ABSENCE: (
        "Dear {guardian_name}, this is to inform you that {student_name} was ABSENT on {date}. "
        "- {academy_name}"
    ),
    NotificationType.MARKS: (
        "Dear {guardian_name}, {student_name} scored {obtained_marks}/{total_marks} "
        "({percentage}%) in {subject} ({test_name}). - {academy_name}"
    ),
    NotificationType.MONTHLY_REPORT: (
        "Dear {guardian_name}, the monthly attendance report for {student_name} "
        "({class_name} - {batch_name}) for {date} is now available. - {academy_name}"
    ),
}


def render_template(body: str, variables: dict[str, Any]) -> str:
    def replace(match: re.Match) -> str:
        key = match.group(1)
        return str(variables.get(key, f"{{{key}}}"))

    return TEMPLATE_VAR_PATTERN.sub(replace, body)


def get_template_body(db: Session, notif_type: NotificationType) -> str:
    template = db.query(NotificationTemplate).filter(NotificationTemplate.type == notif_type).first()
    if template and template.is_active:
        return template.body
    return DEFAULT_TEMPLATES[notif_type]


def create_notification_job(
    db: Session,
    student: Student,
    notif_type: NotificationType,
    variables: dict[str, Any],
    context_ref_type: Optional[str] = None,
    context_ref_id: Optional[int] = None,
    custom_message: Optional[str] = None,
) -> NotificationJob:
    if custom_message is not None:
        message = custom_message
    else:
        body = get_template_body(db, notif_type)
        message = render_template(body, variables)

    job = NotificationJob(
        student_id=student.id,
        type=notif_type,
        recipient=student.whatsapp_number,
        message=message,
        context_ref_type=context_ref_type,
        context_ref_id=context_ref_id,
    )
    db.add(job)
    db.flush()
    return job
