"""Attendance business logic tests: bulk save, transactions, duplicate prevention,
absence notification creation."""
import pytest


@pytest.fixture
def setup_students(client, auth_headers):
    class_id = client.post("/api/v1/classes", json={"name": "8th"}, headers=auth_headers).json()["id"]
    batch_id = client.post("/api/v1/batches", json={"name": "Morning"}, headers=auth_headers).json()["id"]

    student_ids = []
    for i in range(4):
        resp = client.post(
            "/api/v1/students",
            json={
                "student_code": f"ATT{i}",
                "name": f"Student {i}",
                "whatsapp_number": f"92300111000{i}",
                "class_id": class_id,
                "batch_id": batch_id,
            },
            headers=auth_headers,
        )
        student_ids.append(resp.json()["id"])

    return class_id, batch_id, student_ids


def test_bulk_attendance_save(client, auth_headers, setup_students):
    class_id, batch_id, student_ids = setup_students
    payload = {
        "date": "2026-09-11",
        "class_id": class_id,
        "batch_id": batch_id,
        "records": [
            {"student_id": student_ids[0], "status": "PRESENT"},
            {"student_id": student_ids[1], "status": "ABSENT"},
            {"student_id": student_ids[2], "status": "LATE"},
            {"student_id": student_ids[3], "status": "LEAVE"},
        ],
    }
    resp = client.post("/api/v1/attendance/bulk", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["present"] == 1
    assert data["absent"] == 1
    assert data["late"] == 1
    assert data["leave"] == 1
    assert data["notifications_queued"] == 1  # only the ABSENT student


def test_absence_creates_notification_job_only_for_absent(client, auth_headers, setup_students):
    class_id, batch_id, student_ids = setup_students
    payload = {
        "date": "2026-09-11",
        "class_id": class_id,
        "batch_id": batch_id,
        "records": [
            {"student_id": student_ids[0], "status": "PRESENT"},
            {"student_id": student_ids[1], "status": "ABSENT"},
        ],
    }
    client.post("/api/v1/attendance/bulk", json=payload, headers=auth_headers)

    notif_resp = client.get("/api/v1/notifications", headers=auth_headers)
    jobs = notif_resp.json()["items"]
    assert len(jobs) == 1
    assert jobs[0]["student_id"] == student_ids[1]
    assert jobs[0]["type"] == "ABSENCE"


def test_duplicate_attendance_same_date_is_correction_not_error(client, auth_headers, setup_students):
    """Saving attendance twice for the same date/student should UPDATE in place
    (correction workflow), not raise a duplicate-key error."""
    class_id, batch_id, student_ids = setup_students
    payload1 = {
        "date": "2026-09-12",
        "class_id": class_id,
        "batch_id": batch_id,
        "records": [{"student_id": student_ids[0], "status": "ABSENT"}],
    }
    resp1 = client.post("/api/v1/attendance/bulk", json=payload1, headers=auth_headers)
    assert resp1.status_code == 200

    payload2 = {
        "date": "2026-09-12",
        "class_id": class_id,
        "batch_id": batch_id,
        "records": [{"student_id": student_ids[0], "status": "PRESENT"}],
    }
    resp2 = client.post("/api/v1/attendance/bulk", json=payload2, headers=auth_headers)
    assert resp2.status_code == 200
    assert resp2.json()["present"] == 1
    assert resp2.json()["absent"] == 0

    # Verify only ONE attendance row exists for that student/date (no duplicate row)
    list_resp = client.get(
        f"/api/v1/attendance?student_id={student_ids[0]}&date_from=2026-09-12&date_to=2026-09-12",
        headers=auth_headers,
    )
    items = list_resp.json()["items"]
    assert len(items) == 1
    assert items[0]["status"] == "PRESENT"


def test_bulk_attendance_missing_student_fails_transactionally(client, auth_headers, setup_students):
    """If one student_id doesn't exist, the entire batch must fail and nothing
    should be saved (transactional integrity, requirement #17)."""
    class_id, batch_id, student_ids = setup_students
    payload = {
        "date": "2026-09-13",
        "class_id": class_id,
        "batch_id": batch_id,
        "records": [
            {"student_id": student_ids[0], "status": "PRESENT"},
            {"student_id": 999999, "status": "ABSENT"},  # nonexistent
        ],
    }
    resp = client.post("/api/v1/attendance/bulk", json=payload, headers=auth_headers)
    assert resp.status_code == 404

    # Nothing should have been saved for student_ids[0] either
    list_resp = client.get(
        f"/api/v1/attendance?student_id={student_ids[0]}&date_from=2026-09-13&date_to=2026-09-13",
        headers=auth_headers,
    )
    assert list_resp.json()["total"] == 0


def test_bulk_attendance_duplicate_student_in_payload_rejected(client, auth_headers, setup_students):
    class_id, batch_id, student_ids = setup_students
    payload = {
        "date": "2026-09-14",
        "class_id": class_id,
        "batch_id": batch_id,
        "records": [
            {"student_id": student_ids[0], "status": "PRESENT"},
            {"student_id": student_ids[0], "status": "ABSENT"},
        ],
    }
    resp = client.post("/api/v1/attendance/bulk", json=payload, headers=auth_headers)
    assert resp.status_code == 422


def test_teacher_can_save_attendance(client, teacher_auth_headers, auth_headers, setup_students):
    class_id, batch_id, student_ids = setup_students
    payload = {
        "date": "2026-09-15",
        "class_id": class_id,
        "batch_id": batch_id,
        "records": [{"student_id": student_ids[0], "status": "PRESENT"}],
    }
    resp = client.post("/api/v1/attendance/bulk", json=payload, headers=teacher_auth_headers)
    assert resp.status_code == 200


def test_attendance_summary_calculation(client, auth_headers, setup_students):
    class_id, batch_id, student_ids = setup_students
    sid = student_ids[0]
    for d, status in [("2026-09-01", "PRESENT"), ("2026-09-02", "PRESENT"), ("2026-09-03", "ABSENT"), ("2026-09-04", "LATE")]:
        client.post(
            "/api/v1/attendance/bulk",
            json={"date": d, "class_id": class_id, "batch_id": batch_id, "records": [{"student_id": sid, "status": status}]},
            headers=auth_headers,
        )

    resp = client.get(
        f"/api/v1/attendance/summary?student_id={sid}&date_from=2026-09-01&date_to=2026-09-04",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_classes"] == 4
    assert data["present"] == 2
    assert data["absent"] == 1
    assert data["late"] == 1
    assert data["percentage"] == 50.0  # 2/4 present, late not counted by default


def test_bulk_attendance_returns_absent_notifications(client, auth_headers, setup_students):
    class_id, batch_id, student_ids = setup_students
    payload = {
        "date": "2026-09-16",
        "class_id": class_id,
        "batch_id": batch_id,
        "records": [
            {"student_id": student_ids[0], "status": "ABSENT"},
            {"student_id": student_ids[1], "status": "PRESENT"},
        ],
    }
    resp = client.post("/api/v1/attendance/bulk", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["absent"] == 1
    assert len(data["absent_notifications"]) == 1

    notif = data["absent_notifications"][0]
    assert notif["student_id"] == student_ids[0]
    assert "ABSENT" in notif["message"]
    assert "web.whatsapp.com" in notif["whatsapp_web_url"]
    assert "whatsapp://" in notif["whatsapp_app_url"]


def test_get_absent_notifications_endpoint(client, auth_headers, setup_students):
    class_id, batch_id, student_ids = setup_students
    client.post(
        "/api/v1/attendance/bulk",
        json={
            "date": "2026-09-17",
            "class_id": class_id,
            "batch_id": batch_id,
            "records": [{"student_id": student_ids[0], "status": "ABSENT"}],
        },
        headers=auth_headers,
    )

    resp = client.get(
        f"/api/v1/attendance/absent-notifications?date=2026-09-17&class_id={class_id}&batch_id={batch_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    absentees = resp.json()
    assert len(absentees) == 1
    assert absentees[0]["student_id"] == student_ids[0]
    assert "web.whatsapp.com" in absentees[0]["whatsapp_web_url"]


def test_mark_notification_sent_endpoint(client, auth_headers, setup_students):
    class_id, batch_id, student_ids = setup_students
    save_resp = client.post(
        "/api/v1/attendance/bulk",
        json={
            "date": "2026-09-18",
            "class_id": class_id,
            "batch_id": batch_id,
            "records": [{"student_id": student_ids[0], "status": "ABSENT"}],
        },
        headers=auth_headers,
    )
    notif_id = save_resp.json()["absent_notifications"][0]["notification_id"]
    assert notif_id is not None

    mark_resp = client.post(f"/api/v1/notifications/{notif_id}/mark-sent", headers=auth_headers)
    assert mark_resp.status_code == 200
    assert mark_resp.json()["status"] == "SENT"
    assert mark_resp.json()["sent_at"] is not None
