"""Monthly report model."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import ReportStatus, ReportType
from app.models.mixins import TimestampMixin


class MonthlyReport(Base, TimestampMixin):
    __tablename__ = "monthly_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_type: Mapped[ReportType] = mapped_column(Enum(ReportType, name="report_type_enum"), nullable=False)
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("students.id"), nullable=True, index=True)
    class_id: Mapped[Optional[int]] = mapped_column(ForeignKey("classes.id"), nullable=True)
    batch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("batches.id"), nullable=True)

    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, name="report_status_enum"), default=ReportStatus.DRAFT, index=True
    )

    data_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # calculated payload, JSON string
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # generated PDF path

    approved_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    student = relationship("Student")
