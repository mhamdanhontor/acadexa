"""Excel export endpoints (requirement #34)."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.academics import Marks
from app.models.attendance import Attendance
from app.models.student import Student
from app.models.user import User
from app.services.excel_service import (
    export_attendance_to_excel,
    export_marks_to_excel,
    export_students_to_excel,
)

router = APIRouter(prefix="/exports", tags=["Exports"])

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/students")
def export_students(
    class_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Student).options(joinedload(Student.class_room), joinedload(Student.batch))
    if class_id is not None:
        q = q.filter(Student.class_id == class_id)
    if batch_id is not None:
        q = q.filter(Student.batch_id == batch_id)
    if is_active is not None:
        q = q.filter(Student.is_active.is_(is_active))
    students = q.order_by(Student.name).all()

    buf = export_students_to_excel(students)
    return StreamingResponse(
        buf,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=students_export.xlsx"},
    )


@router.get("/attendance")
def export_attendance(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    class_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Attendance)
    if date_from is not None:
        q = q.filter(Attendance.date >= date_from)
    if date_to is not None:
        q = q.filter(Attendance.date <= date_to)
    if class_id is not None:
        q = q.filter(Attendance.class_id == class_id)
    if batch_id is not None:
        q = q.filter(Attendance.batch_id == batch_id)
    rows = q.order_by(Attendance.date.desc()).limit(5000).all()

    buf = export_attendance_to_excel(rows)
    return StreamingResponse(
        buf,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=attendance_export.xlsx"},
    )


@router.get("/marks")
def export_marks(
    test_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Marks)
    if test_id is not None:
        q = q.filter(Marks.test_id == test_id)
    rows = q.order_by(Marks.created_at.desc()).limit(5000).all()

    buf = export_marks_to_excel(rows)
    return StreamingResponse(
        buf,
        media_type=XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": "attachment; filename=marks_export.xlsx"},
    )
