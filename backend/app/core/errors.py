from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, message: str, code: str = "APP_ERROR", status_code: int = 400):
        self.message = message
        self.code = code
        self.status_code = status_code
        super().__init__(message)


class AuthenticationError(AppError):
    def __init__(self, message: str = "Authentication failed."):
        super().__init__(message, code="AUTHENTICATION_ERROR", status_code=401)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found."):
        super().__init__(message, code="NOT_FOUND", status_code=404)


class ConflictError(AppError):
    def __init__(self, message: str, code: str = "CONFLICT"):
        super().__init__(message, code=code, status_code=409)


class ValidationAppError(AppError):
    def __init__(self, message: str, code: str = "VALIDATION_ERROR"):
        super().__init__(message, code=code, status_code=422)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
            headers=headers,
        )

    @app.exception_handler(Exception)
    async def handle_general_exception(_request: Request, exc: Exception):
        import logging
        import traceback
        tb = traceback.format_exc()
        logging.getLogger("acadexa.errors").error("Unhandled Exception: %s\n%s", exc, tb)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "INTERNAL_SERVER_ERROR", "message": str(exc)}},
        )
