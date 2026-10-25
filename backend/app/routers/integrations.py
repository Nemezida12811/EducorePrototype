import re
import secrets
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Request, Response
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import bad_request, not_found
from ..models import ApiKey, Role, Webhook, now
from ..schemas import CamelModel
from ..security import Principal, random_token, require_roles, sha256
from ..services import WEBHOOK_EVENTS, audit

router = APIRouter(tags=["integrations"])
guard = Depends(require_roles(Role.admin))


class KeyIn(CamelModel):
    name: str = Field(min_length=1, max_length=100)


class WebhookIn(CamelModel):
    url: str = Field(max_length=2000)
    events: list[str] = Field(default_factory=lambda: list(WEBHOOK_EVENTS), min_length=1)

    @field_validator("events")
    @classmethod
    def _ev(cls, v):
        bad = [e for e in v if e not in WEBHOOK_EVENTS]
        if bad: raise ValueError(f"unknown events: {bad}")
        return v


def assert_public_https(raw: str) -> None:
    """Basic SSRF guard: https only, no obvious internal hosts. Also restrict egress at the network layer (DNS tricks are not blocked here)."""
    u = urlparse(raw)
    h = (u.hostname or "").lower()
    internal = (u.scheme != "https" or not h or h == "localhost" or h.endswith((".local", ".internal")) or ":" in h or "." not in h
                or re.match(r"^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)", h))
    if internal: raise bad_request("invalid_url", "Webhook URLs must be public https endpoints")


@router.get("/integrations/api-keys", dependencies=[guard])
def list_keys(db: Session = Depends(get_db)):
    return {"items": [k.d(exclude=("key_hash", "created_by")) for k in db.scalars(select(ApiKey))]}


@router.post("/integrations/api-keys", status_code=201)
def create_key(body: KeyIn, request: Request, p: Principal = guard, db: Session = Depends(get_db)):
    prefix = secrets.token_hex(5)
    key = f"ek_{prefix}_{random_token(24)}"
    k = ApiKey(name=body.name, prefix=prefix, key_hash=sha256(key), created_by=p.user_id); db.add(k); db.flush()
    audit(db, request, "api_key.create", "api_key", k.id); db.commit()
    return {"id": k.id, "name": k.name, "prefix": prefix, "apiKey": key, "note": "Store this key now; it cannot be shown again. Keys are read-only."}


@router.delete("/integrations/api-keys/{key_id}", status_code=204)
def revoke_key(key_id: str, request: Request, p: Principal = guard, db: Session = Depends(get_db)):
    k = db.get(ApiKey, key_id)
    if not k or k.revoked_at: raise not_found("API key")
    k.revoked_at = now(); audit(db, request, "api_key.revoke", "api_key", key_id); db.commit()
    return Response(status_code=204)


@router.get("/integrations/webhooks", dependencies=[guard])
def list_webhooks(db: Session = Depends(get_db)):
    return {"items": [w.d(exclude=("secret",)) for w in db.scalars(select(Webhook))]}


@router.post("/integrations/webhooks", status_code=201)
def create_webhook(body: WebhookIn, request: Request, p: Principal = guard, db: Session = Depends(get_db)):
    assert_public_https(body.url)
    w = Webhook(url=body.url, events=body.events, secret=random_token(32)); db.add(w); db.flush()
    audit(db, request, "webhook.create", "webhook", w.id, {"url": body.url}); db.commit()
    return {"id": w.id, "url": w.url, "events": w.events, "secret": w.secret, "note": "Deliveries carry x-educore-signature = HMAC-SHA256(body, secret)."}


@router.delete("/integrations/webhooks/{hook_id}", status_code=204)
def delete_webhook(hook_id: str, request: Request, p: Principal = guard, db: Session = Depends(get_db)):
    w = db.get(Webhook, hook_id)
    if not w: raise not_found("Webhook")
    db.delete(w); audit(db, request, "webhook.delete", "webhook", hook_id); db.commit()
    return Response(status_code=204)
