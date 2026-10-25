import json
import time
import re

from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import datetime

from ..config import get_settings
from ..db import get_db
from ..errors import AppError, not_found, unauthorized
from ..models import Institution, Invoice, Role
from ..schemas import CamelModel
from ..security import Principal, hmac_hex, rate_limit, require_roles, safe_equal
from ..services import audit
from .institutions import platform_usage

settings = get_settings()
router = APIRouter(tags=["billing"])


class PlanIn(CamelModel):
    plan: str = Field(min_length=1, max_length=50)
    plan_renews_at: datetime | None = None


# Optional module: the frontend currently has no plans/billing UI, so this stays thin.
@router.get("/billing/subscription")
def subscription(_: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    i = db.scalars(select(Institution).limit(1)).first()
    if not i: raise not_found("Institution")
    return {"plan": i.plan, "status": i.status, "renewsAt": i.d()["planRenewsAt"],
            "limits": {"maxUsers": i.max_users, "maxStorageMb": i.max_storage_mb}, "usage": platform_usage(db)}


@router.put("/billing/subscription")
def change_plan(body: PlanIn, request: Request, _: Principal = Depends(require_roles(Role.super_admin)), db: Session = Depends(get_db)):
    i = db.scalars(select(Institution).limit(1)).first()
    i.plan = body.plan
    i.plan_renews_at = body.plan_renews_at.replace(tzinfo=None) if body.plan_renews_at else None
    audit(db, request, "billing.plan_change", "institution", i.id, {"plan": body.plan}); db.commit()
    return {"plan": i.plan, "renewsAt": i.d()["planRenewsAt"]}


@router.get("/billing/invoices")
def invoices(_: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    return {"items": [x.d() for x in db.scalars(select(Invoice).order_by(Invoice.issued_at.desc()).limit(200))]}


@router.post("/billing/webhook", dependencies=[Depends(rate_limit("billing-webhook", 120))])
async def webhook(request: Request, db: Session = Depends(get_db)):
    """Stripe-style signed webhook. Reads the raw body (needed for the HMAC) and has no JWT auth."""
    if not settings.stripe_webhook_secret: raise AppError(501, "webhook_not_configured")
    raw = await request.body()
    header = request.headers.get("stripe-signature", "")
    t = (re.search(r"t=(\d+)", header) or [None, None])[1]
    sigs = re.findall(r"v1=([0-9a-f]+)", header)
    if not t or not sigs or abs(time.time() - int(t)) > 300: raise unauthorized("Invalid signature")
    expected = hmac_hex(settings.stripe_webhook_secret, t.encode() + b"." + raw)
    if not any(safe_equal(s, expected) for s in sigs): raise unauthorized("Invalid signature")
    try:
        event = json.loads(raw)
        obj, etype = event["data"]["object"], str(event["type"])
        ext_id = str(obj["id"])
    except (ValueError, KeyError, TypeError):
        raise AppError(400, "invalid_event", "Malformed event")
    if etype.startswith("invoice."):
        status = "paid" if etype == "invoice.paid" else "failed" if etype == "invoice.payment_failed" else str(obj.get("status") or "open")
        amount = int(obj.get("amount_paid") or obj.get("amount_due") or 0)
        inv = db.scalars(select(Invoice).where(Invoice.external_id == ext_id)).first()
        if inv: inv.status, inv.amount_cents, inv.number = status, amount, obj.get("number")
        else: db.add(Invoice(external_id=ext_id, number=obj.get("number"), amount_cents=amount, currency=str(obj.get("currency") or "eur"), status=status))
        audit(db, None, f"billing.{etype}", "invoice", ext_id); db.commit()
    return {"received": True}
