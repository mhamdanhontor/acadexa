"""Academy settings read/write helpers (simple key-value store)."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models.settings import AcademySetting

DEFAULTS = {
    "academy_name": "Honor Knowledge Academy",
    "academy_address": "",
    "academy_contact": "",
    "academy_logo_url": "",
    "attendance_late_counts_as_present": "true",
}


def get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(AcademySetting).filter(AcademySetting.key == key).first()
    if row is not None and row.value:
        if key == "academy_name" and row.value in ("Acadexa Academy", "Acadexa"):
            return "Honor Knowledge Academy"
        return row.value
    return DEFAULTS.get(key)


def get_all_settings(db: Session) -> dict[str, str]:
    rows = db.query(AcademySetting).all()
    result = dict(DEFAULTS)
    for row in rows:
        val = row.value or ""
        if row.key == "academy_name" and val in ("Acadexa Academy", "Acadexa"):
            val = "Honor Knowledge Academy"
        result[row.key] = val
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
