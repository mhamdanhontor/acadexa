"""Marks API."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.academics import Marks, Test
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.academics import BulkMarksRequest, BulkMarksResult, MarksDispatchItemOut, MarksOut
from app.schemas.quick_marks import QuickMarksRequest, QuickMarksResult
from app.schemas.common import PaginatedResponse
from app.services.marks_service import get_marks_notifications, save_bulk_marks, save_quick_marks
from app.utils.pagination import paginate

router = APIRouter(prefix="/marks", tags=["Marks"])


@router.get("", response_model=PaginatedResponse[MarksOut])
def list_marks(
    student_id: Optional[int] = None,
    test_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Marks).options(joinedload(Marks.test))
    if student_id is not None:
        stmt = stmt.where(Marks.student_id == student_id)
    if test_id is not None:
        stmt = stmt.where(Marks.test_id == test_id)
    stmt = stmt.order_by(Marks.created_at.desc())

    items, total, total_pages = paginate(db, stmt, page, page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/notifications", response_model=list[MarksDispatchItemOut])
def list_marks_notifications(
    test_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_marks_notifications(db, test_id)


@router.post("/bulk", response_model=BulkMarksResult)
def bulk_marks(
    payload: BulkMarksRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    return save_bulk_marks(db, payload, current_user.id)


@router.post("/quick", response_model=QuickMarksResult)
def quick_marks(
    payload: QuickMarksRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    return save_quick_marks(db, payload, current_user.id)


@router.put("/{marks_id}", response_model=MarksOut)
def update_marks(
    marks_id: int,
    obtained_marks: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    row = db.get(Marks, marks_id)
    if row is None:
        raise NotFoundError("Marks record not found.")
    if obtained_marks < 0 or obtained_marks > row.total_marks:
        from app.core.errors import ValidationAppError

        raise ValidationAppError(
            f"obtained_marks must be between 0 and {row.total_marks}.", code="INVALID_MARKS_RANGE"
        )
    row.obtained_marks = obtained_marks
    row.percentage = round((obtained_marks / row.total_marks) * 100, 2)
    row.entered_by = current_user.id
    db.commit()
    db.refresh(row)
    return row
