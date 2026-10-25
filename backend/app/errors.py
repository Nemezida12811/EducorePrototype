from typing import Any


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str | None = None, details: Any = None):
        self.status, self.code, self.message, self.details = status, code, message or code, details


def bad_request(code: str, msg: str | None = None, details: Any = None): return AppError(400, code, msg, details)
def unauthorized(msg: str = "Authentication required"): return AppError(401, "unauthorized", msg)
def forbidden(msg: str = "Insufficient permissions"): return AppError(403, "forbidden", msg)
def not_found(what: str = "Resource"): return AppError(404, "not_found", f"{what} not found")
def conflict(code: str, msg: str | None = None, details: Any = None): return AppError(409, code, msg, details)
