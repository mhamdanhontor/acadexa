"""Test (exam) API."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.academics import Test
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.academics import TestCreate, TestOut, TestUpdate
from app.services.audit_service import record_audit

router = APIRouter(prefix="/tests", tags=["Tests"])


@router.get("", response_model=list[TestOut])
def list_tests(
    session_id: Optional[int] = None,
    class_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Test)
    if session_id is not None:
        q = q.filter(Test.session_id == session_id)
    if class_id is not None:
        q = q.filter(Test.class_id == class_id)
    if batch_id is not None:
        q = q.filter(Test.batch_id == batch_id)
    if subject_id is not None:
        q = q.filter(Test.subject_id == subject_id)
    return q.order_by(Test.test_date.desc()).all()


@router.post("", response_model=TestOut, status_code=201)
def create_test(
    payload: TestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    obj = Test(**payload.model_dump(), created_by=current_user.id)
    db.add(obj)
    db.flush()
    record_audit(db, current_user.id, "TEST_CREATED", "test", obj.id, f"Created test {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/{test_id}", response_model=TestOut)
def get_test(test_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    obj = db.get(Test, test_id)
    if obj is None:
        raise NotFoundError("Test not found.")
    return obj


@router.put("/{test_id}", response_model=TestOut)
def update_test(
    test_id: int,
    payload: TestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    obj = db.get(Test, test_id)
    if obj is None:
        raise NotFoundError("Test not found.")
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(obj, field, value)
    record_audit(db, current_user.id, "TEST_UPDATED", "test", obj.id, f"Updated test {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{test_id}", status_code=204)
def delete_test(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    obj = db.get(Test, test_id)
    if obj is None:
        raise NotFoundError("Test not found.")

    from app.models.academics import Marks
    db.query(Marks).filter(Marks.test_id == test_id).delete(synchronize_session=False)

    test_name = obj.name
    db.delete(obj)
    record_audit(db, current_user.id, "TEST_DELETED", "test", test_id, f"Deleted test {test_name}")
    db.commit()
    return None

