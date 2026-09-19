"""Authentication & authorization tests."""


def test_login_success(client, super_admin_user):
    resp = client.post("/api/v1/auth/login", json={"email": "superadmin@test.com", "password": "Password123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client, super_admin_user):
    resp = client.post("/api/v1/auth/login", json={"email": "superadmin@test.com", "password": "wrong"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "AUTHENTICATION_ERROR"


def test_login_nonexistent_user(client):
    resp = client.post("/api/v1/auth/login", json={"email": "nobody@test.com", "password": "whatever"})
    assert resp.status_code == 401


def test_login_inactive_user(client, db_session, super_admin_user):
    super_admin_user.is_active = False
    db_session.commit()
    resp = client.post("/api/v1/auth/login", json={"email": "superadmin@test.com", "password": "Password123"})
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_returns_current_user(client, auth_headers):
    resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "superadmin@test.com"
    assert data["role_name"] == "SUPER_ADMIN"
    assert "manage_students" in data["permissions"]


def test_teacher_cannot_create_class(client, teacher_auth_headers):
    resp = client.post("/api/v1/classes", json={"name": "10th"}, headers=teacher_auth_headers)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "AUTHORIZATION_ERROR"


def test_super_admin_can_create_class(client, auth_headers):
    resp = client.post("/api/v1/classes", json={"name": "10th"}, headers=auth_headers)
    assert resp.status_code == 201


def test_invalid_token_rejected(client):
    resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage.invalid.token"})
    assert resp.status_code == 401
