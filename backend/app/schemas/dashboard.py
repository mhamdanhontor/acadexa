"""Dashboard summary schema."""
from datetime import datetime
from typing import List

from pydantic import BaseModel


class RecentActivityItem(BaseModel):
    id: int
    action: str
    entity: str
    description: str | None
    created_at: datetime


class DashboardSummary(BaseModel):
    total_students: int
    present_today: int
    absent_today: int
    late_today: int
    leave_today: int
    attendance_percentage_today: float

    notifications_sent: int
    notifications_pending: int
    notifications_failed: int

    tests_this_month: int
    marks_entered_this_month: int
    pending_reports: int

    recent_activity: List[RecentActivityItem]
