from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_NAME: str = "Acadexa"
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"
    ENABLE_DOCS: bool = True

    DATABASE_URL: str

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    WHATSAPP_PROVIDER: str = "fake"
    WHATSAPP_API_URL: str = ""
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""

    BACKUP_DIR: str = "./storage/backups"
    REPORTS_DIR: str = "./storage/reports"
    PG_DUMP_PATH: str = "pg_dump"
    PG_RESTORE_PATH: str = "pg_restore"
    NOTIFICATION_WORKER_INTERVAL_SECONDS: int = 10
    WHATSAPP_DISPATCH_DELAY_SECONDS: int = 10

    WHATSAPP_TEMPLATE_ABSENT: str = (
        "Dear {guardian_name}, this is to inform you that {student_name} was ABSENT on {date}. - {academy_name}"
    )
    WHATSAPP_TEMPLATE_LATE: str = (
        "Dear {guardian_name}, this is to inform you that {student_name} arrived LATE on {date}. - {academy_name}"
    )
    WHATSAPP_TEMPLATE_LEAVE: str = (
        "Dear {guardian_name}, this is to inform you that {student_name} was marked on LEAVE on {date}. - {academy_name}"
    )
    WHATSAPP_TEMPLATE_FEE_RECEIVED: str = (
        "Dear {guardian_name}, fee payment of PKR {amount} for {student_name} for the month of {month} has been received on {payment_date}. Receipt #{receipt_no}. Thank you! - {academy_name}"
    )
    WHATSAPP_TEMPLATE_MONTHLY_ATTENDANCE: str = (
        "Dear {guardian_name}, monthly attendance summary for {student_name} ({month}): Present: {present}, Absent: {absent}, Late: {late}, Leave: {leave}, Attendance: {percentage}%. - {academy_name}"
    )

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
