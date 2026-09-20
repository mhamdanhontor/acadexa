"""Shared Python enums mapped to Postgres enum types / plain strings."""
import enum


class RoleName(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    TEACHER = "TEACHER"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    LEAVE = "LEAVE"


class NotificationType(str, enum.Enum):
    ABSENCE = "ABSENCE"
    MARKS = "MARKS"
    MONTHLY_REPORT = "MONTHLY_REPORT"
    FEE_RECEIPT = "FEE_RECEIPT"


class NotificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SENT = "SENT"
    FAILED = "FAILED"
    RETRYING = "RETRYING"


class ReportStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    READY = "READY"
    APPROVED = "APPROVED"
    SENT = "SENT"
    FAILED = "FAILED"


class ReportType(str, enum.Enum):
    MONTHLY_ATTENDANCE = "MONTHLY_ATTENDANCE"
    STUDENT_ATTENDANCE = "STUDENT_ATTENDANCE"
    STUDENT_PERFORMANCE = "STUDENT_PERFORMANCE"
    TEST_RESULT = "TEST_RESULT"
    CLASS_PERFORMANCE = "CLASS_PERFORMANCE"


class BackupStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
