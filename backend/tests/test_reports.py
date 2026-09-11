"""Monthly report approval workflow tests (requirement #32)."""
import pytest


@pytest.fixture
def student_with_attendance(client, auth_headers):
    class_id = client.post("/api/v1/classes", json={"name": "12th"}, headers=auth_headers).json()["id"]
    batch_id = client.post("/api/v1/batches", json={"name": "Afternoon"}, headers=auth_headers).json()["id"]
    student_id = client.post(
        "/api/v1/students",
        json={"student_code": "R001", "name": "Report Student", "whatsapp_number": "923004440000", "class_id": class_id, "batch_id": batch_id},
        headers=auth_headers,
    ).json()["id"]

    client.post(
        "/api/v1/attendance/bulk",
        json={"date": "2026-06-01", "class_id": class_id, "batch_id": batch_id, "records": [{"student_id": student_id, "status": "PRESENT"}]},
        headers=auth_headers,
    )
    return student_id


def test_generate_report_creates_ready_status(client, auth_headers, student_with_attendance):
    resp = client.post(
        "/api/v1/reports/generate",
        json={"period_start": "2026-06-01", "period_end": "2026-06-30", "student_id": student_with_attendance},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    reports = resp.json()
    assert len(reports) == 1
    assert reports[0]["status"] == "READY"
    assert reports[0]["file_path"] is not None  # PDF generated


def test_cannot_send_report_before_approval(client, auth_headers, student_with_attendance):
    gen_resp = client.post(
        "/api/v1/reports/generate",
        json={"period_start": "2026-06-01", "period_end": "2026-06-30", "student_id": student_with_attendance},
        headers=auth_headers,
    )
    report_id = gen_resp.json()[0]["id"]

    send_resp = client.post(f"/api/v1/reports/{report_id}/send", headers=auth_headers)
    assert send_resp.status_code == 409
    assert send_resp.json()["error"]["code"] == "REPORT_NOT_APPROVED"


def test_approve_then_send_report_workflow(client, auth_headers, student_with_attendance):
    gen_resp = client.post(
        "/api/v1/reports/generate",
        json={"period_start": "2026-06-01", "period_end": "2026-06-30", "student_id": student_with_attendance},
        headers=auth_headers,
    )
    report_id = gen_resp.json()[0]["id"]

    approve_resp = client.post(f"/api/v1/reports/{report_id}/approve", json={"approve": True}, headers=auth_headers)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"

    send_resp = client.post(f"/api/v1/reports/{report_id}/send", headers=auth_headers)
    assert send_resp.status_code == 200
    assert send_resp.json()["status"] == "SENT"

    # A MONTHLY_REPORT notification job should now exist
    notif_resp = client.get("/api/v1/notifications?type=MONTHLY_REPORT", headers=auth_headers)
    assert len(notif_resp.json()["items"]) == 1


def test_reject_report_returns_to_draft(client, auth_headers, student_with_attendance):
    gen_resp = client.post(
        "/api/v1/reports/generate",
        json={"period_start": "2026-06-01", "period_end": "2026-06-30", "student_id": student_with_attendance},
        headers=auth_headers,
    )
    report_id = gen_resp.json()[0]["id"]

    reject_resp = client.post(f"/api/v1/reports/{report_id}/approve", json={"approve": False}, headers=auth_headers)
    assert reject_resp.status_code == 200
    assert reject_resp.json()["status"] == "DRAFT"


def test_cannot_approve_already_sent_report(client, auth_headers, student_with_attendance):
    gen_resp = client.post(
        "/api/v1/reports/generate",
        json={"period_start": "2026-06-01", "period_end": "2026-06-30", "student_id": student_with_attendance},
        headers=auth_headers,
    )
    report_id = gen_resp.json()[0]["id"]
    client.post(f"/api/v1/reports/{report_id}/approve", json={"approve": True}, headers=auth_headers)
    client.post(f"/api/v1/reports/{report_id}/send", headers=auth_headers)

    second_approve = client.post(f"/api/v1/reports/{report_id}/approve", json={"approve": True}, headers=auth_headers)
    assert second_approve.status_code == 409
    assert second_approve.json()["error"]["code"] == "REPORT_INVALID_STATE"
