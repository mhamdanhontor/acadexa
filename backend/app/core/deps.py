"""
Common FastAPI dependencies: DB session, current user extraction, RBAC guards.
"""
from typing import Callable, List

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationError, AuthorizationError
from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthenticationError("Missing or invalid authorization header.")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise AuthenticationError("Invalid or expired token.") from exc

    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type.")

    user_id = payload.get("sub")
    if user_id is None:
        raise AuthenticationError("Invalid token payload.")

    user = db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive.")

    return user


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    """Dependency factory: restricts an endpoint to a set of role names."""

    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name not in allowed_roles:
            raise AuthorizationError("You do not have permission to perform this action.")
        return current_user

    return checker


def require_permissions(*required_codes: str) -> Callable[[User], User]:
    """Dependency factory: restricts an endpoint to users whose role holds ALL given permission codes.
    SUPER_ADMIN always passes.
    """

    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name == "SUPER_ADMIN":
            return current_user
        owned: List[str] = [p.code for p in current_user.role.permissions]
        missing = [c for c in required_codes if c not in owned]
        if missing:
            raise AuthorizationError("You do not have permission to perform this action.")
        return current_user

    return checker
