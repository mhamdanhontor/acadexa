"""User management API — Super Admin / Admin only."""
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles
from app.core.errors import ConflictError, NotFoundError
from app.core.security import hash_password
from app.db.session import get_db
from app.models.enums import RoleName
from app.models.user import Role, User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.user import RoleOut, UserCreate, UserOut, UserStatusUpdate, UserUpdate
from app.services.audit_service import record_audit

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=PaginatedResponse[UserOut])
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    from app.utils.pagination import paginate

    stmt = select(User).options(joinedload(User.role)).order_by(User.id)
    items, total, total_pages = paginate(db, stmt, page, page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.get("/roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Role).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN)),
):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise ConflictError("A user with this email already exists.", code="USER_EMAIL_EXISTS")

    role = db.get(Role, payload.role_id)
    if role is None:
        raise NotFoundError("Role not found.")

    user = User(
        full_name=payload.full_name,
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        role_id=payload.role_id,
    )
    db.add(user)
    db.flush()
    record_audit(db, current_user.id, "USER_CREATED", "user", user.id, f"Created user {user.email}")
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN)),
):
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.")

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role_id is not None:
        role = db.get(Role, payload.role_id)
        if role is None:
            raise NotFoundError("Role not found.")
        user.role_id = payload.role_id
    if payload.password:
        user.hashed_password = hash_password(payload.password)

    record_audit(db, current_user.id, "USER_UPDATED", "user", user.id, f"Updated user {user.email}")
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}/status", response_model=UserOut)
def update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN)),
):
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found.")
    if user.id == current_user.id and not payload.is_active:
        raise ConflictError("You cannot deactivate your own account.", code="CANNOT_DEACTIVATE_SELF")

    user.is_active = payload.is_active
    record_audit(
        db, current_user.id, "USER_STATUS_CHANGED", "user", user.id,
        f"Set active={payload.is_active} for {user.email}",
    )
    db.commit()
    db.refresh(user)
    return user
