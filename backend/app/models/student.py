"""Student model."""
from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin


class Student(Base, TimestampMixin):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    name_ur: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    guardian_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    guardian_name_ur: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    whatsapp_number: Mapped[str] = mapped_column(String(30), nullable=False, index=True)

    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)

    admission_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    profile_image_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    class_room = relationship("ClassRoom")
    batch = relationship("Batch")
