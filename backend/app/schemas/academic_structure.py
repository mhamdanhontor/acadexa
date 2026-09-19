"""Class, Batch, Subject schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ClassBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None


class ClassCreate(ClassBase):
    pass


class ClassUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None


class ClassOut(ClassBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BatchBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None


class BatchCreate(BatchBase):
    pass


class BatchUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None


class BatchOut(BatchBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SubjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class SubjectCreate(SubjectBase):
    pass


class SubjectOut(SubjectBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    is_active: bool
