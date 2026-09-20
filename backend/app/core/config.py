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
        "السلام علیکم / Assalam-o-Alaikum\n\n"
        "Dear {guardian_name},\n"
        "This is to respectfully inform you that your child {student_name} was marked ABSENT from the academy on {date}.\n\n"
        "محترم {guardian_name}،\n"
        "اطلاع دی جاتی ہے کہ آپ کا بچہ {student_name} مورخہ {date} کو اکیڈمی سے غیر حاضر تھا۔\n\n"
        "— {academy_name}"
    )
    WHATSAPP_TEMPLATE_LATE: str = (
        "السلام علیکم / Assalam-o-Alaikum\n\n"
        "Dear {guardian_name},\n"
        "This is to inform you that {student_name} arrived LATE at the academy on {date}.\n\n"
        "محترم {guardian_name}،\n"
        "اطلاع دی جاتی ہے کہ {student_name} مورخہ {date} کو اکیڈمی میں تاخیر سے پہنچے۔\n\n"
        "— {academy_name}"
    )
    WHATSAPP_TEMPLATE_LEAVE: str = (
        "السلام علیکم / Assalam-o-Alaikum\n\n"
        "Dear {guardian_name},\n"
        "This is to inform you that {student_name} was marked on LEAVE on {date}.\n\n"
        "محترم {guardian_name}،\n"
        "اطلاع دی جاتی ہے کہ {student_name} کو مورخہ {date} کو رخصت (Leave) پر درج کیا گیا ہے۔\n\n"
        "— {academy_name}"
    )
    WHATSAPP_TEMPLATE_FEE_RECEIVED: str = (
        "السلام علیکم / Assalam-o-Alaikum\n\n"
        "Dear {guardian_name},\n"
        "Fee payment confirmation: PKR {amount} received for {student_name} for the month of {month} on {payment_date}. Receipt #{receipt_no}. Thank you!\n\n"
        "محترم {guardian_name}،\n"
        "فیس وصولی کی تصدیق: {student_name} کی ماہ {month} کی فیس مبلغ PKR {amount} مورخہ {payment_date} کو وصول ہو چکی ہے۔ رسید نمبر #{receipt_no}۔ بروقت ادائیگی کا شکریہ!\n\n"
        "— {academy_name}"
    )
    WHATSAPP_TEMPLATE_MONTHLY_ATTENDANCE: str = (
        "السلام علیکم / Assalam-o-Alaikum\n\n"
        "Dear {guardian_name},\n"
        "Monthly attendance summary for {student_name} ({month}):\n"
        "Present: {present} | Absent: {absent} | Late: {late} | Leave: {leave} | Attendance: {percentage}%\n\n"
        "محترم {guardian_name}،\n"
        "{student_name} کی ماہانہ حاضری کی تفصیل ({month}):\n"
        "حاضر: {present} | غیر حاضر: {absent} | تاخیر: {late} | رخصت: {leave} | حاضری فیصد: {percentage}%\n\n"
        "— {academy_name}"
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
