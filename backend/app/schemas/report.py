"""Monthly report schemas."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.enums import ReportStatus, ReportType


class GenerateMonthlyReportRequest(BaseModel):
    report_type: ReportType = ReportType.MONTHLY_ATTENDANCE
    period_start: date
    period_end: date
    class_id: Optional[int] = None
    batch_id: Optional[int] = None
    student_id: Optional[int] = None


class MonthlyReportOut(BaseModel):
    id: int
    report_type: ReportType
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    student_code: Optional[str] = None
    class_id: Optional[int] = None
    class_name: Optional[str] = None
    batch_id: Optional[int] = None
    batch_name: Optional[str] = None
    guardian_name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    period_start: date
    period_end: date
    status: ReportStatus
    file_path: Optional[str] = None
    data_json: Optional[str] = None
    approved_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReportApprovalAction(BaseModel):
    approve: bool


class BulkApproveAndSendRequest(BaseModel):
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    class_id: Optional[int] = None
    batch_id: Optional[int] = None


class MonthEndReminderOut(BaseModel):
    is_reminder_active: bool
    current_day: int
    days_in_month: int
    days_remaining: int
    month_name: str
    period_start: date
    period_end: date
    message: str
    pending_reports_count: int = 0
    ready_reports_count: int = 0
    approved_reports_count: int = 0

