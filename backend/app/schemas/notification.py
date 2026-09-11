"""Notification template / job schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import NotificationStatus, NotificationType


class NotificationTemplateOut(BaseModel):
    id: int
    type: NotificationType
    name: str
    body: str
    is_active: bool

    class Config:
        from_attributes = True


class NotificationTemplateUpdate(BaseModel):
    body: str = Field(min_length=1)
    is_active: Optional[bool] = None


class NotificationJobOut(BaseModel):
    id: int
    student_id: int
    type: NotificationType
    recipient: str
    message: str
    status: NotificationStatus
    failure_reason: Optional[str]
    retry_count: int
    sent_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
