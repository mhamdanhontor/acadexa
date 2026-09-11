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
    student_id: Optional[int]
    class_id: Optional[int]
    batch_id: Optional[int]
    period_start: date
    period_end: date
    status: ReportStatus
    file_path: Optional[str]
    approved_at: Optional[datetime]
    sent_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class ReportApprovalAction(BaseModel):
    approve: bool
