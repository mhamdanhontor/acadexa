"""Test Session API."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.academics import TestSession
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.academics import TestSessionCreate, TestSessionOut
from app.services.audit_service import record_audit

router = APIRouter(prefix="/test-sessions", tags=["Test Sessions"])


@router.get("", response_model=list[TestSessionOut])
def list_test_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(TestSession).order_by(TestSession.start_date.desc()).all()


@router.post("", response_model=TestSessionOut, status_code=201)
def create_test_session(
    payload: TestSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    obj = TestSession(**payload.model_dump())
    db.add(obj)
    db.flush()
    record_audit(db, current_user.id, "TEST_SESSION_CREATED", "test_session", obj.id, f"Created {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj
