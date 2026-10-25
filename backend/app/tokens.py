from datetime import timedelta

from fastapi import Request
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .config import get_settings
from .errors import unauthorized
from .models import RefreshToken, User, now
from .security import make_access_token, random_token, sha256

settings = get_settings()


def issue_tokens(db: Session, user: User, request: Request) -> dict:
    refresh = random_token(48)
    db.add(RefreshToken(user_id=user.id, token_hash=sha256(refresh), user_agent=(request.headers.get("user-agent") or "")[:500] or None,
                        ip=request.client.host if request.client else None,
                        expires_at=now() + timedelta(days=settings.refresh_token_ttl_days)))
    db.commit()
    return {"accessToken": make_access_token(user), "refreshToken": refresh, "tokenType": "Bearer",
            "expiresIn": settings.access_token_ttl_min * 60, "user": user.public()}


def revoke_all(db: Session, user_id: str) -> None:
    db.execute(update(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)).values(revoked_at=now()))


def rotate_refresh(db: Session, token: str, request: Request) -> dict:
    """Rotating refresh tokens; presenting a revoked token revokes all of the user's sessions (reuse detection)."""
    row = db.scalars(select(RefreshToken).where(RefreshToken.token_hash == sha256(token))).first()
    if not row: raise unauthorized("Invalid refresh token")
    if row.revoked_at:
        revoke_all(db, row.user_id); db.commit()
        raise unauthorized("Refresh token reuse detected; please sign in again")
    if row.expires_at < now(): raise unauthorized("Refresh token expired")
    user = db.get(User, row.user_id)
    if not user or not user.active: raise unauthorized("Account is disabled")
    row.revoked_at = now()
    return issue_tokens(db, user, request)
