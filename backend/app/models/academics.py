"""TestSession, Test, Marks models."""
from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.mixins import TimestampMixin


class TestSession(Base, TimestampMixin):
    """A test session spans a configurable number of periods/months (e.g. a 4-month cycle)."""

    __tablename__ = "test_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_count: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Test(Base, TimestampMixin):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("test_sessions.id"), nullable=False)
    period_label: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g. "Month 1"
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id"), nullable=False)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    test_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_marks: Mapped[float] = mapped_column(Float, nullable=False)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    session = relationship("TestSession")
    subject = relationship("Subject")


class Marks(Base, TimestampMixin):
    __tablename__ = "marks"
    __table_args__ = (
        UniqueConstraint("student_id", "test_id", name="uq_marks_student_test"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id"), nullable=False, index=True)
    obtained_marks: Mapped[float] = mapped_column(Float, nullable=False)
    total_marks: Mapped[float] = mapped_column(Float, nullable=False)
    percentage: Mapped[float] = mapped_column(Float, nullable=False)
    grade: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    entered_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    student = relationship("Student")
    test = relationship("Test")
