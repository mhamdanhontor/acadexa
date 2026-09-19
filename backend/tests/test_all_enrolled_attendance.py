"""Tests for All-Enrolled (Quick) Attendance endpoint & Absent/Leave notifications."""
import pytest


@pytest.fixture
def setup_multi_class_students(client, auth_headers):
    # Create two separate classes and batches to test cross-class attendance
    c1 = client.post("/api/v1/classes", json={"name": "Class A"}, headers=auth_headers).json()["id"]
    c2 = client.post("/api/v1/classes", json={"name": "Class B"}, headers=auth_headers).json()["id"]
    b1 = client.post("/api/v1/batches", json={"name": "Batch Morning"}, headers=auth_headers).json()["id"]
    b2 = client.post("/api/v1/batches", json={"name": "Batch Evening"}, headers=auth_headers).json()["id"]

    s1 = client.post(
        "/api/v1/students",
        json={"student_code": "ALL01", "name": "Bilal Ahmed", "guardian_name": "Tariq Ahmed", "whatsapp_number": "923001112221", "class_id": c1, "batch_id": b1},
        headers=auth_headers,
    ).json()

    s2 = client.post(
        "/api/v1/students",
        json={"student_code": "ALL02", "name": "Sara Khan", "guardian_name": "Farhan Khan", "whatsapp_number": "923001112222", "class_id": c1, "batch_id": b1},
        headers=auth_headers,
    ).json()

    s3 = client.post(
        "/api/v1/students",
        json={"student_code": "ALL03", "name": "Hamza Ali", "guardian_name": "Ali Raza", "whatsapp_number": "923001112223", "class_id": c2, "batch_id": b2},
        headers=auth_headers,
    ).json()

    s4 = client.post(
        "/api/v1/students",
        json={"student_code": "ALL04", "name": "Ayesha Noor", "guardian_name": "Noor Din", "whatsapp_number": "923001112224", "class_id": c2, "batch_id": b2},
        headers=auth_headers,
    ).json()

    return [s1["id"], s2["id"], s3["id"], s4["id"]]


def test_get_all_enrolled_roster(client, auth_headers, setup_multi_class_students):
    student_ids = setup_multi_class_students
    resp = client.get("/api/v1/attendance/all-enrolled?date=2026-09-19", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 4
    returned_ids = [s["student_id"] for s in data]
    for sid in student_ids:
        assert sid in returned_ids


def test_save_all_enrolled_attendance_creates_absent_and_leave_notifications(client, auth_headers, setup_multi_class_students):
    s1, s2, s3, s4 = setup_multi_class_students
    payload = {
        "date": "2026-09-19",
        "records": [
            {"student_id": s1, "status": "PRESENT"},
            {"student_id": s2, "status": "ABSENT"},
            {"student_id": s3, "status": "LEAVE"},
            {"student_id": s4, "status": "LATE"},
        ],
    }
    resp = client.post("/api/v1/attendance/all-enrolled", json=payload, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 4
    assert data["present"] == 1
    assert data["absent"] == 1
    assert data["leave"] == 1
    assert data["late"] == 1
    assert data["notifications_queued"] == 2
    assert len(data["dispatches"]) == 2

    # Verify Absent notification
    absent_dispatch = next((d for d in data["dispatches"] if d["student_id"] == s2), None)
    assert absent_dispatch is not None
    assert absent_dispatch["status_type"] == "ABSENT"
    assert "ABSENT" in absent_dispatch["message"]
    assert "Sara Khan" in absent_dispatch["message"]
    assert "web.whatsapp.com" in absent_dispatch["whatsapp_web_url"]

    # Verify Leave notification
    leave_dispatch = next((d for d in data["dispatches"] if d["student_id"] == s3), None)
    assert leave_dispatch is not None
    assert leave_dispatch["status_type"] == "LEAVE"
    assert "LEAVE" in leave_dispatch["message"]
    assert "Hamza Ali" in leave_dispatch["message"]
    assert "web.whatsapp.com" in leave_dispatch["whatsapp_web_url"]


def test_all_enrolled_duplicate_student_fails(client, auth_headers, setup_multi_class_students):
    s1, _, _, _ = setup_multi_class_students
    payload = {
        "date": "2026-09-19",
        "records": [
            {"student_id": s1, "status": "PRESENT"},
            {"student_id": s1, "status": "ABSENT"},
        ],
    }
    resp = client.post("/api/v1/attendance/all-enrolled", json=payload, headers=auth_headers)
    assert resp.status_code == 422


def test_all_enrolled_resave_is_correction_upsert(client, auth_headers, setup_multi_class_students):
    s1, s2, _, _ = setup_multi_class_students
    payload1 = {
        "date": "2026-09-20",
        "records": [
            {"student_id": s1, "status": "PRESENT"},
            {"student_id": s2, "status": "ABSENT"},
        ],
    }
    resp1 = client.post("/api/v1/attendance/all-enrolled", json=payload1, headers=auth_headers)
    assert resp1.status_code == 200

    # Resave correcting s2 to PRESENT
    payload2 = {
        "date": "2026-09-20",
        "records": [
            {"student_id": s1, "status": "PRESENT"},
            {"student_id": s2, "status": "PRESENT"},
        ],
    }
    resp2 = client.post("/api/v1/attendance/all-enrolled", json=payload2, headers=auth_headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["present"] == 2
    assert data2["absent"] == 0
