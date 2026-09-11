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


class BulkAttendanceResult(BaseModel):
    date: date
    class_id: int
    batch_id: int
    present: int
    absent: int
    late: int
    leave: int
    notifications_queued: int


class AttendanceUpdate(BaseModel):
    status: AttendanceStatus


class AttendanceSummary(BaseModel):
    total_classes: int
    present: int
    absent: int
    late: int
    leave: int
    percentage: float
