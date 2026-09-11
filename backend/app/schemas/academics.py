"""Test session / Test / Marks schemas."""
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class TestSessionBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    start_date: date
    end_date: date
    period_count: int = Field(default=4, ge=1, le=24)


class TestSessionCreate(TestSessionBase):
    pass


class TestSessionOut(TestSessionBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class TestBase(BaseModel):
    session_id: int
    period_label: str = Field(min_length=1, max_length=50)
    subject_id: int
    class_id: int
    batch_id: int
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

    class Config:
        from_attributes = True


class BulkMarksResult(BaseModel):
    test_id: int
    students_updated: int
    notifications_queued: int
