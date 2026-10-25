from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import conflict, not_found
from ..models import Course, File, Institution, Role, User
from ..schemas import CamelModel
from ..security import Principal, invalidate_institution_cache, require_roles
from ..services import audit

router = APIRouter(tags=["institutions"])
guard = Depends(require_roles(Role.super_admin))


def platform_usage(db: Session) -> dict:
    i = db.scalars(select(Institution).limit(1)).first()
    return {
        "users": {"used": db.scalar(select(func.count()).select_from(User).where(User.active.is_(True))), "limit": i.max_users if i else 0},
        "storage": {"usedBytes": db.scalar(select(func.coalesce(func.sum(File.size), 0))), "limitBytes": (i.max_storage_mb if i else 0) * 1024 * 1024},
        "courses": {"active": db.scalar(select(func.count()).select_from(Course).where(Course.archived.is_(False))),
                    "archived": db.scalar(select(func.count()).select_from(Course).where(Course.archived.is_(True)))},
    }


class InstitutionIn(CamelModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    domain: str | None = Field(None, max_length=200)
    plan: str | None = Field(None, max_length=50)
    max_users: int | None = Field(None, ge=1)
    max_storage_mb: int | None = Field(None, ge=1)


class StatusIn(CamelModel):
    status: Literal["active", "suspended"]


def _load(db: Session, inst_id: str | None = None) -> Institution:
    i = db.scalars(select(Institution).limit(1)).first()
    if not i or (inst_id and i.id != inst_id): raise not_found("Institution")
    return i


# The deployment serves a single institution; these endpoints operate on that one record.
@router.get("/institutions", dependencies=[guard])
def list_institutions(db: Session = Depends(get_db)): return {"items": [_load(db).d()]}


@router.post("/institutions", dependencies=[guard])
def create_institution(): raise conflict("single_institution", "This deployment serves a single institution")


@router.get("/institutions/{inst_id}", dependencies=[guard])
def get_institution(inst_id: str, db: Session = Depends(get_db)):
    return {**_load(db, inst_id).d(), "usage": platform_usage(db)}


@router.put("/institutions/{inst_id}")
def update_institution(inst_id: str, body: InstitutionIn, request: Request, p: Principal = guard, db: Session = Depends(get_db)):
    i = _load(db, inst_id)
    data = body.model_dump(exclude_unset=True)
    usage = platform_usage(db)
    if data.get("max_users") is not None and data["max_users"] < usage["users"]["used"]: raise conflict("limit_below_usage", "User limit is below current usage")
    if data.get("max_storage_mb") is not None and data["max_storage_mb"] * 1024 * 1024 < usage["storage"]["usedBytes"]:
        raise conflict("limit_below_usage", "Storage limit is below current usage")
    for k, v in data.items(): setattr(i, k, v)
    audit(db, request, "institution.update", "institution", inst_id, data); db.commit()
    return i.d()


@router.put("/institutions/{inst_id}/status")
def set_status(inst_id: str, body: StatusIn, request: Request, p: Principal = guard, db: Session = Depends(get_db)):
    i = _load(db, inst_id)
    i.status = body.status
    invalidate_institution_cache()
    audit(db, request, "institution.status", "institution", inst_id, {"status": body.status}); db.commit()
    return i.d()
