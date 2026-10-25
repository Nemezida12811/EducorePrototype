"""Integration tests run against a throw-away SQLite file that is rebuilt (schema + seed) for every session."""
import os
import shutil
import tempfile

_tmp = tempfile.mkdtemp(prefix="educore-test-")
os.environ.update(DATABASE_URL=f"sqlite:///{_tmp}/test.db", JWT_SECRET="test-secret-test-secret-test-secret-test", ENV="test",
                  RATE_LIMIT_ENABLED="false", STORAGE_DIR=f"{_tmp}/files", SEED_ADMIN_PASSWORD="ChangeMe!12345", STRIPE_WEBHOOK_SECRET="whsec_test")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import run_seed  # noqa: E402

PW = "ChangeMe!12345"


@pytest.fixture(scope="session")
def client():
    from app import models  # noqa: F401
    Base.metadata.create_all(engine)
    with SessionLocal() as s: run_seed(s)
    with TestClient(app) as c: yield c
    shutil.rmtree(_tmp, ignore_errors=True)


class Api:
    def __init__(self, client): self.c, self.tok, self.refresh = client, {}, {}

    def login(self, email, who):
        r = self.c.post("/api/v1/auth/login", json={"email": email, "password": PW}); assert r.status_code == 200, r.text
        self.tok[who], self.refresh[who] = r.json()["accessToken"], r.json()["refreshToken"]

    def h(self, who): return {"authorization": f"Bearer {self.tok[who]}"}
    def get(self, who, url, **k): return self.c.get(f"/api/v1{url}", headers=self.h(who), **k)
    def post(self, who, url, json=None, **k): return self.c.post(f"/api/v1{url}", headers=self.h(who), json=json, **k)
    def put(self, who, url, json=None): return self.c.put(f"/api/v1{url}", headers=self.h(who), json=json)
    def delete(self, who, url): return self.c.delete(f"/api/v1{url}", headers=self.h(who))


@pytest.fixture(scope="session")
def api(client):
    a = Api(client)
    for email, who in [("superadmin", "super"), ("admin", "admin"), ("teacher1", "t1"), ("teacher2", "t2"), ("student1", "s1"), ("student3", "s3")]:
        a.login(f"{email}@educore.example", who)
    return a
