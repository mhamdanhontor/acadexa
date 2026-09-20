from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _create_token(subject: str, expires_minutes: int, token_type: str, extra_claims: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    claims = {"sub": subject, "type": token_type, "iat": now, "exp": now + timedelta(minutes=expires_minutes)}
    if extra_claims:
        claims.update(extra_claims)
    return jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    return _create_token(subject, settings.ACCESS_TOKEN_EXPIRE_MINUTES, "access", extra_claims)


def create_refresh_token(subject: str) -> str:
    return _create_token(subject, settings.REFRESH_TOKEN_EXPIRE_MINUTES, "refresh")


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
