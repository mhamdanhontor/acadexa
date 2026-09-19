"""Student CRUD, search, filters, soft-delete tests."""
import pytest


@pytest.fixture
def class_and_batch(client, auth_headers):
    class_resp = client.post("/api/v1/classes", json={"name": "9th"}, headers=auth_headers)
    batch_resp = client.post("/api/v1/batches", json={"name": "Evening"}, headers=auth_headers)
    return class_resp.json()["id"], batch_resp.json()["id"]


def test_create_student(client, auth_headers, class_and_batch):
    class_id, batch_id = class_and_batch
    resp = client.post(
        "/api/v1/students",
        json={
            "student_code": "S001",
            "name": "Fatima Noor",
            "guardian_name": "Noor Sr",
            "whatsapp_number": "923001112222",
            "class_id": class_id,
            "batch_id": batch_id,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["student_code"] == "S001"
    assert data["whatsapp_number"] == "+923001112222"  # normalized
    assert data["is_active"] is True


def test_create_student_auto_generates_unique_code(client, auth_headers, class_and_batch):
    class_id, batch_id = class_and_batch
    resp = client.post(
        "/api/v1/students",
        json={
            "name": "Auto ID Student",
            "whatsapp_number": "03001239999",
            "class_id": class_id,
            "batch_id": batch_id,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["student_code"].startswith("HKA-")
    assert data["whatsapp_number"] == "+923001239999"


def test_create_student_duplicate_code_fails(client, auth_headers, class_and_batch):
    class_id, batch_id = class_and_batch
    payload = {
        "student_code": "S002",
        "name": "Ahmed",
        "whatsapp_number": "923001112223",
        "class_id": class_id,
        "batch_id": batch_id,
    }
    r1 = client.post("/api/v1/students", json=payload, headers=auth_headers)
    assert r1.status_code == 201
    r2 = client.post("/api/v1/students", json=payload, headers=auth_headers)
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "STUDENT_CODE_EXISTS"


def test_create_student_invalid_class_404(client, auth_headers, class_and_batch):
    _, batch_id = class_and_batch
    resp = client.post(
        "/api/v1/students",
        json={
            "student_code": "S003",
            "name": "X",
            "whatsapp_number": "923001112224",
            "class_id": 9999,
            "batch_id": batch_id,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_search_student_by_name(client, auth_headers, class_and_batch):
    class_id, batch_id = class_and_batch
    client.post(
        "/api/v1/students",
        json={"student_code": "S004", "name": "Zainab Ali", "whatsapp_number": "923005556666", "class_id": class_id, "batch_id": batch_id},
        headers=auth_headers,
    )
    resp = client.get("/api/v1/students?search=Zainab", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Zainab Ali"


def test_deactivate_student_soft_delete(client, auth_headers, class_and_batch):
    class_id, batch_id = class_and_batch
    create_resp = client.post(
        "/api/v1/students",
        json={"student_code": "S005", "name": "Bilal", "whatsapp_number": "923007778888", "class_id": class_id, "batch_id": batch_id},
        headers=auth_headers,
    )
    student_id = create_resp.json()["id"]

    resp = client.patch(f"/api/v1/students/{student_id}/status", json={"is_active": False}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Student still exists (soft delete, not physically removed)
    get_resp = client.get(f"/api/v1/students/{student_id}", headers=auth_headers)
    assert get_resp.status_code == 200


def test_delete_endpoint_is_soft_delete(client, auth_headers, class_and_batch):
    class_id, batch_id = class_and_batch
    create_resp = client.post(
        "/api/v1/students",
        json={"student_code": "S006", "name": "Hina", "whatsapp_number": "923009990000", "class_id": class_id, "batch_id": batch_id},
        headers=auth_headers,
    )
    student_id = create_resp.json()["id"]

    resp = client.delete(f"/api/v1/students/{student_id}", headers=auth_headers)
    assert resp.status_code == 204

    get_resp = client.get(f"/api/v1/students/{student_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["is_active"] is False
