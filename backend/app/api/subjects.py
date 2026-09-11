"""Subject management API."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import ConflictError, NotFoundError
from app.db.session import get_db
from app.models.academic_structure import Subject
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.academic_structure import StatusUpdate, SubjectCreate, SubjectOut
from app.services.audit_service import record_audit

router = APIRouter(prefix="/subjects", tags=["Subjects"])


@router.get("", response_model=list[SubjectOut])
def list_subjects(
    active_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Subject).order_by(Subject.name)
    if active_only:
        q = q.filter(Subject.is_active.is_(True))
    return q.all()


@router.post("", response_model=SubjectOut, status_code=201)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    existing = db.query(Subject).filter(Subject.name == payload.name).first()
    if existing:
        raise ConflictError("A subject with this name already exists.", code="SUBJECT_EXISTS")

    obj = Subject(**payload.model_dump())
    db.add(obj)
    db.flush()
    record_audit(db, current_user.id, "SUBJECT_CREATED", "subject", obj.id, f"Created subject {obj.name}")
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{subject_id}/status", response_model=SubjectOut)
def update_subject_status(
    subject_id: int,
    payload: StatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    obj = db.get(Subject, subject_id)
    if obj is None:
        raise NotFoundError("Subject not found.")
    obj.is_active = payload.is_active
    record_audit(db, current_user.id, "SUBJECT_STATUS_CHANGED", "subject", obj.id, f"is_active={payload.is_active}")
    db.commit()
    db.refresh(obj)
    return obj
