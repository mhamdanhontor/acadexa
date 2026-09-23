"""Tests for test sessions, class linking, and tests batch configuration."""
import pytest


def test_create_session_with_class(client, auth_headers):
    # Create class
    class_resp = client.post("/api/v1/classes", json={"name": "Grade 10"}, headers=auth_headers)
    assert class_resp.status_code == 201
    class_id = class_resp.json()["id"]

    # Create session with class_id
    sess_resp = client.post(
        "/api/v1/test-sessions",
        json={
            "name": "Mid-Term Evaluation 2026",
            "start_date": "2026-09-01",
            "end_date": "2026-10-31",
            "period_count": 2,
            "class_id": class_id,
        },
        headers=auth_headers,
    )
    assert sess_resp.status_code == 201
    data = sess_resp.json()
    assert data["class_id"] == class_id
    assert data["class_name"] == "Grade 10"


def test_update_session_class(client, auth_headers):
    c1 = client.post("/api/v1/classes", json={"name": "Class 9th"}, headers=auth_headers).json()["id"]
    c2 = client.post("/api/v1/classes", json={"name": "Class 10th"}, headers=auth_headers).json()["id"]

    # Create without class
    s = client.post(
        "/api/v1/test-sessions",
        json={
            "name": "Initial Session",
            "start_date": "2026-09-01",
            "end_date": "2026-09-30",
            "period_count": 1,
        },
        headers=auth_headers,
    ).json()
    assert s["class_id"] is None

    # Update session to assign class
    update_resp = client.put(
        f"/api/v1/test-sessions/{s['id']}",
        json={"class_id": c2, "name": "Updated 10th Session"},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    up_data = update_resp.json()
    assert up_data["class_id"] == c2
    assert up_data["class_name"] == "Class 10th"
    assert up_data["name"] == "Updated 10th Session"


def test_create_test_without_batch_for_whole_class(client, auth_headers):
    c_id = client.post("/api/v1/classes", json={"name": "Matric"}, headers=auth_headers).json()["id"]
    subj_id = client.post("/api/v1/subjects", json={"name": "Chemistry"}, headers=auth_headers).json()["id"]
    sess_id = client.post(
        "/api/v1/test-sessions",
        json={"name": "Matric Session", "start_date": "2026-09-01", "end_date": "2026-09-30", "class_id": c_id},
        headers=auth_headers,
    ).json()["id"]

    # Create test with null batch_id (whole class across all batches)
    test_resp = client.post(
        "/api/v1/tests",
        json={
            "session_id": sess_id,
            "subject_id": subj_id,
            "class_id": c_id,
            "batch_id": None,
            "name": "Chapter 1 Chemistry Test",
            "test_date": "2026-09-15",
            "total_marks": 50,
            "period_label": "Week 2",
        },
        headers=auth_headers,
    )
    assert test_resp.status_code == 201
    assert test_resp.json()["batch_id"] is None
