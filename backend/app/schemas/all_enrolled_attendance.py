"""Schemas for All-Enrolled (Quick) Attendance marking and dispatch."""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel

from app.models.enums import AttendanceStatus


class AllEnrolledAttendanceRecordIn(BaseModel):
    student_id: int
    status: AttendanceStatus


class AllEnrolledAttendanceSaveRequest(BaseModel):
    date: date
    records: List[AllEnrolledAttendanceRecordIn]


class AllEnrolledStudentItemOut(BaseModel):
    student_id: int
    student_code: str
    student_name: str
    guardian_name: Optional[str] = None
    whatsapp_number: str
    class_id: int
    class_name: str
    batch_id: int
    batch_name: str
    current_status: AttendanceStatus = AttendanceStatus.PRESENT
    attendance_id: Optional[int] = None


class AllEnrolledDispatchItemOut(BaseModel):
    notification_id: Optional[int] = None
    student_id: int
    student_name: str
    student_code: str
    guardian_name: str
    whatsapp_number: str
    status_type: str  # 'ABSENT' | 'LEAVE'
    message: str
    whatsapp_web_url: str
    whatsapp_app_url: str
    status: str = "PENDING"


class AllEnrolledAttendanceSaveResult(BaseModel):
    date: date
    total: int
    present: int
    absent: int
    late: int
    leave: int
    notifications_queued: int
    dispatches: List[AllEnrolledDispatchItemOut] = []
