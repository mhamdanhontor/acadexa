"""Acadexa FastAPI application entrypoint."""
import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.workers.notification_worker import process_pending_notifications

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger("acadexa.main")

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all tables exist in database
    from app.db.session import Base, engine
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)

    scheduler.add_job(
        process_pending_notifications,
        "interval",
        seconds=settings.NOTIFICATION_WORKER_INTERVAL_SECONDS,
        id="notification_worker",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("Notification worker scheduler started (interval=%ss)", settings.NOTIFICATION_WORKER_INTERVAL_SECONDS)
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.2",
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
    lifespan=lifespan,
)

cors_origins = settings.cors_origins_list
has_wildcard = "*" in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=[] if has_wildcard else cors_origins,
    allow_origin_regex=".*" if has_wildcard else r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|file://|null)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# Routers
from app.api import (  # noqa: E402
    audit_logs,
    auth,
    backups,
    batches,
    classes,
    dashboard,
    exports,
    marks,
    notifications,
    reports,
    settings as settings_api,
    students,
    subjects,
    test_sessions,
    tests,
    users,
    attendance,
)

prefix = settings.API_V1_PREFIX
app.include_router(auth.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(classes.router, prefix=prefix)
app.include_router(batches.router, prefix=prefix)
app.include_router(subjects.router, prefix=prefix)
app.include_router(students.router, prefix=prefix)
app.include_router(attendance.router, prefix=prefix)
app.include_router(test_sessions.router, prefix=prefix)
app.include_router(tests.router, prefix=prefix)
app.include_router(marks.router, prefix=prefix)
app.include_router(notifications.router, prefix=prefix)
app.include_router(reports.router, prefix=prefix)
app.include_router(dashboard.router, prefix=prefix)
app.include_router(audit_logs.router, prefix=prefix)
app.include_router(backups.router, prefix=prefix)
app.include_router(settings_api.router, prefix=prefix)
app.include_router(exports.router, prefix=prefix)


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}
