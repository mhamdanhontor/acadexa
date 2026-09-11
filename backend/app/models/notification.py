"""Notification template, job, and log models."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.enums import NotificationStatus, NotificationType
from app.models.mixins import TimestampMixin


class NotificationTemplate(Base, TimestampMixin):
    __tablename__ = "notification_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType, name="notification_type_enum"), unique=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)


class NotificationJob(Base, TimestampMixin):
    __tablename__ = "notification_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False, index=True)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType, name="notification_job_type_enum"))
    recipient: Mapped[str] = mapped_column(String(30), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[NotificationStatus] = mapped_column(
        Enum(NotificationStatus, name="notification_status_enum"), default=NotificationStatus.PENDING, index=True
    )
    context_ref_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 'attendance' | 'marks' | 'report'
    context_ref_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    student = relationship("Student")
