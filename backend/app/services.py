"""Shared business helpers: audit, notifications, webhooks, grades, storage, users, CSV, pagination."""
import csv
import io
import json
import re
import threading
import urllib.request
import uuid
from pathlib import Path

from fastapi import Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import MAX_UPLOAD_BYTES, get_settings
from .errors import conflict
from .models import AuditLog, File, Institution, Notification, Role, User, Webhook
from .security import hash_password, hmac_hex, random_token

settings = get_settings()

WEBHOOK_EVENTS = ["course.created", "course.archived", "enrollment.created", "enrollment.removed",
                  "grade.updated", "announcement.published", "user.created"]


def audit(db: Session, request: Request | None, action: str, entity_type: str, entity_id: str | None = None,
          meta: dict | None = None, actor_id: str | None = None) -> None:
    p = getattr(request.state, "principal", None) if request else None
    db.add(AuditLog(actor_id=actor_id or (p.user_id if p else None), action=action, entity_type=entity_type,
                    entity_id=entity_id, meta=meta or {}, ip=request.client.host if request and request.client else None))


def notify_users(db: Session, user_ids: list[str], title: str, body: str = "") -> None:
    """In-app notifications honouring each user's channel choice. E-mail/push delivery is a stub (see README)."""
    if not user_ids: return
    users = db.scalars(select(User).where(User.id.in_(set(user_ids)))).all()
    db.add_all(Notification(user_id=u.id, title=title[:200], body=body) for u in users if u.notification_channels.get("inApp", True))
    # TODO(mailer): for users with notification_channels["email"] send e-mail here.


def emit(event: str, data: dict) -> None:
    """Fire-and-forget signed webhook delivery in a background thread. Failures never affect the request."""
    from .db import SessionLocal

    def run() -> None:
        try:
            with SessionLocal() as db:
                hooks = [h for h in db.scalars(select(Webhook).where(Webhook.active.is_(True))) if event in h.events]
            body = json.dumps({"event": event, "data": data}).encode()
            for h in hooks:
                req = urllib.request.Request(h.url, data=body, method="POST", headers={
                    "content-type": "application/json", "x-educore-event": event, "x-educore-signature": hmac_hex(h.secret, body)})
                try: urllib.request.build_opener(_NoRedirect).open(req, timeout=5)
                except Exception: pass
        except Exception:
            pass
    threading.Thread(target=run, daemon=True).start()


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None


# ---------- grades ----------
def mark_for(score: int) -> str:
    return "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "D" if score >= 60 else "E" if score >= 50 else "FX"


def is_passed(mark: str | None) -> bool: return mark is not None and mark != "FX"


def compute_final(scheme: list[dict], components: dict) -> tuple[int | None, str | None]:
    """Final score exists only when every scheme component has points."""
    if not all(isinstance(components.get(c["name"]), (int, float)) for c in scheme): return None, None
    total = round(sum(components[c["name"]] for c in scheme))
    score = max(0, min(100, total))
    return score, mark_for(score)


# ---------- users ----------
def create_user(db: Session, *, email: str, password: str | None, first_name: str, last_name: str, role: Role,
                phone: str | None = None, department_id: str | None = None, study_program_id: str | None = None):
    email = email.strip().lower()
    inst = db.scalars(select(Institution).limit(1)).first()
    if inst and db.scalar(select(func.count()).select_from(User).where(User.active.is_(True))) >= inst.max_users:
        raise conflict("user_limit_reached", "The platform user limit has been reached")
    if db.scalar(select(User.id).where(User.email == email)):
        raise conflict("email_taken", "An account with this e-mail already exists")
    temp = None if password else random_token(12) + "aA1!"
    u = User(email=email, first_name=first_name, last_name=last_name, role=role, phone=phone, department_id=department_id,
             study_program_id=study_program_id, password_hash=hash_password(password or temp))
    db.add(u); db.flush()
    return u, temp


# ---------- storage ----------
_root = Path(settings.storage_dir).resolve()


def storage_used(db: Session) -> int:
    return db.scalar(select(func.coalesce(func.sum(File.size), 0))) or 0


def save_file(db: Session, data: bytes, owner_id: str | None, original_name: str, mime: str) -> File:
    inst = db.scalars(select(Institution).limit(1)).first()
    if inst and storage_used(db) + len(data) > inst.max_storage_mb * 1024 * 1024:
        raise conflict("storage_limit_reached", "The platform storage limit has been reached")
    _root.mkdir(parents=True, exist_ok=True)
    key = str(uuid.uuid4())  # never derived from user input -> no path traversal
    p = _root / key
    p.write_bytes(data); p.chmod(0o600)
    name = re.sub(r'[\x00-\x1f"\\/]', "_", Path(original_name or "file").name)[:255] or "file"
    f = File(owner_id=owner_id, name=name, mime=mime, size=len(data), storage_key=key)
    db.add(f); db.flush()
    return f


def stored_path(key: str) -> Path: return _root / key
def remove_stored(key: str) -> None: stored_path(key).unlink(missing_ok=True)


async def read_upload(upload) -> bytes:
    data = await upload.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        from .errors import AppError
        raise AppError(413, "file_too_large", "Files are limited to 10 MB")
    return data


def sniff_mime(b: bytes) -> str:  # client-supplied MIME is never trusted
    if b[:5] == b"%PDF-": return "application/pdf"
    if b[:8] == b"\x89PNG\r\n\x1a\n": return "image/png"
    if b[:2] == b"\xff\xd8": return "image/jpeg"
    return "application/octet-stream"


# ---------- misc ----------
def to_csv(rows: list[dict]) -> str:
    if not rows: return ""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    cols = list(rows[0])
    w.writerow(cols)
    for r in rows:  # neutralise spreadsheet formulas
        w.writerow([("'" + str(v)) if isinstance(v, str) and re.match(r"^[=+\-@\t\r]", v) else ("" if v is None else v) for v in (r[c] for c in cols)])
    return "\ufeff" + buf.getvalue()


class Page:
    def __init__(self, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100, alias="pageSize")):
        self.page, self.page_size = page, page_size
    @property
    def offset(self) -> int: return (self.page - 1) * self.page_size
    def wrap(self, items: list, total: int) -> dict:
        return {"items": items, "page": self.page, "pageSize": self.page_size, "total": total}
