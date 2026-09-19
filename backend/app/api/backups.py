"""Backup management API — SUPER_ADMIN only for create/restore."""
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.errors import AppError, NotFoundError
from app.db.session import get_db
from app.models.audit import Backup
from app.models.enums import RoleName
from app.models.user import User
from app.schemas.audit import BackupOut, BackupRestoreRequest
from app.services.audit_service import record_audit
from app.services.backup_service import create_backup, restore_backup

router = APIRouter(prefix="/backups", tags=["Backups"])


@router.get("", response_model=list[BackupOut])
def list_backups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    return db.query(Backup).order_by(Backup.created_at.desc()).all()


@router.post("", response_model=BackupOut, status_code=201)
def trigger_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN)),
):
    backup = create_backup(db, current_user.id)
    record_audit(db, current_user.id, "BACKUP_CREATED", "backup", backup.id, backup.file_name)
    db.commit()
    return backup


@router.get("/{backup_id}/download")
def download_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    backup = db.get(Backup, backup_id)
    if backup is None:
        raise NotFoundError("Backup not found.")
    return FileResponse(backup.file_path, filename=backup.file_name, media_type="application/octet-stream")


@router.post("/restore", response_model=BackupOut)
def restore(
    payload: BackupRestoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN)),
):
    if not payload.confirm:
        raise AppError("Restore requires explicit confirmation.", code="RESTORE_NOT_CONFIRMED", status_code=400)

    backup = restore_backup(db, payload.backup_id)
    record_audit(
        db, current_user.id, "BACKUP_RESTORED", "backup", backup.id,
        f"Restored database from {backup.file_name}",
    )
    db.commit()
    return backup
