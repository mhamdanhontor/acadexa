"""Dashboard summary API — optimized aggregate queries (requirement #35).

Avoids pulling full historical datasets to the frontend; instead does
COUNT/aggregate queries scoped to "today" / "this month" and returns a
single compact payload.
"""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.academics import Marks, Test
from app.models.attendance import Attendance
from app.models.audit import AuditLog
from app.models.enums import AttendanceStatus, NotificationStatus, ReportStatus
from app.models.notification import NotificationJob
from app.models.report import MonthlyReport
from app.models.student import Student
from app.models.user import User
from app.schemas.dashboard import DashboardSummary, RecentActivityItem

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    today = date.today()
    month_start = today.replace(day=1)

    total_students = db.query(func.count(Student.id)).filter(Student.is_active.is_(True)).scalar() or 0

    status_counts = dict(
        db.query(Attendance.status, func.count(Attendance.id))
        .filter(Attendance.date == today)
        .group_by(Attendance.status)
        .all()
    )
    present_today = status_counts.get(AttendanceStatus.PRESENT, 0)
    absent_today = status_counts.get(AttendanceStatus.ABSENT, 0)
    late_today = status_counts.get(AttendanceStatus.LATE, 0)
    leave_today = status_counts.get(AttendanceStatus.LEAVE, 0)
    total_marked_today = present_today + absent_today + late_today + leave_today
    attendance_percentage_today = (
        round((present_today / total_marked_today) * 100, 2) if total_marked_today > 0 else 0.0
    )

    notif_counts = dict(
        db.query(NotificationJob.status, func.count(NotificationJob.id)).group_by(NotificationJob.status).all()
    )
    notifications_sent = notif_counts.get(NotificationStatus.SENT, 0)
    notifications_pending = notif_counts.get(NotificationStatus.PENDING, 0) + notif_counts.get(
        NotificationStatus.RETRYING, 0
    )
    notifications_failed = notif_counts.get(NotificationStatus.FAILED, 0)

    tests_this_month = db.query(func.count(Test.id)).filter(Test.test_date >= month_start).scalar() or 0
    marks_entered_this_month = (
        db.query(func.count(Marks.id)).filter(Marks.created_at >= month_start).scalar() or 0
    )
    pending_reports = (
        db.query(func.count(MonthlyReport.id))
        .filter(MonthlyReport.status.in_([ReportStatus.DRAFT, ReportStatus.READY]))
        .scalar()
        or 0
    )

    recent_logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()

    return DashboardSummary(
        total_students=total_students,
        present_today=present_today,
        absent_today=absent_today,
        late_today=late_today,
        leave_today=leave_today,
        attendance_percentage_today=attendance_percentage_today,
        notifications_sent=notifications_sent,
        notifications_pending=notifications_pending,
        notifications_failed=notifications_failed,
        tests_this_month=tests_this_month,
        marks_entered_this_month=marks_entered_this_month,
        pending_reports=pending_reports,
        recent_activity=[
            RecentActivityItem(
                id=log.id,
                action=log.action,
                entity=log.entity,
                description=log.description,
                created_at=log.created_at,
            )
            for log in recent_logs
        ],
    )
