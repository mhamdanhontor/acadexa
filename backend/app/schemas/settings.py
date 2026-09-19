"""Academy settings schemas."""
from pydantic import BaseModel


class SettingsOut(BaseModel):
    academy_name: str
    academy_address: str
    academy_contact: str
    academy_logo_url: str
    attendance_late_counts_as_present: str


class SettingsUpdate(BaseModel):
    academy_name: str | None = None
    academy_address: str | None = None
    academy_contact: str | None = None
    academy_logo_url: str | None = None
    attendance_late_counts_as_present: str | None = None
