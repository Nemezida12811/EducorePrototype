from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import get_settings
from .db import Base, engine
from .errors import AppError
from .routers import audit, auth, billing, courses, enrollments, files, grades, institutions, integrations, notices, org, reports, schedule, users

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    from . import models  # noqa: F401  (register tables)
    Base.metadata.create_all(engine)  # simple schema bootstrap; use Alembic once the schema starts evolving
    yield


app = FastAPI(title="EduCore API", version="0.1.0", lifespan=lifespan,
              docs_url=None if settings.is_prod else "/docs", redoc_url=None, openapi_url=None if settings.is_prod else "/openapi.json")

app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
                   allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["content-type", "authorization", "x-api-key"],
                   expose_headers=["content-disposition"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    r = await call_next(request)
    r.headers.setdefault("x-content-type-options", "nosniff")
    r.headers.setdefault("x-frame-options", "DENY")
    r.headers.setdefault("referrer-policy", "no-referrer")
    if settings.is_prod: r.headers.setdefault("strict-transport-security", "max-age=31536000; includeSubDomains")
    return r


@app.exception_handler(AppError)
async def _app_error(_: Request, e: AppError):
    return JSONResponse({"error": e.code, "message": e.message, "details": e.details}, status_code=e.status)


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, e: RequestValidationError):
    details = [{"path": ".".join(str(x) for x in err["loc"][1:]), "message": err["msg"]} for err in e.errors()]
    return JSONResponse({"error": "validation_error", "message": "Invalid request", "details": details}, status_code=400)


@app.exception_handler(StarletteHTTPException)
async def _http(_: Request, e: StarletteHTTPException):
    return JSONResponse({"error": "not_found" if e.status_code == 404 else "http_error", "message": str(e.detail)}, status_code=e.status_code)


@app.exception_handler(IntegrityError)
async def _integrity(_: Request, e: IntegrityError):
    return JSONResponse({"error": "conflict", "message": "Duplicate record or reference to a missing/in-use record"}, status_code=409)


@app.exception_handler(Exception)
async def _unhandled(_: Request, e: Exception):
    import logging
    logging.getLogger("educore").exception("unhandled error", exc_info=e)
    return JSONResponse({"error": "internal_error", "message": "Something went wrong"}, status_code=500)


@app.get("/health")
def health(): return {"status": "ok"}


for r in (auth, users, institutions, courses, enrollments, grades, schedule, notices, files, reports, audit, billing, integrations, org):
    app.include_router(r.router, prefix="/api/v1")
