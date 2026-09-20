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
        "*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "This is to respectfully inform you that your child *{student_name}* was marked *ABSENT* from the academy on *{date}*.\n\n"
        "If this was unexpected or you have any queries, please contact the academy administration.\n\n"
        "Regards,\n"
        "*{academy_name}*"
    )
    WHATSAPP_TEMPLATE_LATE: str = (
        "*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "This is to inform you that your child *{student_name}* arrived *LATE* at the academy on *{date}*.\n\n"
        "Regards,\n"
        "*{academy_name}*"
    )
    WHATSAPP_TEMPLATE_LEAVE: str = (
        "*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "This is to inform you that your child *{student_name}* was marked on *LEAVE* on *{date}*.\n\n"
        "Regards,\n"
        "*{academy_name}*"
    )
    WHATSAPP_TEMPLATE_FEE_RECEIVED: str = (
        "*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "Fee payment confirmation for *{student_name}*:\n\n"
        "💵 *Amount Paid:* PKR {amount_paid}\n"
        "📅 *Month/Period:* {month}\n"
        "🧾 *Receipt #:* {receipt_no}\n"
        "💳 *Remaining Balance:* PKR {remaining_balance}\n\n"
        "Thank you for your timely payment!\n\n"
        "Regards,\n"
        "*{academy_name}*"
    )
    WHATSAPP_TEMPLATE_MONTHLY_ATTENDANCE: str = (
        "*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "Monthly attendance summary for *{student_name}* ({month}):\n"
        "Present: {present} | Absent: {absent} | Late: {late} | Leave: {leave} | Attendance: {percentage}%\n\n"
        "Regards,\n"
        "*{academy_name}*"
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
