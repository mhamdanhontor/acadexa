"""Acadexa FastAPI application entrypoint."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_exception_handlers

logging.basicConfig(level=settings.LOG_LEVEL)

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

# Routers implemented so far
from app.api import auth, users, classes, batches, subjects, students, attendance, test_sessions, tests, marks  # noqa: E402

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


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}
