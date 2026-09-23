"""Student management API."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles
from app.core.errors import ConflictError, NotFoundError
from app.db.session import get_db
from app.models.academic_structure import Batch, ClassRoom
from app.models.enums import RoleName
from app.models.student import Student
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.student import StudentCreate, StudentOut, StudentStatusUpdate, StudentUpdate
from app.services.audit_service import record_audit
from app.utils.pagination import paginate

router = APIRouter(prefix="/students", tags=["Students"])


@router.get("", response_model=PaginatedResponse[StudentOut])
def list_students(
    search: Optional[str] = Query(default=None, description="Search by name, student code or WhatsApp number"),
    class_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    admission_date_from: Optional[date] = None,
    admission_date_to: Optional[date] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Student).options(joinedload(Student.class_room), joinedload(Student.batch))

    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(
            (Student.name.ilike(like))
            | (Student.student_code.ilike(like))
            | (Student.whatsapp_number.ilike(like))
        )
    if class_id is not None:
        stmt = stmt.where(Student.class_id == class_id)
    if batch_id is not None:
        stmt = stmt.where(Student.batch_id == batch_id)
    if is_active is not None:
        stmt = stmt.where(Student.is_active.is_(is_active))
    if admission_date_from is not None:
        stmt = stmt.where(Student.admission_date >= admission_date_from)
    if admission_date_to is not None:
        stmt = stmt.where(Student.admission_date <= admission_date_to)

    stmt = stmt.order_by(Student.student_code.asc(), Student.id.asc())

    items, total, total_pages = paginate(db, stmt, page, page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


def generate_unique_student_code(db: Session) -> str:
    """Generate the next unique student code (e.g. HKA-0001, HKA-0002)."""
    codes = {c[0] for c in db.query(Student.student_code).all() if c[0]}
    num = len(codes) + 1
    while True:
        candidate = f"HKA-{num:04d}"
        if candidate not in codes:
            return candidate
        num += 1


@router.post("", response_model=StudentOut, status_code=201)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    if not db.get(ClassRoom, payload.class_id):
        raise NotFoundError("Class not found.")
    if not db.get(Batch, payload.batch_id):
        raise NotFoundError("Batch not found.")

    student_data = payload.model_dump()
    code = (student_data.get("student_code") or "").strip()
    if not code:
        code = generate_unique_student_code(db)
        student_data["student_code"] = code
    else:
        existing = db.query(Student).filter(Student.student_code == code).first()
        if existing:
            raise ConflictError("A student with this Student ID already exists.", code="STUDENT_CODE_EXISTS")
        student_data["student_code"] = code

    student = Student(**student_data)
    db.add(student)
    db.flush()
    record_audit(db, current_user.id, "STUDENT_CREATED", "student", student.id, f"Created student {student.name} ({student.student_code})")
    db.commit()
    db.refresh(student)
    return student


@router.get("/{student_id}", response_model=StudentOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    student = (
        db.query(Student)
        .options(joinedload(Student.class_room), joinedload(Student.batch))
        .filter(Student.id == student_id)
        .first()
    )
    if student is None:
        raise NotFoundError("Student not found.")
    return student


@router.put("/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    payload: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found.")

    data = payload.model_dump(exclude_unset=True)

    if "class_id" in data and data["class_id"] is not None and not db.get(ClassRoom, data["class_id"]):
        raise NotFoundError("Class not found.")
    if "batch_id" in data and data["batch_id"] is not None and not db.get(Batch, data["batch_id"]):
        raise NotFoundError("Batch not found.")

    for key, value in data.items():
        setattr(student, key, value)

    record_audit(db, current_user.id, "STUDENT_UPDATED", "student", student.id, f"Updated student {student.name}")
    db.commit()
    db.refresh(student)
    return student


@router.patch("/{student_id}/status", response_model=StudentOut)
def update_student_status(
    student_id: int,
    payload: StudentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found.")
    student.is_active = payload.is_active
    action = "STUDENT_DEACTIVATED" if not payload.is_active else "STUDENT_REACTIVATED"
    record_audit(db, current_user.id, action, "student", student.id, f"is_active={payload.is_active}")
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}", status_code=204)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN)),
):
    """Hard delete is discouraged (see backend requirements #57 - Data Integrity).
    This endpoint performs a soft-delete (deactivation) instead of physical deletion
    to preserve historical attendance/marks records.
    """
    student = db.get(Student, student_id)
    if student is None:
        raise NotFoundError("Student not found.")
    student.is_active = False
    record_audit(db, current_user.id, "STUDENT_DEACTIVATED", "student", student.id, "Soft-deleted via DELETE endpoint")
    db.commit()
    return None
