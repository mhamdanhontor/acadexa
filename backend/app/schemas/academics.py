"""Test session / Test / Marks schemas."""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class TestSessionBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    start_date: date
    end_date: date
    period_count: int = Field(default=4, ge=1, le=24)
    class_id: Optional[int] = None


class TestSessionCreate(TestSessionBase):
    pass


class TestSessionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    period_count: Optional[int] = Field(default=None, ge=1, le=24)
    class_id: Optional[int] = None
    is_active: Optional[bool] = None


class TestSessionOut(TestSessionBase):
    id: int
    is_active: bool
    class_name: Optional[str] = None

    class Config:
        from_attributes = True


class TestBase(BaseModel):
    session_id: int
    period_label: str = Field(min_length=1, max_length=50)
    subject_id: int
    class_id: int
    batch_id: Optional[int] = None
    name: str = Field(min_length=1, max_length=150)
    test_date: date
    total_marks: float = Field(gt=0)


class TestCreate(TestBase):
    pass


class TestOut(TestBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MarksRecordIn(BaseModel):
    student_id: int
    obtained_marks: float = Field(ge=0)


class BulkMarksRequest(BaseModel):
    test_id: int
    records: List[MarksRecordIn]

    @model_validator(mode="after")
    def check_unique_students(self):
        ids = [r.student_id for r in self.records]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate student_id entries in marks payload")
        return self


class MarksOut(BaseModel):
    id: int
    student_id: int
    test_id: int
    obtained_marks: float
    total_marks: float
    percentage: float
    grade: Optional[str]
    created_at: datetime
    test: Optional[TestOut] = None

    class Config:
        from_attributes = True


class MarksDispatchItemOut(BaseModel):
    notification_id: Optional[int] = None
    student_id: int
    student_name: str
    student_code: Optional[str] = None
    guardian_name: str
    whatsapp_number: str
    obtained_marks: float
    total_marks: float
    percentage: float
    grade: Optional[str] = None
    message: str
    whatsapp_web_url: str
    whatsapp_app_url: str
    status: str = "PENDING"


class BulkMarksResult(BaseModel):
    test_id: int
    students_updated: int
    notifications_queued: int
    dispatches: list[MarksDispatchItemOut] = []
