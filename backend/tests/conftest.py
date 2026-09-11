"""Shared pytest fixtures: isolated test database, FastAPI TestClient, auth helpers."""
import os

os.environ["DATABASE_URL"] = "postgresql+psycopg2://acadexa:acadexa_dev_pass_2026@localhost:5432/acadexa_test_db"
os.environ["WHATSAPP_PROVIDER"] = "fake"

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.session import Base
import app.models  # noqa: F401 ensures models are registered
from app.core.config import get_settings
from app.core.security import hash_password

TEST_DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(TEST_DATABASE_URL, future=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Recreate all tables fresh for every test function — guarantees isolation."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    from app.db.session import get_db
    from app.main import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def seed_roles(db_session):
    from app.models.user import Permission, Role

    perms = {}
    for code in [
        "manage_students", "manage_attendance", "manage_marks",
        "manage_reports", "manage_notifications", "manage_users",
        "manage_backups", "manage_settings",
    ]:
        p = Permission(code=code, description=code)
        db_session.add(p)
        db_session.flush()
        perms[code] = p

    roles = {}
    role_perms = {
        "SUPER_ADMIN": list(perms.keys()),
        "ADMIN": ["manage_students", "manage_attendance", "manage_marks", "manage_reports", "manage_notifications", "manage_settings"],
        "TEACHER": ["manage_attendance", "manage_marks"],
    }
    for name, codes in role_perms.items():
        r = Role(name=name, description=name)
        db_session.add(r)
        db_session.flush()
        r.permissions = [perms[c] for c in codes]
        roles[name] = r
    db_session.commit()
    return roles


@pytest.fixture
def super_admin_user(db_session, seed_roles):
    from app.models.user import User

    user = User(
        full_name="Test Super Admin",
        email="superadmin@test.com",
        hashed_password=hash_password("Password123"),
        role_id=seed_roles["SUPER_ADMIN"].id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def teacher_user(db_session, seed_roles):
    from app.models.user import User

    user = User(
        full_name="Test Teacher",
        email="teacher@test.com",
        hashed_password=hash_password("Password123"),
        role_id=seed_roles["TEACHER"].id,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, super_admin_user):
    resp = client.post("/api/v1/auth/login", json={"email": "superadmin@test.com", "password": "Password123"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def teacher_auth_headers(client, teacher_user):
    resp = client.post("/api/v1/auth/login", json={"email": "teacher@test.com", "password": "Password123"})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
