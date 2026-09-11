"""Student schemas."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.academic_structure import BatchOut, ClassOut


class StudentBase(BaseModel):
    student_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    guardian_name: Optional[str] = Field(default=None, max_length=150)
    whatsapp_number: str = Field(min_length=6, max_length=30)
    class_id: int
    batch_id: int
    admission_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("whatsapp_number")
    @classmethod
    def normalize_whatsapp(cls, v: str) -> str:
        cleaned = "".join(ch for ch in v if ch.isdigit() or ch == "+")
        if not cleaned:
            raise ValueError("WhatsApp number is invalid")
        if not cleaned.startswith("+"):
            # Assume already includes country code without plus; require at minimum length
            cleaned = "+" + cleaned
        return cleaned


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    guardian_name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    class_id: Optional[int] = None
    batch_id: Optional[int] = None
    admission_date: Optional[date] = None
    notes: Optional[str] = None

    @field_validator("whatsapp_number")
    @classmethod
    def normalize_whatsapp(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = "".join(ch for ch in v if ch.isdigit() or ch == "+")
        if not cleaned.startswith("+"):
            cleaned = "+" + cleaned
        return cleaned


class StudentOut(BaseModel):
    id: int
    student_code: str
    name: str
    guardian_name: Optional[str]
    whatsapp_number: str
    class_id: int
    batch_id: int
    class_room: Optional[ClassOut] = None
    batch: Optional[BatchOut] = None
    admission_date: Optional[date]
    notes: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StudentStatusUpdate(BaseModel):
    is_active: bool
