"""Monthly report API: generate, list, approve/reject, send, download PDF, month-end reminder."""
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, require_roles
from app.core.errors import AppError, NotFoundError

logger = logging.getLogger("acadexa.reports")
from app.db.session import get_db
from app.models.academic_structure import Batch, ClassRoom
from app.models.enums import ReportStatus, ReportType, RoleName
from app.models.report import MonthlyReport
from app.models.student import Student
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.report import (
    BulkApproveAndSendRequest,
    GenerateMonthlyReportRequest,
    MonthEndReminderOut,
    MonthlyReportOut,
    ReportApprovalAction,
)
from app.services.report_service import (
    approve_and_send_all_reports,
    approve_and_send_report,
    approve_report,
    ensure_report_pdf,
    generate_monthly_attendance_reports,
    get_month_end_reminder,
    send_report,
)
from app.utils.pagination import paginate

router = APIRouter(prefix="/reports", tags=["Reports"])


def _to_report_out(r: MonthlyReport, db: Session) -> MonthlyReportOut:
    out = MonthlyReportOut.model_validate(r)
    if r.student:
        out.student_name = r.student.name
        out.student_code = r.student.student_code
        out.guardian_name = r.student.guardian_name or "Parent/Guardian"
        out.whatsapp_number = r.student.whatsapp_number
        if r.student.class_room:
            out.class_name = r.student.class_room.name
        if r.student.batch:
            out.batch_name = r.student.batch.name

    if not out.class_name and r.class_id:
        c = db.get(ClassRoom, r.class_id)
        if c:
            out.class_name = c.name

    if not out.batch_name and r.batch_id:
        b = db.get(Batch, r.batch_id)
        if b:
            out.batch_name = b.name

    return out


@router.get("/month-end-reminder", response_model=MonthEndReminderOut)
def month_end_reminder_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_month_end_reminder(db)


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
    stmt = (
        select(MonthlyReport)
        .options(
            joinedload(MonthlyReport.student).joinedload(Student.class_room),
            joinedload(MonthlyReport.student).joinedload(Student.batch),
        )
    )
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
    out_items = [_to_report_out(r, db) for r in items]
    return PaginatedResponse(items=out_items, total=total, page=page, page_size=page_size, total_pages=total_pages)


@router.post("/generate", response_model=list[MonthlyReportOut])
def generate_reports(
    payload: GenerateMonthlyReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    reports = generate_monthly_attendance_reports(
        db,
        payload.period_start,
        payload.period_end,
        payload.class_id,
        payload.batch_id,
        payload.student_id,
        current_user.id,
    )
    return [_to_report_out(r, db) for r in reports]


@router.post("/{report_id}/approve", response_model=MonthlyReportOut)
def approve_or_reject_report(
    report_id: int,
    payload: ReportApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    rep = approve_report(db, report_id, payload.approve, current_user.id)
    return _to_report_out(rep, db)


@router.post("/{report_id}/send", response_model=MonthlyReportOut)
def send_report_endpoint(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    rep = send_report(db, report_id, current_user.id)
    return _to_report_out(rep, db)


@router.post("/{report_id}/approve-and-send", response_model=MonthlyReportOut)
def approve_and_send_endpoint(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    rep = approve_and_send_report(db, report_id, current_user.id)
    return _to_report_out(rep, db)


@router.post("/approve-and-send-all", response_model=list[MonthlyReportOut])
def approve_and_send_all_endpoint(
    payload: BulkApproveAndSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(RoleName.SUPER_ADMIN, RoleName.ADMIN)),
):
    reports = approve_and_send_all_reports(
        db,
        current_user.id,
        payload.period_start,
        payload.period_end,
        payload.class_id,
        payload.batch_id,
    )
    return [_to_report_out(r, db) for r in reports]


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    report = db.get(MonthlyReport, report_id)
    if report is None:
        raise NotFoundError("Report not found.")

    try:
        file_path = ensure_report_pdf(db, report)
    except AppError:
        raise
    except Exception as exc:
        logger.exception("Failed to generate or retrieve PDF for report ID %s: %s", report_id, exc)
        raise AppError(f"Report PDF generation error: {exc}", status_code=500)

    if not file_path or not os.path.exists(file_path):
        raise NotFoundError("Report PDF file could not be generated.")

    student_code = report.student.student_code if report.student else report.student_id
    filename = f"monthly_report_{student_code or report_id}.pdf"
    return FileResponse(file_path, filename=filename, media_type="application/pdf")
