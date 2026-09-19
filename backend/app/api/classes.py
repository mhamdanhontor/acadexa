"""Class management API."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import ConflictError, NotFoundError
from app.db.session import get_db
from app.models.academic_structure import ClassRoom
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.academic_structure import ClassCreate, ClassOut, ClassUpdate, StatusUpdate
from app.schemas.common import PaginatedResponse
from app.services.audit_service import record_audit
from app.utils.pagination import paginate

router = APIRouter(prefix="/classes", tags=["Classes"])


@router.get("", response_model=PaginatedResponse[ClassOut])
def list_classes(
    active_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ClassRoom).order_by(ClassRoom.name)
    if active_only:
        stmt = stmt.where(ClassRoom.is_active.is_(True))
    items, total, total_pages = paginate(db, stmt, page, page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.post("", response_model=ClassOut, status_code=201)
def create_class(
    payload: ClassCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    existing = db.query(ClassRoom).filter(ClassRoom.name == payload.name).first()
    if existing:
        raise ConflictError("A class with this name already exists.", code="CLASS_EXISTS")

    obj = ClassRoom(**payload.model_dump())
    db.add(obj)
    db.flush()
    record_audit(db, current_user.id, "CLASS_CREATED", "class", obj.id, f"Created class {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: int,
    payload: ClassUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    obj = db.get(ClassRoom, class_id)
    if obj is None:
        raise NotFoundError("Class not found.")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(obj, key, value)
    record_audit(db, current_user.id, "CLASS_UPDATED", "class", obj.id, f"Updated class {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{class_id}/status", response_model=ClassOut)
def update_class_status(
    class_id: int,
    payload: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    obj = db.get(ClassRoom, class_id)
    if obj is None:
        raise NotFoundError("Class not found.")
    obj.is_active = payload.is_active
    record_audit(db, current_user.id, "CLASS_STATUS_CHANGED", "class", obj.id, f"is_active={payload.is_active}")
    db.commit()
    db.refresh(obj)
    return obj
