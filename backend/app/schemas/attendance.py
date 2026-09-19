"""Attendance schemas."""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.enums import AttendanceStatus


class AttendanceRecordIn(BaseModel):
    student_id: int
    status: AttendanceStatus


class BulkAttendanceRequest(BaseModel):
    date: date
    class_id: int
    batch_id: int
    records: List[AttendanceRecordIn]


class AttendanceOut(BaseModel):
    id: int
    student_id: int
    date: date
    status: AttendanceStatus
    class_id: int
    batch_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AbsentNotificationOut(BaseModel):
    notification_id: Optional[int] = None
    student_id: int
    student_name: str
    student_code: str
    guardian_name: str
    whatsapp_number: str
    message: str
    whatsapp_web_url: str
    whatsapp_app_url: str
    status: str = "PENDING"


class BulkAttendanceResult(BaseModel):
    date: date
    class_id: int
    batch_id: int
    present: int
    absent: int
    late: int
    leave: int
    notifications_queued: int
    absent_notifications: List[AbsentNotificationOut] = []


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus


class AttendanceSummary(BaseModel):
    total_classes: int
    present: int
    absent: int
    late: int
    leave: int
    percentage: float
