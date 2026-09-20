from typing import Callable

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.errors import AuthenticationError
from app.db.session import get_db
from app.models.enums import RoleName
from app.models.user import Role, User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access" or not payload.get("sub"):
            raise JWTError("Invalid access token")
        user_id = int(payload["sub"])
    except (JWTError, ValueError, TypeError) as exc:
        raise AuthenticationError("Invalid or expired access token.") from exc

    user = (
        db.query(User)
        .options(joinedload(User.role).joinedload(Role.permissions))
        .filter(User.id == user_id)
        .first()
    )
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive.")
    return user


def require_roles(*allowed_roles: RoleName) -> Callable:
    allowed_names = {role.value for role in allowed_roles}

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.name not in allowed_names:
            from app.core.errors import AppError
            raise AppError(
                "You do not have permission to perform this action.",
                code="AUTHORIZATION_ERROR",
                status_code=403,
            )
        return current_user

    return dependency
