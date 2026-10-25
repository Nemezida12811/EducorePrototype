from datetime import timedelta

import jwt
import pyotp
from fastapi import APIRouter, Depends, Request, Response
from jwt import PyJWKClient
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..errors import AppError, bad_request, forbidden, not_found, unauthorized
from ..models import PasswordReset, RefreshToken, Role, User, now
from ..schemas import CamelModel, EmailMixin
from ..security import (DUMMY_HASH, Principal, authenticate, decode_token, hash_password, make_challenge_token, random_token,
                        rate_limit, role_allowed, sha256, verify_password)
from ..services import audit, create_user, emit
from ..tokens import issue_tokens, revoke_all, rotate_refresh

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])
strict = Depends(rate_limit("auth", 10))

_google = PyJWKClient("https://www.googleapis.com/oauth2/v3/certs")
_ms = PyJWKClient("https://login.microsoftonline.com/common/discovery/v2.0/keys")


class RegisterIn(EmailMixin):
    password: str | None = Field(None, min_length=12, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: Role | None = None
    study_program_id: str | None = None
    department_id: str | None = None


class LoginIn(EmailMixin):
    password: str = Field(min_length=1, max_length=128)


class RefreshIn(CamelModel):
    refresh_token: str = Field(min_length=10)


class ResetIn(EmailMixin): pass


class ResetConfirmIn(CamelModel):
    token: str = Field(min_length=10)
    password: str = Field(min_length=12, max_length=128)


class SsoIn(CamelModel):
    id_token: str = Field(min_length=20)


class TwoFaVerifyIn(CamelModel):
    challenge_token: str
    code: str = Field(pattern=r"^\d{6}$")


class TwoFaEnableIn(CamelModel):
    code: str | None = Field(None, pattern=r"^\d{6}$")


@router.post("/register", status_code=201, dependencies=[strict])
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    if request.headers.get("authorization") or request.headers.get("x-api-key"):
        p = authenticate(request, db)
        if p.kind != "user" or not role_allowed(p.role, [Role.admin]): raise forbidden()
        role = body.role or Role.student
        if role in (Role.admin, Role.super_admin) and p.role != Role.super_admin: raise forbidden("Only a super admin can create admins")
        user, temp = create_user(db, email=body.email, password=body.password, first_name=body.first_name, last_name=body.last_name, role=role,
                                 department_id=body.department_id, study_program_id=body.study_program_id)
        audit(db, request, "user.create", "user", user.id, {"role": role.value}); db.commit()
        emit("user.created", {"id": user.id, "role": role.value})
        return {"user": user.public(), "temporaryPassword": temp}
    if not settings.allow_public_registration: raise forbidden("Public registration is disabled")
    if not body.password: raise bad_request("password_required")
    if settings.allowed_email_domain and not body.email.endswith("@" + settings.allowed_email_domain.lower()):
        raise forbidden("This e-mail domain is not allowed")
    user, _ = create_user(db, email=body.email, password=body.password, first_name=body.first_name, last_name=body.last_name,
                          role=Role.student, study_program_id=body.study_program_id)  # public sign-up only ever creates students
    audit(db, request, "user.register", "user", user.id, actor_id=user.id); db.commit()
    return {"user": user.public()}


@router.post("/login", dependencies=[strict])
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(User.email == body.email)).first()
    ok = verify_password(body.password, user.password_hash if user and user.password_hash else DUMMY_HASH)
    if not user or not ok or not user.active:
        audit(db, request, "auth.login_failed", "user", user.id if user else None, {"email": body.email}, actor_id=user.id if user else None)
        db.commit()
        raise unauthorized("Invalid e-mail or password")
    if user.totp_enabled:
        return {"twoFactorRequired": True, "challengeToken": make_challenge_token(user)}
    audit(db, request, "auth.login", "user", user.id, actor_id=user.id)
    return issue_tokens(db, user, request)


@router.post("/2fa/verify", dependencies=[strict])
def verify_2fa(body: TwoFaVerifyIn, request: Request, db: Session = Depends(get_db)):
    try: payload = decode_token(body.challenge_token)
    except jwt.PyJWTError: raise unauthorized("Challenge expired")
    if payload.get("purpose") != "2fa": raise unauthorized("Invalid challenge")
    user = db.get(User, payload["sub"])
    if not user or not user.active or not user.totp_secret or not pyotp.TOTP(user.totp_secret).verify(body.code, valid_window=1):
        raise unauthorized("Invalid verification code")
    audit(db, request, "auth.login", "user", user.id, {"twoFactor": True}, actor_id=user.id)
    return issue_tokens(db, user, request)


@router.post("/refresh", dependencies=[strict])
def refresh(body: RefreshIn, request: Request, db: Session = Depends(get_db)):
    return rotate_refresh(db, body.refresh_token, request)


@router.post("/logout", status_code=204)
def logout(body: RefreshIn, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    row = db.scalars(select(RefreshToken).where(RefreshToken.token_hash == sha256(body.refresh_token), RefreshToken.user_id == p.user_id,
                                                RefreshToken.revoked_at.is_(None))).first()
    if row: row.revoked_at = now(); db.commit()
    return Response(status_code=204)


@router.post("/password-reset", status_code=202, dependencies=[Depends(rate_limit("reset", 5))])
def password_reset(body: ResetIn, db: Session = Depends(get_db)):
    user = db.scalars(select(User).where(User.email == body.email)).first()
    if user and user.active:
        token = random_token(32)
        db.add(PasswordReset(user_id=user.id, token_hash=sha256(token), expires_at=now() + timedelta(hours=1))); db.commit()
        # TODO(mailer): e-mail a link containing `token`. Logged in development only.
        if settings.env == "development": print(f"[dev] password reset token for {user.email}: {token}")
    return {"message": "If the account exists, a reset e-mail has been sent."}  # identical response either way


@router.post("/password-reset/confirm", status_code=204, dependencies=[strict])
def password_reset_confirm(body: ResetConfirmIn, request: Request, db: Session = Depends(get_db)):
    row = db.scalars(select(PasswordReset).where(PasswordReset.token_hash == sha256(body.token))).first()
    if not row or row.used_at or row.expires_at < now(): raise bad_request("invalid_token", "Reset link is invalid or expired")
    db.get(User, row.user_id).password_hash = hash_password(body.password)
    row.used_at = now(); revoke_all(db, row.user_id)
    audit(db, request, "auth.password_reset", "user", row.user_id, actor_id=row.user_id); db.commit()
    return Response(status_code=204)


@router.post("/sso/{provider}", dependencies=[strict])
def sso(provider: str, body: SsoIn, request: Request, db: Session = Depends(get_db)):
    if provider not in ("google", "microsoft"): raise not_found("Provider")
    mail = None
    try:
        if provider == "google":
            if not settings.google_client_id: raise AppError(501, "sso_not_configured")
            key = _google.get_signing_key_from_jwt(body.id_token).key
            c = jwt.decode(body.id_token, key, algorithms=["RS256"], audience=settings.google_client_id,
                           issuer=["https://accounts.google.com", "accounts.google.com"])
            if c.get("email_verified") is True: mail = str(c.get("email", ""))
        else:
            if not settings.microsoft_client_id: raise AppError(501, "sso_not_configured")
            key = _ms.get_signing_key_from_jwt(body.id_token).key
            c = jwt.decode(body.id_token, key, algorithms=["RS256"], audience=settings.microsoft_client_id, options={"verify_iss": False})
            if not str(c.get("iss", "")).startswith("https://login.microsoftonline.com/"): raise ValueError("bad issuer")
            mail = str(c.get("email") or c.get("preferred_username") or "")
    except AppError: raise
    except Exception: raise unauthorized("SSO token could not be verified")
    mail = (mail or "").lower()
    if not mail or (settings.allowed_email_domain and not mail.endswith("@" + settings.allowed_email_domain.lower())):
        raise unauthorized("SSO account not allowed")
    user = db.scalars(select(User).where(User.email == mail)).first()  # SSO never auto-provisions accounts
    if not user or not user.active: raise unauthorized("No active account for this identity")
    audit(db, request, "auth.login", "user", user.id, {"sso": provider}, actor_id=user.id)
    return issue_tokens(db, user, request)


@router.post("/2fa/enable")
def enable_2fa(request: Request, body: TwoFaEnableIn | None = None, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    """Without `code`: starts setup (returns secret + otpauth URI). With `code`: confirms and activates."""
    user = db.get(User, p.user_id)
    if user.totp_enabled: raise bad_request("already_enabled", "Two-factor authentication is already enabled")
    code = body.code if body else None
    if not code:
        user.totp_secret = pyotp.random_base32(); db.commit()
        return {"secret": user.totp_secret, "otpauthUrl": pyotp.TOTP(user.totp_secret).provisioning_uri(name=user.email, issuer_name="EduCore")}
    if not user.totp_secret or not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1): raise bad_request("invalid_code")
    user.totp_enabled = True
    audit(db, request, "auth.2fa_enabled", "user", user.id); db.commit()
    return {"twoFactorEnabled": True}


@router.get("/sessions")
def sessions(p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    rows = db.scalars(select(RefreshToken).where(RefreshToken.user_id == p.user_id, RefreshToken.revoked_at.is_(None),
                                                 RefreshToken.expires_at > now())).all()
    return {"items": [r.d(exclude=("token_hash", "user_id", "revoked_at")) for r in rows]}
