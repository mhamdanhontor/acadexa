"""Batch management API."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import ConflictError, NotFoundError
from app.db.session import get_db
from app.models.academic_structure import Batch
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.academic_structure import BatchCreate, BatchOut, BatchUpdate, StatusUpdate
from app.schemas.common import PaginatedResponse
from app.services.audit_service import record_audit
from app.utils.pagination import paginate

router = APIRouter(prefix="/batches", tags=["Batches"])


@router.get("", response_model=PaginatedResponse[BatchOut])
def list_batches(
    active_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Batch).order_by(Batch.name)
    if active_only:
        stmt = stmt.where(Batch.is_active.is_(True))
    items, total, total_pages = paginate(db, stmt, page, page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.post("", response_model=BatchOut, status_code=201)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    existing = db.query(Batch).filter(Batch.name == payload.name).first()
    if existing:
        raise ConflictError("A batch with this name already exists.", code="BATCH_EXISTS")

    obj = Batch(**payload.model_dump())
    db.add(obj)
    db.flush()
    record_audit(db, current_user.id, "BATCH_CREATED", "batch", obj.id, f"Created batch {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{batch_id}", response_model=BatchOut)
def update_batch(
    batch_id: int,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    obj = db.get(Batch, batch_id)
    if obj is None:
        raise NotFoundError("Batch not found.")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(obj, key, value)
    record_audit(db, current_user.id, "BATCH_UPDATED", "batch", obj.id, f"Updated batch {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{batch_id}/status", response_model=BatchOut)
def update_batch_status(
    batch_id: int,
    payload: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    obj = db.get(Batch, batch_id)
    if obj is None:
        raise NotFoundError("Batch not found.")
    obj.is_active = payload.is_active
    record_audit(db, current_user.id, "BATCH_STATUS_CHANGED", "batch", obj.id, f"is_active={payload.is_active}")
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{batch_id}", status_code=204)
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    obj = db.get(Batch, batch_id)
    if obj is None:
        raise NotFoundError("Batch not found.")

    from app.models.student import Student
    active_students = db.query(Student).filter(Student.batch_id == batch_id, Student.is_active.is_(True)).count()
    if active_students > 0:
        raise ConflictError(f"Cannot delete batch '{obj.name}' because {active_students} active student(s) are enrolled in it.", code="BATCH_HAS_STUDENTS")

    from app.models.academics import Marks, Test
    tests = db.query(Test).filter(Test.batch_id == batch_id).all()
    test_ids = [t.id for t in tests]
    if test_ids:
        db.query(Marks).filter(Marks.test_id.in_(test_ids)).delete(synchronize_session=False)
        db.query(Test).filter(Test.batch_id == batch_id).delete(synchronize_session=False)

    batch_name = obj.name
    db.delete(obj)
    record_audit(db, current_user.id, "BATCH_DELETED", "batch", batch_id, f"Deleted batch {batch_name}")
    db.commit()
    return None

