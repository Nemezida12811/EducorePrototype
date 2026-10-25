import base64
import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import timedelta

import bcrypt
import jwt
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .errors import AppError, forbidden, unauthorized
from .models import ApiKey, CourseTeacher, Institution, Role, User, now

settings = get_settings()


# ---------- hashing helpers ----------
def sha256(s: str) -> str: return hashlib.sha256(s.encode()).hexdigest()
def random_token(n: int = 32) -> str: return secrets.token_urlsafe(n)
def hmac_hex(secret: str, payload: str | bytes) -> str:
    return hmac.new(secret.encode(), payload if isinstance(payload, bytes) else payload.encode(), hashlib.sha256).hexdigest()
def safe_equal(a: str, b: str) -> bool: return hmac.compare_digest(a.encode(), b.encode())


def _prep(pw: str) -> bytes:  # bcrypt only reads 72 bytes; pre-hash so long passphrases are fully used
    return base64.b64encode(hashlib.sha256(pw.encode()).digest())


def hash_password(pw: str) -> str: return bcrypt.hashpw(_prep(pw), bcrypt.gensalt(12)).decode()
def verify_password(pw: str, hashed: str) -> bool:
    try: return bcrypt.checkpw(_prep(pw), hashed.encode())
    except ValueError: return False


DUMMY_HASH = hash_password("dummy-password-for-timing")  # equalises timing for unknown e-mails


# ---------- JWT ----------
def make_access_token(user: User) -> str:
    exp = now() + timedelta(minutes=settings.access_token_ttl_min)
    return jwt.encode({"sub": user.id, "role": user.role.value, "exp": exp}, settings.jwt_secret, algorithm="HS256")


def make_challenge_token(user: User) -> str:
    return jwt.encode({"sub": user.id, "purpose": "2fa", "exp": now() + timedelta(minutes=5)}, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


# ---------- principal & guards ----------
@dataclass
class Principal:
    user_id: str
    role: Role
    kind: str = "user"  # 'user' | 'apiKey'


_inst_cache: dict = {"at": 0.0, "status": "active"}
def invalidate_institution_cache() -> None: _inst_cache["at"] = 0.0


def _institution_status(db: Session) -> str:
    if time.time() - _inst_cache["at"] > 30:
        i = db.scalars(select(Institution).limit(1)).first()
        _inst_cache.update(at=time.time(), status=i.status if i else "active")
    return _inst_cache["status"]


def role_allowed(role: Role, allowed: tuple[Role, ...] | list[Role]) -> bool:
    """super_admin is a superset of admin."""
    return role in allowed or (role == Role.super_admin and Role.admin in allowed)


def authenticate(request: Request, db: Session = Depends(get_db)) -> Principal:
    cached = getattr(request.state, "principal", None)
    if cached: return cached
    api_key = request.headers.get("x-api-key")
    if api_key:  # format ek_<prefix>_<secret>; read-only, acts with admin read access
        parts = api_key.split("_")
        if len(parts) < 3: raise unauthorized("Invalid API key")
        k = db.scalars(select(ApiKey).where(ApiKey.prefix == parts[1], ApiKey.revoked_at.is_(None))).first()
        if not k or not safe_equal(k.key_hash, sha256(api_key)): raise unauthorized("Invalid API key")
        if request.method != "GET": raise forbidden("API keys are read-only")
        k.last_used_at = now(); db.commit()
        p = Principal(k.created_by or k.id, Role.admin, "apiKey")
    else:
        auth = request.headers.get("authorization", "")
        if not auth.lower().startswith("bearer "): raise unauthorized()
        try: payload = decode_token(auth[7:])
        except jwt.PyJWTError: raise unauthorized("Invalid or expired token")
        if payload.get("purpose") or not payload.get("sub"): raise unauthorized("Invalid token")
        u = db.get(User, payload["sub"])
        if not u or not u.active: raise unauthorized("Account is disabled")
        if u.role != Role.super_admin and _institution_status(db) == "suspended":
            raise AppError(403, "institution_suspended", "The institution is currently suspended")
        p = Principal(u.id, u.role)
    request.state.principal = p
    return p


def require_roles(*roles: Role):
    def dep(p: Principal = Depends(authenticate)) -> Principal:
        if not role_allowed(p.role, roles): raise forbidden()
        return p
    return dep


def is_course_teacher(db: Session, user_id: str, course_id: str) -> bool:
    return db.get(CourseTeacher, (course_id, user_id)) is not None


def can_manage_course(db: Session, p: Principal, course_id: str) -> bool:
    """Admin, or a teacher of that course."""
    if role_allowed(p.role, [Role.admin]): return True
    return p.role == Role.teacher and is_course_teacher(db, p.user_id, course_id)


# ---------- tiny in-memory rate limiter (per process; use a proxy/redis limiter when scaling out) ----------
_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(name: str, limit: int, window_s: int = 60):
    def dep(request: Request) -> None:
        if not settings.rate_limit_enabled: return
        key = f"{name}:{request.client.host if request.client else '?'}"
        q, t = _hits[key], time.time()
        while q and q[0] < t - window_s: q.popleft()
        if len(q) >= limit: raise AppError(429, "rate_limited", "Too many requests, slow down")
        q.append(t)
    return dep
