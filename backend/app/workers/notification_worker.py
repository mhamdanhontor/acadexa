"""Background notification worker.

Processes PENDING/RETRYING notification jobs asynchronously so that
attendance/marks saving never blocks on WhatsApp API latency
(requirement #21, #51). Runs on a schedule via APScheduler, started from
app.main on application startup.
"""
import logging

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.enums import NotificationStatus
from app.models.notification import NotificationJob
from app.services.whatsapp.factory import get_whatsapp_provider
from datetime import datetime, timezone

logger = logging.getLogger("acadexa.worker.notifications")

MAX_RETRIES = 3
BATCH_SIZE = 50


def process_pending_notifications() -> int:
    """Process a batch of pending/retrying notification jobs. Returns count processed."""
    db: Session = SessionLocal()
    processed = 0
    try:
        jobs = (
            db.query(NotificationJob)
            .filter(NotificationJob.status.in_([NotificationStatus.PENDING, NotificationStatus.RETRYING]))
            .limit(BATCH_SIZE)
            .all()
        )
        if not jobs:
            return 0

        provider = get_whatsapp_provider()

        for job in jobs:
            job.status = NotificationStatus.PROCESSING
            db.flush()

            result = provider.send_message(job.recipient, job.message)

            if result.success:
                job.status = NotificationStatus.SENT
                job.provider_message_id = result.provider_message_id
                job.sent_at = datetime.now(timezone.utc)
                job.failure_reason = None
            else:
                job.retry_count += 1
                job.failure_reason = result.error
                if job.retry_count >= MAX_RETRIES:
                    job.status = NotificationStatus.FAILED
                else:
                    job.status = NotificationStatus.RETRYING

            processed += 1

        db.commit()
    except Exception:
        logger.exception("Error while processing notification jobs")
        db.rollback()
    finally:
        db.close()

    return processed


def retry_notification_job(db: Session, job_id: int) -> NotificationJob:
    from app.core.errors import ConflictError, NotFoundError

    job = db.get(NotificationJob, job_id)
    if job is None:
        raise NotFoundError("Notification job not found.")
    if job.status not in (NotificationStatus.FAILED,):
        raise ConflictError("Only failed notifications can be retried.", code="NOTIFICATION_NOT_FAILED")

    job.status = NotificationStatus.PENDING
    job.retry_count = 0
    job.failure_reason = None
    db.commit()
    db.refresh(job)
    return job
