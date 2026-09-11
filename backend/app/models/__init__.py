"""Import all models here so Alembic autogenerate and Base.metadata see them all."""
from app.models.user import User, Role, Permission  # noqa: F401
from app.models.academic_structure import ClassRoom, Batch, Subject  # noqa: F401
from app.models.student import Student  # noqa: F401
from app.models.attendance import Attendance  # noqa: F401
from app.models.academics import TestSession, Test, Marks  # noqa: F401
from app.models.notification import NotificationTemplate, NotificationJob  # noqa: F401
from app.models.report import MonthlyReport  # noqa: F401
from app.models.audit import AuditLog, Backup  # noqa: F401
from app.models.settings import AcademySetting  # noqa: F401
