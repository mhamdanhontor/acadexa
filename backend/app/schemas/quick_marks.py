"""Schemas for Quick Test Marks entry and dispatch."""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.academics import MarksDispatchItemOut


class QuickMarkRecord(BaseModel):
    student_id: int
    obtained_marks: float = Field(..., ge=0)
    total_marks: float = Field(..., gt=0)


class QuickMarksRequest(BaseModel):
    test_name: Optional[str] = "Class Quiz / Test"
    subject: Optional[str] = "General"
    date: Optional[date] = None
    records: list[QuickMarkRecord] = Field(..., min_length=1)


class QuickMarksResult(BaseModel):
    test_name: str
    subject: str
    students_processed: int
    notifications_queued: int
    dispatches: list[MarksDispatchItemOut] = []
