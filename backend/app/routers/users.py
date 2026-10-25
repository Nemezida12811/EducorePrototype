from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import bad_request, forbidden, not_found
from ..models import (AuditLog, Enrollment, File, Grade, Notification, RefreshToken, Role, User, now)
from ..schemas import CamelModel, EmailMixin
from ..security import Principal, authenticate, require_roles
from ..services import Page, audit, create_user, emit
from ..tokens import revoke_all

router = APIRouter(tags=["users"])


class Channels(CamelModel):
    email: bool
    in_app: bool
    push: bool


class ProfileIn(CamelModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    phone: str | None = Field(None, max_length=40)
    notification_channels: Channels | None = None


class UserCreateIn(EmailMixin):
    password: str | None = Field(None, min_length=12, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: Role
    phone: str | None = Field(None, max_length=40)
    department_id: str | None = None
    study_program_id: str | None = None


class UserUpdateIn(CamelModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    email: str | None = None
    role: Role | None = None
    active: bool | None = None
    phone: str | None = Field(None, max_length=40)
    department_id: str | None = None
    study_program_id: str | None = None


@router.get("/users/me")
def get_me(p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    u = db.get(User, p.user_id)
    if not u: raise not_found("User")
    return u.public()


@router.put("/users/me")
def update_me(body: ProfileIn, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    u = db.get(User, p.user_id)
    data = body.model_dump(exclude_unset=True)
    if "notification_channels" in data and body.notification_channels:
        data["notification_channels"] = body.notification_channels.model_dump(by_alias=True)
    for k, v in data.items(): setattr(u, k, v)
    audit(db, request, "user.update_self", "user", u.id, {"fields": list(data)}); db.commit()
    return u.public()


@router.get("/users/me/export")
def export_me(request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    """GDPR data portability: everything held about the caller."""
    u = db.get(User, p.user_id)
    data = {
        "exportedAt": now().isoformat() + "Z", "profile": u.public(),
        "enrollments": [e.d() for e in db.scalars(select(Enrollment).where(Enrollment.student_id == u.id))],
        "grades": [g.d() for g in db.scalars(select(Grade).where(Grade.student_id == u.id))],
        "notifications": [n.d() for n in db.scalars(select(Notification).where(Notification.user_id == u.id))],
        "files": [f.d(exclude=("storage_key",)) for f in db.scalars(select(File).where(File.owner_id == u.id))],
        "sessions": [r.d(exclude=("token_hash",)) for r in db.scalars(select(RefreshToken).where(RefreshToken.user_id == u.id))],
        "activity": [a.d() for a in db.scalars(select(AuditLog).where(AuditLog.actor_id == u.id).order_by(AuditLog.at.desc()).limit(1000))],
    }
    audit(db, request, "user.export", "user", u.id); db.commit()
    return JSONResponse(data, headers={"content-disposition": 'attachment; filename="educore-my-data.json"'})


@router.get("/users")
def list_users(page: Page = Depends(), role: Role | None = None, active: Literal["true", "false"] | None = None,
               q: str | None = Query(None, max_length=100), _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    conds = []
    if role: conds.append(User.role == role)
    if active: conds.append(User.active.is_(active == "true"))
    if q:
        like = f"%{q.lower()}%"
        conds.append(or_(func.lower(User.email).like(like), func.lower(User.last_name).like(like), func.lower(User.first_name).like(like)))
    total = db.scalar(select(func.count()).select_from(User).where(*conds))
    rows = db.scalars(select(User).where(*conds).order_by(User.last_name, User.first_name).limit(page.page_size).offset(page.offset)).all()
    return page.wrap([u.public() for u in rows], total)


@router.post("/users", status_code=201)
def create(body: UserCreateIn, request: Request, p: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    if body.role in (Role.admin, Role.super_admin) and p.role != Role.super_admin: raise forbidden("Only a super admin can create admins")
    u, temp = create_user(db, email=body.email, password=body.password, first_name=body.first_name, last_name=body.last_name, role=body.role,
                          phone=body.phone, department_id=body.department_id, study_program_id=body.study_program_id)
    audit(db, request, "user.create", "user", u.id, {"role": body.role.value}); db.commit()
    emit("user.created", {"id": u.id, "role": u.role.value})
    return {"user": u.public(), "temporaryPassword": temp}


@router.put("/users/{user_id}")
def update(user_id: str, body: UserUpdateIn, request: Request, p: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    t = db.get(User, user_id)
    if not t: raise not_found("User")
    data = body.model_dump(exclude_unset=True)
    if user_id == p.user_id and (("role" in data and data["role"] != t.role) or data.get("active") is False):
        raise bad_request("self_lockout", "You cannot deactivate or demote yourself")
    privileged = {Role.admin, Role.super_admin}
    if p.role != Role.super_admin and ("role" in data or "active" in data) and (t.role in privileged or data.get("role") in privileged):
        raise forbidden("Only a super admin can change admin accounts or roles")
    if data.get("email"):
        from ..schemas import norm_email
        data["email"] = norm_email(data["email"])
    role_from = t.role
    for k, v in data.items(): setattr(t, k, v)
    if data.get("active") is False or ("role" in data and data["role"] != role_from): revoke_all(db, user_id)
    audit(db, request, "user.update", "user", user_id, {"fields": list(data), "roleFrom": role_from.value}); db.commit()
    return t.public()


@router.delete("/users/{user_id}", status_code=204)
def delete(user_id: str, request: Request, mode: Literal["deactivate", "anonymize"] = "deactivate",
           p: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    """Deactivates by default; mode=anonymize irreversibly strips personal data while keeping grades/history."""
    if user_id == p.user_id: raise bad_request("self_lockout", "You cannot remove your own account")
    t = db.get(User, user_id)
    if not t: raise not_found("User")
    if t.role in (Role.admin, Role.super_admin) and p.role != Role.super_admin: raise forbidden("Only a super admin can remove admin accounts")
    if mode == "anonymize":
        t.email, t.first_name, t.last_name, t.phone = f"deleted-{user_id}@anonymized.invalid", "Anonymized", "User", None
        t.password_hash = t.totp_secret = None; t.totp_enabled = False; t.active = False; t.anonymized_at = now()
        for n in db.scalars(select(Notification).where(Notification.user_id == user_id)): db.delete(n)
    else:
        t.active = False
    revoke_all(db, user_id)
    audit(db, request, "user.anonymize" if mode == "anonymize" else "user.deactivate", "user", user_id); db.commit()
    return Response(status_code=204)
