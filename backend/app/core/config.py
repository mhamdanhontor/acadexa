"""
Application configuration loaded from environment variables (.env).
Centralized settings object used across the whole backend.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Application
    APP_ENV: str = "development"
    APP_NAME: str = "Acadexa"
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"
    ENABLE_DOCS: bool = True

    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    # WhatsApp
    WHATSAPP_PROVIDER: str = "fake"
    WHATSAPP_API_URL: str = ""
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""

    # Backup / reports
    BACKUP_DIR: str = "./storage/backups"
    REPORTS_DIR: str = "./storage/reports"
    PG_DUMP_PATH: str = "pg_dump"
    PG_RESTORE_PATH: str = "psql"

    # Notification worker
    NOTIFICATION_WORKER_INTERVAL_SECONDS: int = 10

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
