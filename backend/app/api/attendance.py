"""Attendance API."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.attendance import Attendance
from app.models.enums import AttendanceStatus, RoleName
from app.models.user import User
from app.schemas.all_enrolled_attendance import (
    AllEnrolledAttendanceSaveRequest,
    AllEnrolledAttendanceSaveResult,
    AllEnrolledStudentItemOut,
)
from app.schemas.attendance import (
    AbsentNotificationOut,
    AttendanceOut,
    AttendanceSummary,
    AttendanceUpdate,
    BulkAttendanceRequest,
    BulkAttendanceResult,
)
from app.schemas.common import PaginatedResponse
from app.services.attendance_service import (
    calculate_attendance_summary,
    get_absent_notifications,
    get_all_enrolled_attendance_roster,
    save_bulk_attendance,
    save_global_attendance,
)
from app.services.audit_service import record_audit
from app.utils.pagination import paginate

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("", response_model=PaginatedResponse[AttendanceOut])
def list_attendance(
    student_id: Optional[int] = None,
    class_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[AttendanceStatus] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Attendance)
    if student_id is not None:
        stmt = stmt.where(Attendance.student_id == student_id)
    if class_id is not None:
        stmt = stmt.where(Attendance.class_id == class_id)
    if batch_id is not None:
        stmt = stmt.where(Attendance.batch_id == batch_id)
    if date_from is not None:
        stmt = stmt.where(Attendance.date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Attendance.date <= date_to)
    if status is not None:
        stmt = stmt.where(Attendance.status == status)
    stmt = stmt.order_by(Attendance.date.desc())

    items, total, total_pages = paginate(db, stmt, page, page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/date", response_model=list[AttendanceOut])
def get_attendance_by_date(
    date_: date = Query(alias="date"),
    class_id: int = Query(...),
    batch_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Attendance)
        .filter(Attendance.date == date_, Attendance.class_id == class_id, Attendance.batch_id == batch_id)
        .all()
    )
    return rows


@router.get("/absent-notifications", response_model=list[AbsentNotificationOut])
def list_absent_notifications(
    date_: date = Query(alias="date"),
    class_id: int = Query(...),
    batch_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_absent_notifications(db, date_, class_id, batch_id)


@router.post("/bulk", response_model=BulkAttendanceResult)
def bulk_attendance(
    payload: BulkAttendanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    return save_bulk_attendance(db, payload, current_user.id)


@router.get("/all-enrolled", response_model=list[AllEnrolledStudentItemOut])
def list_all_enrolled_roster(
    date_: date = Query(alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_all_enrolled_attendance_roster(db, date_)


@router.post("/all-enrolled", response_model=AllEnrolledAttendanceSaveResult)
def bulk_all_enrolled_attendance(
    payload: AllEnrolledAttendanceSaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    return save_global_attendance(db, payload, current_user.id)


@router.put("/{attendance_id}", response_model=AttendanceOut)
def update_attendance_record(
    attendance_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.TEACHER)),
):
    row = db.get(Attendance, attendance_id)
    if row is None:
        raise NotFoundError("Attendance record not found.")
    row.status = payload.status
    row.updated_by = current_user.id
    record_audit(
        db, current_user.id, "ATTENDANCE_CORRECTED", "attendance", row.id,
        f"Changed status to {payload.status.value}",
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/summary", response_model=AttendanceSummary)
def attendance_summary(
    student_id: int,
    date_from: date,
    date_to: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = calculate_attendance_summary(db, student_id, date_from, date_to)
    return AttendanceSummary(**result)
