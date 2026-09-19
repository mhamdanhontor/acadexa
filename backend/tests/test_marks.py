"""Marks validation and percentage calculation tests (requirement #28)."""
import pytest


@pytest.fixture
def setup_test(client, auth_headers):
    class_id = client.post("/api/v1/classes", json={"name": "11th"}, headers=auth_headers).json()["id"]
    batch_id = client.post("/api/v1/batches", json={"name": "Weekend"}, headers=auth_headers).json()["id"]
    subject_id = client.post("/api/v1/subjects", json={"name": "Physics"}, headers=auth_headers).json()["id"]
    session_id = client.post(
        "/api/v1/test-sessions",
        json={"name": "2026 Session", "start_date": "2026-01-01", "end_date": "2026-12-31", "period_count": 4},
        headers=auth_headers,
    ).json()["id"]

    student_resp = client.post(
        "/api/v1/students",
        json={"student_code": "M001", "name": "Marks Student", "whatsapp_number": "923001230000", "class_id": class_id, "batch_id": batch_id},
        headers=auth_headers,
    )
    student_id = student_resp.json()["id"]

    test_resp = client.post(
        "/api/v1/tests",
        json={
            "session_id": session_id,
            "period_label": "Month 1",
            "subject_id": subject_id,
            "class_id": class_id,
            "batch_id": batch_id,
            "name": "Physics Test 1",
            "test_date": "2026-02-01",
            "total_marks": 100,
        },
        headers=auth_headers,
    )
    test_id = test_resp.json()["id"]

    return test_id, student_id


def test_bulk_marks_valid_range(client, auth_headers, setup_test):
    test_id, student_id = setup_test
    resp = client.post(
        "/api/v1/marks/bulk",
        json={"test_id": test_id, "records": [{"student_id": student_id, "obtained_marks": 85}]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["students_updated"] == 1
    assert data["notifications_queued"] == 1


def test_marks_percentage_calculated_server_side(client, auth_headers, setup_test):
    test_id, student_id = setup_test
    client.post(
        "/api/v1/marks/bulk",
        json={"test_id": test_id, "records": [{"student_id": student_id, "obtained_marks": 75}]},
        headers=auth_headers,
    )
    list_resp = client.get(f"/api/v1/marks?test_id={test_id}", headers=auth_headers)
    marks = list_resp.json()["items"]
    assert len(marks) == 1
    assert marks[0]["percentage"] == 75.0
    assert marks[0]["total_marks"] == 100.0


def test_marks_above_total_rejected(client, auth_headers, setup_test):
    """Server must reject obtained_marks > total_marks even if frontend didn't validate."""
    test_id, student_id = setup_test
    resp = client.post(
        "/api/v1/marks/bulk",
        json={"test_id": test_id, "records": [{"student_id": student_id, "obtained_marks": 150}]},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_MARKS_RANGE"


def test_marks_negative_rejected(client, auth_headers, setup_test):
    test_id, student_id = setup_test
    resp = client.post(
        "/api/v1/marks/bulk",
        json={"test_id": test_id, "records": [{"student_id": student_id, "obtained_marks": -5}]},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_marks_creates_notification_job(client, auth_headers, setup_test):
    test_id, student_id = setup_test
    client.post(
        "/api/v1/marks/bulk",
        json={"test_id": test_id, "records": [{"student_id": student_id, "obtained_marks": 90}]},
        headers=auth_headers,
    )
    notif_resp = client.get("/api/v1/notifications?type=MARKS", headers=auth_headers)
    jobs = notif_resp.json()["items"]
    assert len(jobs) == 1
    assert jobs[0]["student_id"] == student_id


def test_bulk_marks_duplicate_student_rejected(client, auth_headers, setup_test):
    test_id, student_id = setup_test
    resp = client.post(
        "/api/v1/marks/bulk",
        json={
            "test_id": test_id,
            "records": [
                {"student_id": student_id, "obtained_marks": 80},
                {"student_id": student_id, "obtained_marks": 90},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_marks_upsert_on_resave(client, auth_headers, setup_test):
    """Re-submitting marks for the same student/test should UPDATE, not duplicate."""
    test_id, student_id = setup_test
    client.post(
        "/api/v1/marks/bulk",
        json={"test_id": test_id, "records": [{"student_id": student_id, "obtained_marks": 60}]},
        headers=auth_headers,
    )
    client.post(
        "/api/v1/marks/bulk",
        json={"test_id": test_id, "records": [{"student_id": student_id, "obtained_marks": 95}]},
        headers=auth_headers,
    )
    list_resp = client.get(f"/api/v1/marks?test_id={test_id}&student_id={student_id}", headers=auth_headers)
    marks = list_resp.json()["items"]
    assert len(marks) == 1
    assert marks[0]["obtained_marks"] == 95.0
