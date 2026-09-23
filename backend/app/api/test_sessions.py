"""Test Session API."""
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.academic_structure import ClassRoom
from app.models.academics import TestSession
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.academics import TestSessionCreate, TestSessionOut, TestSessionUpdate
from app.services.audit_service import record_audit

router = APIRouter(prefix="/test-sessions", tags=["Test Sessions"])


def _to_out(session_obj: TestSession) -> TestSessionOut:
    out = TestSessionOut.model_validate(session_obj)
    if session_obj.class_room:
        out.class_name = session_obj.class_room.name
    return out


@router.get("", response_model=list[TestSessionOut])
def list_test_sessions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = (
        db.query(TestSession)
        .options(joinedload(TestSession.class_room))
        .order_by(TestSession.start_date.desc())
        .all()
    )
    return [_to_out(s) for s in sessions]


@router.post("", response_model=TestSessionOut, status_code=201)
def create_test_session(
    payload: TestSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    if payload.class_id is not None:
        cls_obj = db.get(ClassRoom, payload.class_id)
        if not cls_obj:
            raise NotFoundError("Class not found.")

    obj = TestSession(**payload.model_dump())
    db.add(obj)
    db.flush()
    record_audit(db, current_user.id, "TEST_SESSION_CREATED", "test_session", obj.id, f"Created {obj.name}")
    db.commit()
    db.refresh(obj)
    return _to_out(obj)


@router.get("/{session_id}", response_model=TestSessionOut)
def get_test_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = (
        db.query(TestSession)
        .options(joinedload(TestSession.class_room))
        .filter(TestSession.id == session_id)
        .first()
    )
    if obj is None:
        raise NotFoundError("Test session not found.")
    return _to_out(obj)


@router.put("/{session_id}", response_model=TestSessionOut)
def update_test_session(
    session_id: int,
    payload: TestSessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    obj = db.get(TestSession, session_id)
    if obj is None:
        raise NotFoundError("Test session not found.")

    data = payload.model_dump(exclude_unset=True)
    if "class_id" in data and data["class_id"] is not None:
        cls_obj = db.get(ClassRoom, data["class_id"])
        if not cls_obj:
            raise NotFoundError("Class not found.")

    for field, val in data.items():
        setattr(obj, field, val)

    record_audit(db, current_user.id, "TEST_SESSION_UPDATED", "test_session", obj.id, f"Updated session {obj.name}")
    db.commit()
    db.refresh(obj)
    return _to_out(obj)


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

