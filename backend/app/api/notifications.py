"""Notification templates + notification jobs (notification center) API."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.enums import NotificationStatus, NotificationType, RoleName
from app.models.notification import NotificationJob, NotificationTemplate
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.notification import (
    NotificationJobOut,
    NotificationTemplateOut,
    NotificationTemplateUpdate,
)
from app.services.audit_service import record_audit
from app.utils.pagination import paginate
from app.workers.notification_worker import retry_notification_job

router = APIRouter(tags=["Notifications"])


@router.get("/notification-templates", response_model=list[NotificationTemplateOut])
def list_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(NotificationTemplate).all()


@router.put("/notification-templates/{template_id}", response_model=NotificationTemplateOut)
def update_template(
    template_id: int,
    payload: NotificationTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    tpl = db.get(NotificationTemplate, template_id)
    if tpl is None:
        raise NotFoundError("Notification template not found.")
    tpl.body = payload.body
    if payload.is_active is not None:
        tpl.is_active = payload.is_active
    record_audit(db, current_user.id, "NOTIFICATION_TEMPLATE_UPDATED", "notification_template", tpl.id, tpl.name)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.get("/notifications", response_model=PaginatedResponse[NotificationJobOut])
def list_notification_jobs(
    student_id: Optional[int] = None,
    type: Optional[NotificationType] = None,
    status: Optional[NotificationStatus] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(NotificationJob)
    if student_id is not None:
        stmt = stmt.where(NotificationJob.student_id == student_id)
    if type is not None:
        stmt = stmt.where(NotificationJob.type == type)
    if status is not None:
        stmt = stmt.where(NotificationJob.status == status)
    stmt = stmt.order_by(NotificationJob.created_at.desc())

    items, total, total_pages = paginate(db, stmt, page, page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.post("/notifications/{job_id}/retry", response_model=NotificationJobOut)
def retry_notification(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    job = retry_notification_job(db, job_id)
    record_audit(db, current_user.id, "NOTIFICATION_RETRIED", "notification_job", job.id, None)
    db.commit()
    return job


@router.post("/notifications/{job_id}/mark-sent", response_model=NotificationJobOut)
def mark_notification_sent(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    from datetime import datetime, timezone

    job = db.get(NotificationJob, job_id)
    if job is None:
        raise NotFoundError("Notification job not found.")

    job.status = NotificationStatus.SENT
    job.sent_at = datetime.now(timezone.utc)
    job.failure_reason = None
    job.provider_message_id = f"admin-wa-{job.id}"
    record_audit(db, current_user.id, "NOTIFICATION_SENT_VIA_ADMIN_WHATSAPP", "notification_job", job.id, f"Sent to {job.recipient}")
    db.commit()
    db.refresh(job)
    return job


@router.post("/notifications/dispatch-pending")
def dispatch_pending_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    from app.workers.notification_worker import process_pending_notifications
    from app.core.config import settings

    if settings.WHATSAPP_PROVIDER.lower() in ("manual", "admin_web"):
        from datetime import datetime, timezone
        pending_jobs = (
            db.query(NotificationJob)
            .filter(NotificationJob.status.in_([NotificationStatus.PENDING, NotificationStatus.RETRYING]))
            .all()
        )
        count = len(pending_jobs)
        for job in pending_jobs:
            job.status = NotificationStatus.SENT
            job.sent_at = datetime.now(timezone.utc)
            job.provider_message_id = f"bulk-admin-{job.id}"
            job.failure_reason = None
        db.commit()
        record_audit(db, current_user.id, "NOTIFICATIONS_BULK_DISPATCHED", "notification_job", None, f"Dispatched {count} pending notifications")
        return {"processed": count, "mode": "admin_web"}

    processed = process_pending_notifications()
    return {"processed": processed, "mode": settings.WHATSAPP_PROVIDER}


@router.delete("/notifications/pending")
def delete_all_pending_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    """Delete all notification jobs with status PENDING or RETRYING."""
    pending_jobs = (
        db.query(NotificationJob)
        .filter(NotificationJob.status.in_([NotificationStatus.PENDING, NotificationStatus.RETRYING]))
        .all()
    )
    count = len(pending_jobs)
    if count > 0:
        db.query(NotificationJob).filter(
            NotificationJob.status.in_([NotificationStatus.PENDING, NotificationStatus.RETRYING])
        ).delete(synchronize_session=False)
        record_audit(
            db,
            current_user.id,
            "NOTIFICATIONS_PENDING_DELETED",
            "notification_job",
            None,
            f"Deleted {count} pending notifications",
        )
        db.commit()

    return {"deleted": count}


@router.delete("/notifications/{job_id}", status_code=204)
def delete_notification(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    job = db.get(NotificationJob, job_id)
    if job is None:
        raise NotFoundError("Notification job not found.")
    db.delete(job)
    record_audit(db, current_user.id, "NOTIFICATION_DELETED", "notification_job", job_id, f"Deleted job #{job_id}")
    db.commit()
    return None

