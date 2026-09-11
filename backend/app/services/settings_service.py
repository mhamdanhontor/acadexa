"""Academy settings read/write helpers (simple key-value store)."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models.settings import AcademySetting

DEFAULTS = {
    "academy_name": "Acadexa Academy",
    "academy_address": "",
    "academy_contact": "",
    "academy_logo_url": "",
    "attendance_late_counts_as_present": "false",
}


def get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(AcademySetting).filter(AcademySetting.key == key).first()
    if row is not None:
        return row.value
    return DEFAULTS.get(key)


def get_all_settings(db: Session) -> dict[str, str]:
    rows = db.query(AcademySetting).all()
    result = dict(DEFAULTS)
    for row in rows:
        result[row.key] = row.value or ""
    return result


def set_setting(db: Session, key: str, value: str) -> AcademySetting:
    row = db.query(AcademySetting).filter(AcademySetting.key == key).first()
    if row is None:
        row = AcademySetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.flush()
    return row
