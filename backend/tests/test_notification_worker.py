"""Notification worker & fake WhatsApp provider tests."""
import pytest

from app.models.enums import NotificationStatus, NotificationType
from app.models.notification import NotificationJob
from app.services.whatsapp.fake_provider import FakeWhatsAppProvider
from app.workers.notification_worker import process_pending_notifications, retry_notification_job


@pytest.fixture
def real_student_id(client, auth_headers):
    class_id = client.post("/api/v1/classes", json={"name": "WorkerTestClass"}, headers=auth_headers).json()["id"]
    batch_id = client.post("/api/v1/batches", json={"name": "WorkerTestBatch"}, headers=auth_headers).json()["id"]
    student_resp = client.post(
        "/api/v1/students",
        json={
            "student_code": "WRK001",
            "name": "Worker Test Student",
            "whatsapp_number": "923001234567",
            "class_id": class_id,
            "batch_id": batch_id,
        },
        headers=auth_headers,
    )
    return student_resp.json()["id"]


def test_fake_provider_success():
    provider = FakeWhatsAppProvider()
    result = provider.send_message("+923001234567", "Hello test")
    assert result.success is True
    assert result.provider_message_id.startswith("fake-")


def test_fake_provider_simulated_failure():
    provider = FakeWhatsAppProvider()
    result = provider.send_message("+923001234567", "This will FORCE_FAIL")
    assert result.success is False
    assert result.error is not None


def test_worker_processes_pending_job_to_sent(db_session, real_student_id):
    job = NotificationJob(
        student_id=real_student_id, type=NotificationType.ABSENCE, recipient="+923001234567", message="Test message"
    )
    db_session.add(job)
    db_session.commit()

    processed = process_pending_notifications()
    assert processed == 1

    db_session.refresh(job)
    assert job.status == NotificationStatus.SENT
    assert job.provider_message_id is not None


def test_worker_marks_job_failed_after_max_retries(db_session, real_student_id):
    job = NotificationJob(
        student_id=real_student_id, type=NotificationType.ABSENCE, recipient="+923001234567",
        message="This should FORCE_FAIL always",
    )
    db_session.add(job)
    db_session.commit()

    # Run the worker 3 times to exceed MAX_RETRIES
    for _ in range(3):
        process_pending_notifications()
        db_session.refresh(job)

    assert job.status == NotificationStatus.FAILED
    assert job.retry_count >= 3


def test_retry_failed_notification_resets_status(db_session, real_student_id):
    job = NotificationJob(
        student_id=real_student_id, type=NotificationType.ABSENCE, recipient="+923001234567",
        message="fail", status=NotificationStatus.FAILED, retry_count=3, failure_reason="boom",
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    updated = retry_notification_job(db_session, job.id)
    assert updated.status == NotificationStatus.PENDING
    assert updated.retry_count == 0
    assert updated.failure_reason is None


def test_retry_non_failed_job_rejected(db_session, real_student_id):
    from app.core.errors import ConflictError

    job = NotificationJob(
        student_id=real_student_id, type=NotificationType.ABSENCE, recipient="+923001234567",
        message="ok", status=NotificationStatus.SENT,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    try:
        retry_notification_job(db_session, job.id)
        assert False, "Should have raised ConflictError"
    except ConflictError as e:
        assert e.code == "NOTIFICATION_NOT_FAILED"


def test_dispatch_pending_endpoint(client, auth_headers, db_session, real_student_id):
    job = NotificationJob(
        student_id=real_student_id, type=NotificationType.ABSENCE, recipient="+923001234567",
        message="test pending", status=NotificationStatus.PENDING,
    )
    db_session.add(job)
    db_session.commit()

    resp = client.post("/api/v1/notifications/dispatch-pending", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "processed" in data
    assert data["processed"] >= 1
