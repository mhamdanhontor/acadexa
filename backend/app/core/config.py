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
        "*ABSENCE NOTICE*\n*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "This is to respectfully inform you that your child *{student_name}* was marked *ABSENT* from the academy on *{date}*.\n\n"
        "If this absence was unplanned or if you have any questions, please contact the academy administration.\n\n"
        "Best regards,\n"
        "*{academy_name}*\n\n"
        "-----------------------------------\n\n"
        "*غیر حاضری کی اطلاع*\n*السلام علیکم*\n\n"
        "محترم والدین / سرپرست (*{guardian_name_ur}*)،\n\n"
        "آپ کو مؤدبانہ مطلع کیا جاتا ہے کہ آپ کا بچہ / بچی *{student_name_ur}* مورخہ *{date}* کو اکیڈمی سے *غیر حاضر* تھا۔/تھی۔\n\n"
        "کسی بھی معلومات یا وضاحت کے لیے برائے مہربانی اکیڈمی انتظامیہ سے رابطہ فرمائیں۔\n\n"
        "والسلام،\n"
        "*{academy_name}*"
    )
    WHATSAPP_TEMPLATE_LATE: str = (
        "*LATE ARRIVAL NOTICE*\n*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "This is to inform you that your child *{student_name}* arrived *LATE* at the academy on *{date}*.\n\n"
        "Punctuality is essential for academic discipline. Kindly ensure timely arrival in future classes.\n\n"
        "Best regards,\n"
        "*{academy_name}*\n\n"
        "-----------------------------------\n\n"
        "*تاخیر سے آمد کی اطلاع*\n*السلام علیکم*\n\n"
        "محترم والدین / سرپرست (*{guardian_name_ur}*)،\n\n"
        "آپ کو مطلع کیا جاتا ہے کہ آپ کا بچہ *{student_name_ur}* مورخہ *{date}* کو اکیڈمی میں *تاخیر (Late)* سے پہنچا ہے۔\n\n"
        "بہتر تعلیمی نظم و ضبط کے لیے وقت کی پابندی بے حد ضروری ہے۔ براہِ کرم آئندہ بروقت آمد کو یقینی بنائیں۔\n\n"
        "والسلام،\n"
        "*{academy_name}*"
    )
    WHATSAPP_TEMPLATE_LEAVE: str = (
        "*LEAVE ACKNOWLEDGMENT*\n*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "This is to inform you that your child *{student_name}* has been marked on approved *LEAVE* on *{date}*.\n\n"
        "We look forward to their return to regular classes.\n\n"
        "Best regards,\n"
        "*{academy_name}*\n\n"
        "-----------------------------------\n\n"
        "*رخصت کی تصدیق*\n*السلام علیکم*\n\n"
        "محترم والدین / سرپرست (*{guardian_name_ur}*)،\n\n"
        "آپ کو مطلع کیا جاتا ہے کہ آپ کے بچے *{student_name_ur}* کی مورخہ *{date}* کی *رخصت (Leave)* اکیڈمی ریکارڈ میں درج کر لی گئی ہے۔\n\n"
        "والسلام،\n"
        "*{academy_name}*"
    )
    WHATSAPP_TEMPLATE_FEE_RECEIVED: str = (
        "*FEE PAYMENT RECEIPT*\n*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "Fee payment confirmation for *{student_name}*:\n\n"
        "💵 *Amount Paid:* PKR {amount}\n"
        "📅 *Month/Period:* {month}\n"
        "🧾 *Receipt #:* {receipt_no}\n"
        "🗓 *Payment Date:* {payment_date}\n\n"
        "Thank you for your timely payment and continued support.\n\n"
        "Best regards,\n"
        "*{academy_name}*\n\n"
        "-----------------------------------\n\n"
        "*فیس وصولی کی رسید*\n*السلام علیکم*\n\n"
        "محترم والدین / سرپرست (*{guardian_name_ur}*)،\n\n"
        "آپ کے بچے *{student_name_ur}* کی فیس کی ادائیگی کی تصدیق درج ذیل ہے:\n\n"
        "💵 *وصول شدہ رقم:* PKR {amount}\n"
        "📅 *ماہ:* {month}\n"
        "🧾 *رسید نمبر:* #{receipt_no}\n"
        "🗓 *تاریخِ ادائیگی:* {payment_date}\n\n"
        "بروقت ادائیگی اور تعاون کا شکریہ!\n\n"
        "والسلام،\n"
        "*{academy_name}*"
    )
    WHATSAPP_TEMPLATE_MONTHLY_ATTENDANCE: str = (
        "*MONTHLY ATTENDANCE REPORT*\n*Assalam-o-Alaikum*\n\n"
        "Dear Parent/Guardian (*{guardian_name}*),\n\n"
        "Monthly attendance summary for *{student_name}* ({month}):\n\n"
        "✅ *Present:* {present} days\n"
        "❌ *Absent:* {absent} days\n"
        "⏰ *Late:* {late} days\n"
        "📝 *Leave:* {leave} days\n"
        "📊 *Attendance:* {percentage}%\n\n"
        "Thank you for ensuring consistent attendance and academic continuity.\n\n"
        "Best regards,\n"
        "*{academy_name}*\n\n"
        "-----------------------------------\n\n"
        "*ماہانہ حاضری رپورٹ*\n*السلام علیکم*\n\n"
        "محترم والدین / سرپرست (*{guardian_name_ur}*)،\n\n"
        "{student_name_ur} کی ماہانہ حاضری کی تفصیل ({month}):\n\n"
        "✅ *حاضر:* {present} دن\n"
        "❌ *غیر حاضر:* {absent} دن\n"
        "⏰ *تاخیر:* {late} دن\n"
        "📝 *رخصت:* {leave} دن\n"
        "📊 *حاضری فیصد:* {percentage}%\n\n"
        "بچے کی باقاعدہ حاضری اور تعاون کا بہت شکریہ۔\n\n"
        "والسلام،\n"
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
