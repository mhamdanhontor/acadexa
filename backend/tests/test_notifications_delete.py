"""Tests for deleting pending and single notifications."""
from app.models.enums import NotificationStatus, NotificationType
from app.models.notification import NotificationJob


def test_delete_all_pending_notifications(client, auth_headers, db_session):
    # Setup class & student
    c_id = client.post("/api/v1/classes", json={"name": "DelClass"}, headers=auth_headers).json()["id"]
    b_id = client.post("/api/v1/batches", json={"name": "DelBatch"}, headers=auth_headers).json()["id"]
    sid = client.post(
        "/api/v1/students",
        json={"student_code": "DEL01", "name": "Del Student", "whatsapp_number": "923001234567", "class_id": c_id, "batch_id": b_id},
        headers=auth_headers,
    ).json()["id"]

    # Insert 2 pending jobs and 1 sent job directly
    job1 = NotificationJob(
        student_id=sid,
        type=NotificationType.ABSENCE,
        recipient="923001234567",
        message="Pending Msg 1",
        status=NotificationStatus.PENDING,
    )
    job2 = NotificationJob(
        student_id=sid,
        type=NotificationType.MARKS,
        recipient="923001234567",
        message="Pending Msg 2",
        status=NotificationStatus.RETRYING,
    )
    job3 = NotificationJob(
        student_id=sid,
        type=NotificationType.MONTHLY_REPORT,
        recipient="923001234567",
        message="Sent Msg 3",
        status=NotificationStatus.SENT,
    )
    db_session.add_all([job1, job2, job3])
    db_session.commit()

    # Call DELETE /api/v1/notifications/pending
    del_resp = client.delete("/api/v1/notifications/pending", headers=auth_headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] == 2

    # Check remaining jobs: only SENT remains
    list_resp = client.get("/api/v1/notifications", headers=auth_headers)
    items = list_resp.json()["items"]
    assert len(items) == 1
    assert items[0]["status"] == "SENT"


def test_delete_single_notification(client, auth_headers, db_session):
    c_id = client.post("/api/v1/classes", json={"name": "SingleDelClass"}, headers=auth_headers).json()["id"]
    b_id = client.post("/api/v1/batches", json={"name": "SingleDelBatch"}, headers=auth_headers).json()["id"]
    sid = client.post(
        "/api/v1/students",
        json={"student_code": "DEL02", "name": "Single Del", "whatsapp_number": "923001234568", "class_id": c_id, "batch_id": b_id},
        headers=auth_headers,
    ).json()["id"]

    job = NotificationJob(
        student_id=sid,
        type=NotificationType.ABSENCE,
        recipient="923001234568",
        message="To Delete",
        status=NotificationStatus.PENDING,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)

    # Delete single job
    del_resp = client.delete(f"/api/v1/notifications/{job.id}", headers=auth_headers)
    assert del_resp.status_code == 204

    # Verify 404 on retry or deletion
    assert client.delete(f"/api/v1/notifications/{job.id}", headers=auth_headers).status_code == 404
