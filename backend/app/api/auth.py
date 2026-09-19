"""Auth endpoints: login, refresh, current user info, logout (client-side token discard)."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.schemas.common import MessageResponse
from app.schemas.user import CurrentUser
from app.services.auth_service import authenticate_user, refresh_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else None
    access_token, refresh_token, _user = authenticate_user(db, payload.email, payload.password, client_ip)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    new_access_token = refresh_access_token(db, payload.refresh_token)
    return TokenResponse(access_token=new_access_token, refresh_token=payload.refresh_token)


@router.get("/me", response_model=CurrentUser)
def me(current_user: User = Depends(get_current_user)):
    return CurrentUser(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role_name=current_user.role.name,
        permissions=[p.code for p in current_user.role.permissions],
    )


@router.post("/logout", response_model=MessageResponse)
def logout(current_user: User = Depends(get_current_user)):
    # Stateless JWT: logout is handled client-side by discarding tokens.
    return MessageResponse(message="Logged out successfully.")
