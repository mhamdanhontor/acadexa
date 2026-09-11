"""Authentication business logic."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.core.errors import AuthenticationError
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.models.user import User
from app.services.audit_service import record_audit


def authenticate_user(db: Session, email: str, password: str, ip_address: str | None = None) -> tuple[str, str, User]:
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.email == email.lower())
        .first()
    )
    if user is None or not verify_password(password, user.hashed_password):
        raise AuthenticationError("Invalid email or password.")

    if not user.is_active:
        raise AuthenticationError("This account has been deactivated.")

    access_token = create_access_token(str(user.id), extra_claims={"role": user.role.name})
    refresh_token = create_refresh_token(str(user.id))

    user.last_login_at = datetime.now(timezone.utc).isoformat()
    record_audit(db, user.id, "LOGIN", "user", user.id, f"User {user.email} logged in.", ip_address=ip_address)
    db.commit()

    return access_token, refresh_token, user


def refresh_access_token(db: Session, refresh_token: str) -> str:
    try:
        payload = decode_token(refresh_token)
    except ValueError as exc:
        raise AuthenticationError("Invalid or expired refresh token.") from exc

    if payload.get("type") != "refresh":
        raise AuthenticationError("Invalid token type.")

    user_id = int(payload["sub"])
    user = db.query(User).options(joinedload(User.role)).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive.")

    return create_access_token(str(user.id), extra_claims={"role": user.role.name})
