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
    assert "dispatches" in data
    assert len(data["dispatches"]) == 1
    d = data["dispatches"][0]
    assert d["student_id"] == student_id
    assert d["obtained_marks"] == 85
    assert "web.whatsapp.com" in d["whatsapp_web_url"]
    assert "whatsapp://" in d["whatsapp_app_url"]


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


def test_quick_marks_success(client, auth_headers, setup_test):
    _, student_id = setup_test
    resp = client.post(
        "/api/v1/marks/quick",
        json={
            "test_name": "Weekly Math Quiz",
            "subject": "Mathematics",
            "records": [{"student_id": student_id, "obtained_marks": 45, "total_marks": 50}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["students_processed"] == 1
    assert data["notifications_queued"] == 1
    assert len(data["dispatches"]) == 1
    dispatch = data["dispatches"][0]
    assert dispatch["student_id"] == student_id
    assert dispatch["obtained_marks"] == 45.0
    assert dispatch["total_marks"] == 50.0
    assert dispatch["percentage"] == 90.0
    assert dispatch["grade"] == "A+"
    assert "https://web.whatsapp.com/send" in dispatch["whatsapp_web_url"]
    assert "whatsapp://send" in dispatch["whatsapp_app_url"]
    assert "Marks Student" in dispatch["message"]


def test_quick_marks_invalid_range_rejected(client, auth_headers, setup_test):
    _, student_id = setup_test
    resp = client.post(
        "/api/v1/marks/quick",
        json={
            "test_name": "Weekly Math Quiz",
            "subject": "Mathematics",
            "records": [{"student_id": student_id, "obtained_marks": 55, "total_marks": 50}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_quick_marks_duplicate_student_rejected(client, auth_headers, setup_test):
    _, student_id = setup_test
    resp = client.post(
        "/api/v1/marks/quick",
        json={
            "test_name": "Weekly Math Quiz",
            "subject": "Mathematics",
            "records": [
                {"student_id": student_id, "obtained_marks": 40, "total_marks": 50},
                {"student_id": student_id, "obtained_marks": 42, "total_marks": 50},
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_get_marks_notifications(client, auth_headers, setup_test):
    test_id, student_id = setup_test
    client.post(
        "/api/v1/marks/bulk",
        json={"test_id": test_id, "records": [{"student_id": student_id, "obtained_marks": 92}]},
        headers=auth_headers,
    )
    resp = client.get(f"/api/v1/marks/notifications?test_id={test_id}", headers=auth_headers)
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["student_id"] == student_id
    assert items[0]["obtained_marks"] == 92.0
    assert "web.whatsapp.com" in items[0]["whatsapp_web_url"]

