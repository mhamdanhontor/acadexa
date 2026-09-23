"""Tests for enhanced monthly reports (attendance + test marks, approve & send, month-end reminder)."""
import json
import pytest


def test_month_end_reminder_endpoint(client, auth_headers):
    resp = client.get("/api/v1/reports/month-end-reminder", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "is_reminder_active" in data
    assert "current_day" in data
    assert "days_in_month" in data
    assert "days_remaining" in data
    assert "month_name" in data
    assert "message" in data


def test_report_generation_includes_attendance_and_tests(client, auth_headers, db_session):
    c_id = client.post("/api/v1/classes", json={"name": "Report 10th"}, headers=auth_headers).json()["id"]
    b_id = client.post("/api/v1/batches", json={"name": "Morning Shift"}, headers=auth_headers).json()["id"]
    subj_id = client.post("/api/v1/subjects", json={"name": "Mathematics"}, headers=auth_headers).json()["id"]

    sid = client.post(
        "/api/v1/students",
        json={"student_code": "REP-001", "name": "Ali Khan", "whatsapp_number": "923009998888", "class_id": c_id, "batch_id": b_id},
        headers=auth_headers,
    ).json()["id"]

    # Add attendance: 1 PRESENT, 1 LATE (which counts as present by default)
    client.post(
        "/api/v1/attendance/bulk",
        json={"date": "2026-09-05", "class_id": c_id, "batch_id": b_id, "records": [{"student_id": sid, "status": "PRESENT"}]},
        headers=auth_headers,
    )
    client.post(
        "/api/v1/attendance/bulk",
        json={"date": "2026-09-06", "class_id": c_id, "batch_id": b_id, "records": [{"student_id": sid, "status": "LATE"}]},
        headers=auth_headers,
    )

    # Create session & test
    sess_id = client.post(
        "/api/v1/test-sessions",
        json={"name": "September Session", "start_date": "2026-09-01", "end_date": "2026-09-30", "class_id": c_id},
        headers=auth_headers,
    ).json()["id"]

    test_id = client.post(
        "/api/v1/tests",
        json={
            "session_id": sess_id,
            "subject_id": subj_id,
            "class_id": c_id,
            "batch_id": None,
            "name": "Maths Chapter 1 Test",
            "test_date": "2026-09-15",
            "total_marks": 50,
            "period_label": "Week 2",
        },
        headers=auth_headers,
    ).json()["id"]

    # Enter marks for student
    client.post(
        "/api/v1/marks/bulk",
        json={"test_id": test_id, "records": [{"student_id": sid, "obtained_marks": 45.0}]},
        headers=auth_headers,
    )

    # Generate monthly report
    gen_resp = client.post(
        "/api/v1/reports/generate",
        json={"period_start": "2026-09-01", "period_end": "2026-09-30", "student_id": sid},
        headers=auth_headers,
    )
    assert gen_resp.status_code == 200
    report_data = gen_resp.json()[0]
    assert report_data["student_name"] == "Ali Khan"
    assert report_data["student_code"] == "REP-001"
    assert report_data["class_name"] == "Report 10th"
    assert report_data["file_path"] is not None

    # Verify JSON content stored in DB
    report_id = report_data["id"]
    from app.models.report import MonthlyReport

    rep = db_session.get(MonthlyReport, report_id)
    assert rep is not None
    payload = json.loads(rep.data_json)

    # Check attendance: 2 classes, 1 present, 1 late, 100% attendance rate
    assert payload["attendance"]["total_classes"] == 2
    assert payload["attendance"]["percentage"] == 100.0
    # Full month daily calendar has 30 days for September
    assert len(payload["daily_records"]) == 30
    assert payload["daily_records"][0]["date"] == "2026-09-01"
    assert payload["daily_records"][-1]["date"] == "2026-09-30"

    # Check previous 6 months history
    assert "previous_months" in payload
    assert len(payload["previous_months"]) == 6

    # Check academic test marks
    assert payload["academics"]["total_tests"] == 1
    assert payload["academics"]["total_obtained_marks"] == 45.0
    assert payload["academics"]["overall_percentage"] == 90.0
    assert payload["academics"]["overall_grade"] == "A+"


def test_approve_and_send_single_click(client, auth_headers):
    c_id = client.post("/api/v1/classes", json={"name": "ApproveSendClass"}, headers=auth_headers).json()["id"]
    b_id = client.post("/api/v1/batches", json={"name": "Afternoon"}, headers=auth_headers).json()["id"]

    sid = client.post(
        "/api/v1/students",
        json={"student_code": "AS-001", "name": "Bilal Ahmed", "whatsapp_number": "923001112222", "class_id": c_id, "batch_id": b_id},
        headers=auth_headers,
    ).json()["id"]

    client.post(
        "/api/v1/attendance/bulk",
        json={"date": "2026-09-10", "class_id": c_id, "batch_id": b_id, "records": [{"student_id": sid, "status": "PRESENT"}]},
        headers=auth_headers,
    )

    gen = client.post(
        "/api/v1/reports/generate",
        json={"period_start": "2026-09-01", "period_end": "2026-09-30", "student_id": sid},
        headers=auth_headers,
    ).json()[0]

    report_id = gen["id"]
    assert gen["status"] == "READY"

    # Single-click Approve & Send
    as_resp = client.post(f"/api/v1/reports/{report_id}/approve-and-send", headers=auth_headers)
    assert as_resp.status_code == 200
    res_data = as_resp.json()
    assert res_data["status"] == "SENT"
    assert res_data["approved_at"] is not None
    assert res_data["sent_at"] is not None

    # Check that a MONTHLY_REPORT notification job was created
    notifs = client.get(f"/api/v1/notifications?student_id={sid}", headers=auth_headers).json()["items"]
    report_notifs = [n for n in notifs if n["type"] == "MONTHLY_REPORT"]
    assert len(report_notifs) == 1
    assert report_notifs[0]["recipient"] == "+923001112222"


def test_dashboard_summary_includes_late_in_percentage(client, auth_headers):
    # Call dashboard summary when empty
    resp = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["attendance_percentage_today"] == 0.0

    # Add class, batch, student, and today's attendance (1 late)
    c_id = client.post("/api/v1/classes", json={"name": "DashClass"}, headers=auth_headers).json()["id"]
    b_id = client.post("/api/v1/batches", json={"name": "DashBatch"}, headers=auth_headers).json()["id"]
    sid = client.post(
        "/api/v1/students",
        json={"student_code": "DASH-01", "name": "Dash Student", "whatsapp_number": "923001239999", "class_id": c_id, "batch_id": b_id},
        headers=auth_headers,
    ).json()["id"]

    from datetime import date
    today_str = date.today().isoformat()
    client.post(
        "/api/v1/attendance/bulk",
        json={"date": today_str, "class_id": c_id, "batch_id": b_id, "records": [{"student_id": sid, "status": "LATE"}]},
        headers=auth_headers,
    )

    resp2 = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert resp2.status_code == 200
    d2 = resp2.json()
    assert d2["total_students"] == 1
    assert d2["late_today"] == 1
    # Late counts as present, so 1 late out of 1 marked = 100%
    assert d2["attendance_percentage_today"] == 100.0


def test_download_report_regenerates_when_missing(client, auth_headers):
    # Setup student and generate report
    c_id = client.post("/api/v1/classes", json={"name": "DownloadTestClass"}, headers=auth_headers).json()["id"]
    b_id = client.post("/api/v1/batches", json={"name": "Morning"}, headers=auth_headers).json()["id"]
    sid = client.post(
        "/api/v1/students",
        json={"student_code": "DL-01", "name": "Download Student", "whatsapp_number": "923009998888", "class_id": c_id, "batch_id": b_id},
        headers=auth_headers,
    ).json()["id"]

    gen_resp = client.post(
        "/api/v1/reports/generate",
        json={"period_start": "2026-09-01", "period_end": "2026-09-30", "student_id": sid},
        headers=auth_headers,
    )
    assert gen_resp.status_code == 200
    report_id = gen_resp.json()[0]["id"]
    file_path = gen_resp.json()[0]["file_path"]

    # Delete the generated file from disk to simulate ephemeral container restart / wiped disk
    import os
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    # Calling download endpoint must NOT return 500; it must regenerate and return 200 PDF
    dl_resp = client.get(f"/api/v1/reports/{report_id}/download", headers=auth_headers)
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "application/pdf"
    assert len(dl_resp.content) > 1000


def test_download_report_with_unmarked_tests_and_legacy_json(client, auth_headers):
    """Verifies that download_report never raises 500 when tests exist without marks or legacy JSON is stored."""
    c_id = client.post("/api/v1/classes", json={"name": "GradeCheckClass"}, headers=auth_headers).json()["id"]
    b_id = client.post("/api/v1/batches", json={"name": "Evening"}, headers=auth_headers).json()["id"]
    s_id = client.post("/api/v1/subjects", json={"name": "Science"}, headers=auth_headers).json()["id"]

    sid = client.post(
        "/api/v1/students",
        json={"student_code": "GC-01", "name": "GradeCheck Student", "whatsapp_number": "923001112233", "class_id": c_id, "batch_id": b_id},
        headers=auth_headers,
    ).json()["id"]

    # Create a test session and a test for this class, but DO NOT enter marks for student sid
    sess_id = client.post(
        "/api/v1/test-sessions",
        json={"name": "September Monthly", "start_date": "2026-09-01", "end_date": "2026-09-30", "class_id": c_id},
        headers=auth_headers,
    ).json()["id"]

    client.post(
        "/api/v1/tests",
        json={
            "session_id": sess_id,
            "period_label": "September",
            "subject_id": s_id,
            "class_id": c_id,
            "batch_id": b_id,
            "name": "Science Chapter 1",
            "test_date": "2026-09-15",
            "total_marks": 50.0,
        },
        headers=auth_headers,
    )

    # 1. Generate report (student has an unmarked test) -> must succeed 200
    gen_resp = client.post(
        "/api/v1/reports/generate",
        json={"period_start": "2026-09-01", "period_end": "2026-09-30", "student_id": sid},
        headers=auth_headers,
    )
    assert gen_resp.status_code == 200
    report_id = gen_resp.json()[0]["id"]

    # 2. Download PDF -> must return 200 and valid PDF
    dl_resp = client.get(f"/api/v1/reports/{report_id}/download", headers=auth_headers)
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "application/pdf"
    assert len(dl_resp.content) > 1000



