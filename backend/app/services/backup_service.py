"""Database backup / restore service.

Uses pg_dump/psql (configured via PG_DUMP_PATH / PG_RESTORE_PATH) to create
and restore custom-format PostgreSQL dumps. Restore is destructive and must
require SUPER_ADMIN + explicit confirmation (enforced at the API layer) and
is always audited.
"""
import logging
import os
import subprocess
from datetime import datetime
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, NotFoundError
from app.models.audit import Backup
from app.models.enums import BackupStatus

logger = logging.getLogger("acadexa.backup")


def _db_conn_params() -> dict:
    parsed = urlparse(settings.DATABASE_URL.replace("postgresql+psycopg2", "postgresql"))
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "",
        "password": parsed.password or "",
        "dbname": (parsed.path or "/").lstrip("/"),
    }


def create_backup(db: Session, triggered_by: int | None) -> Backup:
    os.makedirs(settings.BACKUP_DIR, exist_ok=True)
    conn = _db_conn_params()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"acadexa_backup_{timestamp}.dump"
    file_path = os.path.join(settings.BACKUP_DIR, file_name)

    backup = Backup(file_name=file_name, file_path=file_path, status=BackupStatus.PENDING, triggered_by=triggered_by)
    db.add(backup)
    db.commit()
    db.refresh(backup)

    env = os.environ.copy()
    env["PGPASSWORD"] = conn["password"]

    cmd = [
        settings.PG_DUMP_PATH,
        "-h", conn["host"],
        "-p", conn["port"],
        "-U", conn["user"],
        "-F", "c",  # custom format, required for pg_restore
        "-f", file_path,
        conn["dbname"],
    ]

    try:
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            backup.status = BackupStatus.FAILED
            backup.notes = (result.stderr or "pg_dump failed")[:2000]
            db.commit()
            raise AppError(f"Backup failed: {backup.notes}", code="BACKUP_FAILED", status_code=500)

        backup.file_size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else None
        backup.status = BackupStatus.COMPLETED
        db.commit()
        db.refresh(backup)
        return backup
    except subprocess.TimeoutExpired:
        backup.status = BackupStatus.FAILED
        backup.notes = "pg_dump timed out"
        db.commit()
        raise AppError("Backup timed out.", code="BACKUP_TIMEOUT", status_code=500)


def restore_backup(db: Session, backup_id: int) -> Backup:
    backup = db.get(Backup, backup_id)
    if backup is None:
        raise NotFoundError("Backup not found.")
    if backup.status != BackupStatus.COMPLETED or not os.path.exists(backup.file_path):
        raise AppError("Backup file is missing or invalid.", code="BACKUP_INVALID", status_code=400)

    conn = _db_conn_params()
    env = os.environ.copy()
    env["PGPASSWORD"] = conn["password"]

    cmd = [
        settings.PG_RESTORE_PATH.replace("psql", "pg_restore") if "psql" in settings.PG_RESTORE_PATH else settings.PG_RESTORE_PATH,
        "-h", conn["host"],
        "-p", conn["port"],
        "-U", conn["user"],
        "-d", conn["dbname"],
        "--clean",
        "--if-exists",
        "--no-owner",
        backup.file_path,
    ]

    result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        logger.error("pg_restore stderr: %s", result.stderr)
        raise AppError(
            "Restore failed. The database may be partially restored — verify integrity immediately.",
            code="RESTORE_FAILED",
            status_code=500,
        )
    return backup
