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
        "*ABSENCE NOTICE*\n*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "This is to respectfully inform you that your child *{student_name}* was marked *ABSENT* from the academy on *{date}*.\n\n"
        "If this absence was unplanned or if you have any questions, please contact the academy administration.\n\n"
        "Best regards,\n"
        "*{academy_name}*\n\n"
        "-----------------------------------\n\n"
        "*غیر حاضری کی اطلاع*\n*السلام علیکم*\n\n"
        "محترم والدین / سرپرست (*{guardian_name_ur}*)،\n\n"
        "آپ کو مؤدبانہ مطلع کیا جاتا ہے کہ آپ کا بچہ / بچی *{student_name_ur}* مورخہ *{date}* کو اکیڈمی سے *غیر حاضر* تھا۔/تھی۔\n\n"
        "کسی بھی معلومات یا وضاحت کے لیے برائے مہربانی اکیڈمی انتظامیہ سے رابطہ فرمائیں۔\n\n"
        "والسلام،\n"
        "*{academy_name}*"
    ),
    NotificationType.MARKS: (
        "*TEST RESULT ANNOUNCEMENT*\n*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "Test Result Announcement for *{student_name}*:\n\n"
        "📚 *Subject:* {subject}\n"
        "📝 *Test:* {test_name}\n"
        "🎯 *Score:* {obtained_marks}/{total_marks} ({percentage}%)\n\n"
        "Keep encouraging your child's academic journey!\n\n"
        "Best regards,\n"
        "*{academy_name}*\n\n"
        "-----------------------------------\n\n"
        "*امتحانی نتیجہ کی اطلاع*\n*السلام علیکم*\n\n"
        "محترم والدین / سرپرست (*{guardian_name_ur}*)،\n\n"
        "{student_name_ur} کے امتحانی نتیجے کی تفصیل درج ذیل ہے:\n\n"
        "📚 *مضمون:* {subject}\n"
        "📝 *ٹیسٹ:* {test_name}\n"
        "🎯 *حاصل کردہ نمبر:* {obtained_marks}/{total_marks} ({percentage}%)\n\n"
        "اپنے بچے کی تعلیمی لگن اور محنت کی حوصلہ افزائی جاری رکھیں۔\n\n"
        "والسلام،\n"
        "*{academy_name}*"
    ),
    NotificationType.MONTHLY_REPORT: (
        "*MONTHLY PROGRESS REPORT*\n*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "The monthly academic and attendance progress report for *{student_name}* ({class_name} - {batch_name}) for the period *{date}* is now available.\n\n"
        "Please review your child's overall academic and attendance performance.\n\n"
        "Best regards,\n"
        "*{academy_name}*\n\n"
        "-----------------------------------\n\n"
        "*ماہانہ تعلیمی و حاضری رپورٹ*\n*السلام علیکم*\n\n"
        "محترم والدین / سرپرست (*{guardian_name_ur}*)،\n\n"
        "{student_name_ur} ({class_name} - {batch_name}) کی ماہانہ تعلیمی و حاضری رپورٹ برائے *{date}* تیار ہے۔\n\n"
        "برائے مہربانی اپنے بچے کی تعلیمی و حاضری کارکردگی کا جائزہ لیں۔\n\n"
        "والسلام،\n"
        "*{academy_name}*"
    ),
    NotificationType.FEE_RECEIPT: (
        "*FEE PAYMENT RECEIPT*\n*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "Fee payment confirmation for *{student_name}*:\n\n"
        "💵 *Amount Paid:* PKR {amount}\n"
        "📅 *Month/Period:* {month}\n"
        "🧾 *Receipt #:* {receipt_no}\n"
        "🗓 *Payment Date:* {payment_date}\n\n"
        "Thank you for your timely payment and continued support.\n\n"
        "Best regards,\n"
        "*{academy_name}*\n\n"
        "-----------------------------------\n\n"
        "*فیس وصولی کی رسید*\n*السلام علیکم*\n\n"
        "محترم والدین / سرپرست (*{guardian_name_ur}*)،\n\n"
        "آپ کے بچے *{student_name_ur}* کی فیس کی ادائیگی کی تصدیق درج ذیل ہے:\n\n"
        "💵 *وصول شدہ رقم:* PKR {amount}\n"
        "📅 *ماہ:* {month}\n"
        "🧾 *رسید نمبر:* #{receipt_no}\n"
        "🗓 *تاریخِ ادائیگی:* {payment_date}\n\n"
        "بروقت ادائیگی اور تعاون کا شکریہ!\n\n"
        "والسلام،\n"
        "*{academy_name}*"
    ),
}


def render_template(body: str, variables: dict[str, Any]) -> str:
    from app.utils.urdu_transliteration import is_urdu_text, transliterate_name_to_urdu

    # Ensure Urdu name variables exist
    student_name = str(variables.get("student_name", ""))
    guardian_name = str(variables.get("guardian_name", ""))

    student_name_ur = variables.get("student_name_ur") or transliterate_name_to_urdu(student_name)
    guardian_name_ur = variables.get("guardian_name_ur") or transliterate_name_to_urdu(guardian_name)

    enriched_vars = dict(variables)
    enriched_vars["student_name_ur"] = student_name_ur
    enriched_vars["guardian_name_ur"] = guardian_name_ur

    # If body has a separator '---' separating English from Urdu:
    if "---" in body:
        parts = re.split(r"(-{3,})", body)
        rendered_parts = []
        is_after_separator = False
        for part in parts:
            if part.startswith("---"):
                rendered_parts.append(part)
                is_after_separator = True
            elif not is_after_separator:
                # English section: keep English names
                rendered_parts.append(
                    TEMPLATE_VAR_PATTERN.sub(
                        lambda m: str(enriched_vars.get(m.group(1), f"{{{m.group(1)}}}")) , part
                    )
                )
            else:
                # Urdu section: student_name -> Urdu name, guardian_name -> Urdu name
                urdu_vars = dict(enriched_vars)
                urdu_vars["student_name"] = student_name_ur
                urdu_vars["guardian_name"] = guardian_name_ur
                rendered_parts.append(
                    TEMPLATE_VAR_PATTERN.sub(
                        lambda m: str(urdu_vars.get(m.group(1), f"{{{m.group(1)}}}")) , part
                    )
                )
        return "".join(rendered_parts)

    # Pure Urdu body check
    if is_urdu_text(body):
        urdu_vars = dict(enriched_vars)
        urdu_vars["student_name"] = student_name_ur
        urdu_vars["guardian_name"] = guardian_name_ur
        return TEMPLATE_VAR_PATTERN.sub(
            lambda m: str(urdu_vars.get(m.group(1), f"{{{m.group(1)}}}")) , body
        )

    # Default single section
    return TEMPLATE_VAR_PATTERN.sub(
        lambda m: str(enriched_vars.get(m.group(1), f"{{{m.group(1)}}}")) , body
    )


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
    from app.utils.urdu_transliteration import get_guardian_urdu_name, get_student_urdu_name

    vars_copy = dict(variables)
    if "student_name_ur" not in vars_copy:
        vars_copy["student_name_ur"] = get_student_urdu_name(student, vars_copy.get("student_name"))
    if "guardian_name_ur" not in vars_copy:
        vars_copy["guardian_name_ur"] = get_guardian_urdu_name(student, vars_copy.get("guardian_name"))

    if custom_message is not None:
        message = custom_message
    else:
        body = get_template_body(db, notif_type)
        message = render_template(body, vars_copy)

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
