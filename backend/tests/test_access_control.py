"""Who may call what: anonymous users, each role, and the public parts of the API (health, OpenAPI)."""
import pytest

PROTECTED = ["/users/me", "/users", "/courses", "/grades/me", "/enrollments/me", "/schedule/me", "/study-plan/me", "/audit-log",
             "/notifications", "/reports/institution/overview"]


@pytest.mark.parametrize("path", PROTECTED)
def test_anonymous_requests_are_rejected(client, path):
    assert client.get(f"/api/v1{path}").status_code == 401


@pytest.mark.parametrize("token", ["", "garbage", "Bearer not-a-jwt", "Bearer "])
def test_malformed_authorization_headers_are_rejected(client, token):
    assert client.get("/api/v1/users/me", headers={"authorization": token}).status_code == 401


@pytest.mark.parametrize("path", ["/users", "/audit-log", "/reports/institution/overview", "/reports/platform/usage"])
def test_students_cannot_use_admin_endpoints(api, path):
    assert api.get("s1", path).status_code == 403


@pytest.mark.parametrize("path", ["/users", "/audit-log", "/reports/platform/usage"])
def test_teachers_cannot_use_admin_endpoints(api, path):
    assert api.get("t1", path).status_code == 403


def test_each_role_sees_its_own_profile(api):
    for who, role in [("s1", "student"), ("t1", "teacher"), ("admin", "admin"), ("super", "super_admin")]:
        assert api.get(who, "/users/me").json()["role"] == role


def test_student_cannot_create_a_course_or_grade(api):
    assert api.post("s1", "/courses", {"code": "X1", "name": "Nope"}).status_code in (400, 403)
    assert api.post("s1", "/grades", {"enrollmentId": "x", "component": "Exam", "points": 10}).status_code in (400, 403)


def test_public_registration_is_disabled(client):
    r = client.post("/api/v1/auth/register", json={"email": "new@educore.example", "password": "a-long-password-1", "firstName": "N", "lastName": "N"})
    assert r.status_code == 403


def test_password_is_never_returned(api):
    body = api.get("s1", "/users/me").text.lower()
    assert "password" not in body and "totpsecret" not in body


def test_health_endpoints_are_public(client):
    assert client.get("/health").status_code == 200
    assert client.get("/health/ready").json()["database"] == "ok"


def test_openapi_spec_is_public_and_describes_the_api(client):
    spec = client.get("/openapi.json")
    assert spec.status_code == 200
    body = spec.json()
    assert body["openapi"].startswith("3.") and body["info"]["title"] == "EduCore API"
    assert "/api/v1/auth/login" in body["paths"] and "/health/ready" in body["paths"]
