import pytest
from sqlalchemy import select

from app.db import SessionLocal
from app.models import User
from app.routers import auth as auth_router


def test_demo_login_is_off_by_default(client):
    assert client.get("/api/v1/auth/demo-accounts").status_code == 404
    assert client.post("/api/v1/auth/demo-login", json={"role": "admin"}).status_code == 404


@pytest.fixture
def demo_on(monkeypatch):
    monkeypatch.setattr(auth_router.settings, "demo_login", True)
    with SessionLocal() as s:  # other tests may have turned 2FA on for a demo account, which demo sign-in deliberately refuses
        for u in s.scalars(select(User).where(User.email.in_(auth_router.DEMO_ACCOUNTS.values()))): u.totp_enabled = False
        s.commit()


def test_demo_login_refuses_an_account_with_two_factor(client, demo_on):
    with SessionLocal() as s:
        u = s.scalars(select(User).where(User.email == auth_router.DEMO_ACCOUNTS["teacher"])).one()
        u.totp_enabled = True; s.commit()
    assert client.post("/api/v1/auth/demo-login", json={"role": "teacher"}).status_code == 404
    with SessionLocal() as s:
        s.scalars(select(User).where(User.email == auth_router.DEMO_ACCOUNTS["teacher"])).one().totp_enabled = False; s.commit()


def test_demo_accounts_listed_without_super_admin(client, demo_on):
    items = client.get("/api/v1/auth/demo-accounts").json()["items"]
    assert {i["role"] for i in items} == {"student", "teacher", "admin"}
    assert all("superadmin" not in i["email"] for i in items)


@pytest.mark.parametrize("role", ["student", "teacher", "admin"])
def test_demo_login_signs_in_the_matching_role(client, demo_on, role):
    r = client.post("/api/v1/auth/demo-login", json={"role": role})
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["role"] == role and body["accessToken"] and body["refreshToken"]
    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {body['accessToken']}"})
    assert me.status_code == 200 and me.json()["role"] == role


def test_demo_login_rejects_other_roles(client, demo_on):
    assert client.post("/api/v1/auth/demo-login", json={"role": "super_admin"}).status_code == 400
