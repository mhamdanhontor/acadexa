"""Academy settings API."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services.audit_service import record_audit
from app.services.settings_service import get_all_settings, set_setting

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=SettingsOut)
def get_settings_endpoint(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return SettingsOut(**get_all_settings(db))


@router.put("", response_model=SettingsOut)
def update_settings_endpoint(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    data = payload.model_dump(exclude_unset=True, exclude_none=True)
    for key, value in data.items():
        set_setting(db, key, value)
    record_audit(db, current_user.id, "SETTINGS_UPDATED", "academy_settings", None, str(list(data.keys())))
    db.commit()
    return SettingsOut(**get_all_settings(db))
