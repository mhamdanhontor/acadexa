"""Test Session API."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import NotFoundError
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


@router.delete("/{session_id}", status_code=204)
def delete_test_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    obj = db.get(TestSession, session_id)
    if obj is None:
        raise NotFoundError("Test session not found.")

    from app.models.academics import Marks, Test
    tests = db.query(Test).filter(Test.session_id == session_id).all()
    test_ids = [t.id for t in tests]
    if test_ids:
        db.query(Marks).filter(Marks.test_id.in_(test_ids)).delete(synchronize_session=False)
        db.query(Test).filter(Test.session_id == session_id).delete(synchronize_session=False)

    session_name = obj.name
    db.delete(obj)
    record_audit(db, current_user.id, "TEST_SESSION_DELETED", "test_session", session_id, f"Deleted session {session_name}")
    db.commit()
    return None

