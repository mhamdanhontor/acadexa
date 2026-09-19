"""Monthly report API: generate, list, approve/reject, send, download PDF."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import NotFoundError
from app.db.session import get_db
from app.models.enums import ReportStatus, ReportType, RoleName
from app.models.report import MonthlyReport
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.report import GenerateMonthlyReportRequest, MonthlyReportOut, ReportApprovalAction
from app.services.report_service import approve_report, generate_monthly_attendance_reports, send_report
from app.utils.pagination import paginate

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("", response_model=PaginatedResponse[MonthlyReportOut])
def list_reports(
    student_id: Optional[int] = None,
    class_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    status: Optional[ReportStatus] = None,
    report_type: Optional[ReportType] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(MonthlyReport)
    if student_id is not None:
        stmt = stmt.where(MonthlyReport.student_id == student_id)
    if class_id is not None:
        stmt = stmt.where(MonthlyReport.class_id == class_id)
    if batch_id is not None:
        stmt = stmt.where(MonthlyReport.batch_id == batch_id)
    if status is not None:
        stmt = stmt.where(MonthlyReport.status == status)
    if report_type is not None:
        stmt = stmt.where(MonthlyReport.report_type == report_type)
    stmt = stmt.order_by(MonthlyReport.created_at.desc())

    items, total, total_pages = paginate(db, stmt, page, page_size)
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.post("/generate", response_model=list[MonthlyReportOut])
def generate_reports(
    payload: GenerateMonthlyReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    return generate_monthly_attendance_reports(
        db,
        payload.period_start,
        payload.period_end,
        payload.class_id,
        payload.batch_id,
        payload.student_id,
        current_user.id,
    )


@router.post("/{report_id}/approve", response_model=MonthlyReportOut)
def approve_or_reject_report(
    report_id: int,
    payload: ReportApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    return approve_report(db, report_id, payload.approve, current_user.id)


@router.post("/{report_id}/send", response_model=MonthlyReportOut)
def send_report_endpoint(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    return send_report(db, report_id, current_user.id)


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.get(MonthlyReport, report_id)
    if report is None or not report.file_path:
        raise NotFoundError("Report file not found.")
    return FileResponse(report.file_path, filename=f"report_{report_id}.pdf", media_type="application/pdf")
