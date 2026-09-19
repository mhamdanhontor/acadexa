"""Audit log & backup schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.enums import BackupStatus


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    entity: str
    entity_id: Optional[int]
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class BackupOut(BaseModel):
    id: int
    file_name: str
    file_size_bytes: Optional[int]
    status: BackupStatus
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class BackupRestoreRequest(BaseModel):
    backup_id: int
    confirm: bool
