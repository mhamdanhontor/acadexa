"""User & role schemas."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    role_id: int


class UserCreate(UserBase):
    password: str = Field(min_length=6, max_length=100)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    role_id: Optional[int] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=100)


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: RoleOut
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserStatusUpdate(BaseModel):
    is_active: bool


class CurrentUser(BaseModel):
    id: int
    full_name: str
    email: str
    role_name: str
    permissions: List[str] = []
