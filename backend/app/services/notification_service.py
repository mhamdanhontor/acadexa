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
        "*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "This is to respectfully inform you that your child *{student_name}* was marked *ABSENT* from the academy on *{date}*.\n\n"
        "If this was unexpected or you have any queries, please contact the academy administration.\n\n"
        "Regards,\n"
        "*{academy_name}*"
    ),
    NotificationType.MARKS: (
        "*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "Test Result Announcement for *{student_name}*:\n\n"
        "📚 *Subject:* {subject}\n"
        "📝 *Test:* {test_name}\n"
        "🎯 *Score:* {obtained_marks}/{total_marks} ({percentage}%)\n\n"
        "Keep encouraging your child's academic journey!\n\n"
        "Regards,\n"
        "*{academy_name}*"
    ),
    NotificationType.MONTHLY_REPORT: (
        "*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "The monthly academic and attendance progress report for *{student_name}* ({class_name} - {batch_name}) for the period *{date}* is now available.\n\n"
        "Regards,\n"
        "*{academy_name}*"
    ),
    NotificationType.FEE_RECEIPT: (
        "*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "Fee payment confirmation for *{student_name}*:\n\n"
        "💵 *Amount Paid:* PKR {amount_paid}\n"
        "📅 *Month/Period:* {month}\n"
        "🧾 *Receipt #:* {receipt_no}\n"
        "💳 *Remaining Balance:* PKR {remaining_balance}\n\n"
        "Thank you for your timely payment!\n\n"
        "Regards,\n"
        "*{academy_name}*"
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
