from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import not_found
from ..models import AuditLog, Role, User
from ..security import Principal, require_roles
from ..services import Page

router = APIRouter(tags=["audit"])


def _naive(d: datetime | None): return d.astimezone(None).replace(tzinfo=None) if d and d.tzinfo else d


# Read-only by design: the API exposes no way to modify or delete audit records.
@router.get("/audit-log")
def list_log(page: Page = Depends(), actor_id: str | None = Query(None, alias="actorId"), action: str | None = Query(None, max_length=80),
             entity_type: str | None = Query(None, alias="entityType"), from_: datetime | None = Query(None, alias="from"), to: datetime | None = None,
             _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    conds = []
    if actor_id: conds.append(AuditLog.actor_id == actor_id)
    if action: conds.append(AuditLog.action.startswith(action, autoescape=True))
    if entity_type: conds.append(AuditLog.entity_type == entity_type)
    if from_: conds.append(AuditLog.at >= _naive(from_))
    if to: conds.append(AuditLog.at <= _naive(to))
    total = db.scalar(select(func.count()).select_from(AuditLog).where(*conds))
    rows = db.execute(select(AuditLog, User.email).outerjoin(User, User.id == AuditLog.actor_id).where(*conds)
                      .order_by(AuditLog.at.desc()).limit(page.page_size).offset(page.offset)).all()
    return page.wrap([{**a.d(exclude=("meta",)), "actorEmail": email} for a, email in rows], total)


@router.get("/audit-log/{log_id}")
def get_log(log_id: str, _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    a = db.get(AuditLog, log_id)
    if not a: raise not_found("Audit record")
    return a.d()
