import hashlib
import hmac
import time

import pyotp
PW = "ChangeMe!12345"


def ids(api):
    courses = {c["code"]: c["id"] for c in api.get("admin", "/courses?archived=all").json()["items"]}
    users = {u["email"]: u["id"] for u in api.get("admin", "/users?pageSize=100").json()["items"]}
    return courses, users


class TestAuth:
    def test_bad_credentials_and_anonymous(self, client):
        assert client.post("/api/v1/auth/login", json={"email": "student1@educore.example", "password": "wrong-password-123"}).status_code == 401
        assert client.get("/api/v1/courses").status_code == 401

    def test_roles(self, api):
        assert api.get("s1", "/users").status_code == 403
        assert api.get("admin", "/users").status_code == 200
        assert api.get("admin", "/reports/platform/usage").status_code == 403
        assert api.get("super", "/reports/platform/usage").status_code == 200

    def test_refresh_rotation_and_reuse_detection(self, api, client):
        old = api.refresh["s3"]
        r1 = client.post("/api/v1/auth/refresh", json={"refreshToken": old}); assert r1.status_code == 200
        assert client.post("/api/v1/auth/refresh", json={"refreshToken": old}).status_code == 401  # reuse
        assert client.post("/api/v1/auth/refresh", json={"refreshToken": r1.json()["refreshToken"]}).status_code == 401  # family revoked

    def test_totp_two_factor(self, api, client):
        start = api.post("s1", "/auth/2fa/enable", {}).json()
        assert api.post("s1", "/auth/2fa/enable", {"code": pyotp.TOTP(start["secret"]).now()}).status_code == 200
        l = client.post("/api/v1/auth/login", json={"email": "student1@educore.example", "password": PW}).json()
        assert l["twoFactorRequired"] is True
        v = client.post("/api/v1/auth/2fa/verify", json={"challengeToken": l["challengeToken"], "code": pyotp.TOTP(start["secret"]).now()})
        assert v.status_code == 200 and v.json()["accessToken"]
        assert client.post("/api/v1/auth/2fa/verify", json={"challengeToken": l["challengeToken"], "code": "000000"}).status_code == 401

    def test_challenge_token_is_not_an_access_token(self, client):
        l = client.post("/api/v1/auth/login", json={"email": "student1@educore.example", "password": PW}).json()
        assert client.get("/api/v1/users/me", headers={"authorization": f"Bearer {l['challengeToken']}"}).status_code == 401


class TestCourses:
    def test_put_does_not_reset_unspecified_fields(self, api):
        c, _ = ids(api)
        before = api.get("t1", f"/courses/{c['ADS2']}").json()
        r = api.put("t1", f"/courses/{c['ADS2']}", {"description": "Updated"})
        assert r.status_code == 200
        assert (r.json()["credits"], r.json()["capacity"], r.json()["syllabus"]) == (before["credits"], before["capacity"], before["syllabus"])

    def test_only_course_teachers_may_edit(self, api):
        c, _ = ids(api)
        assert api.put("t2", f"/courses/{c['ADS2']}", {"description": "hijack"}).status_code == 403

    def test_scheme_must_sum_to_100(self, api):
        r = api.post("t1", "/courses", {"code": "X1", "name": "X", "academicYear": "2026/2027", "semester": "winter", "gradingScheme": [{"name": "A", "maxPoints": 50}]})
        assert r.status_code == 400 and r.json()["error"] == "validation_error"

    def test_create_course_as_teacher(self, api):
        r = api.post("t1", "/courses", {"code": "NEW1", "name": "New", "academicYear": "2026/2027", "semester": "summer",
                                        "gradingScheme": [{"name": "Exam", "maxPoints": 100}]})
        assert r.status_code == 201 and r.json()["credits"] == 5 and r.json()["capacity"] == 30  # create-time defaults


class TestEnrollment:
    def test_prerequisites_enforced(self, api):
        c, _ = ids(api)
        r = api.post("s3", "/enrollments", {"courseId": c["ADS2"]})
        assert r.status_code == 409 and r.json()["error"] == "prerequisites_missing"

    def test_waitlist_promotion(self, api):
        c, _ = ids(api)
        assert len(api.get("t2", f"/courses/{c['DB1']}/waitlist").json()["items"]) == 1
        mine = {e["code"]: e["id"] for e in api.get("s1", "/enrollments/me").json()["items"]}
        assert api.delete("s1", f"/enrollments/{mine['DB1']}").status_code == 204
        assert api.get("t2", f"/courses/{c['DB1']}/waitlist").json()["items"] == []
        s3 = {e["code"]: e["status"] for e in api.get("s3", "/enrollments/me").json()["items"]}
        assert s3["DB1"] == "enrolled"
        assert api.get("s3", "/notifications").json()["unreadCount"] >= 1  # promotion notified the student

    def test_capacity_is_never_oversold(self, api):
        c, _ = ids(api)
        s = api.get("admin", f"/courses/{c['DB1']}").json()
        assert s["enrolledCount"] <= s["capacity"]


class TestGrades:
    def test_final_score_history_and_marks(self, api):
        c, u = ids(api)
        s2 = u["student2@educore.example"]
        a = api.post("t1", "/grades", {"courseId": c["ADS2"], "studentId": s2, "components": {"Midterm": 25, "Project": 28}})
        assert a.status_code == 200 and a.json()["finalScore"] is None
        b = api.post("t1", "/grades", {"courseId": c["ADS2"], "studentId": s2, "components": {"Exam": 36}})
        assert (b.json()["finalScore"], b.json()["mark"]) == (89, "B")
        assert len(api.get("t1", f"/grades/{b.json()['id']}/history").json()["items"]) == 2

    def test_validation_and_permissions(self, api):
        c, u = ids(api)
        s2 = u["student2@educore.example"]
        assert api.post("t1", "/grades", {"courseId": c["ADS2"], "studentId": s2, "components": {"Midterm": 31}}).status_code == 400
        assert api.post("t1", "/grades", {"courseId": c["ADS2"], "studentId": s2, "components": {"Nope": 1}}).status_code == 400
        assert api.post("t2", "/grades", {"courseId": c["ADS2"], "studentId": s2, "components": {"Midterm": 10}}).status_code == 403
        assert api.post("admin", "/grades", {"courseId": c["ADS2"], "studentId": s2, "components": {"Midterm": 10}}).status_code == 403
        assert api.post("t1", "/grades", {"courseId": c["OOP"], "studentId": s2, "components": {"Midterm": 10}}).status_code in (400, 409)  # archived

    def test_scheme_locked_after_grades(self, api):
        c, _ = ids(api)
        r = api.put("t1", f"/courses/{c['ADS2']}", {"gradingScheme": [{"name": "Only", "maxPoints": 100}]})
        assert r.status_code == 409 and r.json()["error"] == "scheme_locked"

    def test_student_views_and_pdf(self, api):
        c, _ = ids(api)
        g = api.get("s1", "/grades/me").json()
        assert g["summary"]["creditsEarned"] == 5
        pdf = api.get("s1", "/grades/me/transcript")
        assert pdf.headers["content-type"] == "application/pdf" and pdf.content[:5] == b"%PDF-"
        cert = api.post("s1", "/documents/transcript-request")
        assert cert.content[:5] == b"%PDF-"
        assert api.get("s1", f"/grades/course/{c['ADS2']}").status_code == 403


class TestMisc:
    def test_ical_export_is_wellformed(self, api):
        r = api.get("t1", "/schedule/me/export")
        assert "text/calendar" in r.headers["content-type"]
        lines = r.text.split("\r\n")
        assert lines[0] == "BEGIN:VCALENDAR" and "RRULE:FREQ=WEEKLY;COUNT=13" in lines
        assert all(len(l) <= 75 for l in lines)
        assert not any(l.startswith("END:VEVEN") and len(l) < 10 for l in lines)  # regression: no corrupted folding
        assert "END:VEVENT" in lines

    def test_admin_cannot_demote_self_and_audit_trail(self, api):
        me = api.get("admin", "/users/me").json()
        assert api.put("admin", f"/users/{me['id']}", {"role": "student"}).status_code == 400
        assert api.get("admin", "/audit-log?action=grade").json()["total"] > 0

    def test_api_keys_are_read_only(self, api, client):
        k = api.post("admin", "/integrations/api-keys", {"name": "reporting"}).json()
        assert client.get("/api/v1/reports/institution/overview", headers={"x-api-key": k["apiKey"]}).status_code == 200
        r = client.post("/api/v1/calendar/events", headers={"x-api-key": k["apiKey"]}, json={"title": "x", "startsAt": "2026-10-01T10:00:00Z"})
        assert r.status_code == 403
        assert api.delete("admin", f"/integrations/api-keys/{k['id']}").status_code == 204
        assert client.get("/api/v1/reports/institution/overview", headers={"x-api-key": k["apiKey"]}).status_code == 401

    def test_exports(self, api):
        assert "occupancyPct" in api.get("admin", "/reports/export?report=occupancy&format=csv").text
        x = api.get("admin", "/reports/export?report=occupancy&format=xlsx")
        assert x.content[:2] == b"PK"

    def test_pdf_upload_validation(self, api):
        c, _ = ids(api)
        ok = api.c.post(f"/api/v1/courses/{c['ADS2']}/documents?kind=syllabus", headers=api.h("t1"), files={"file": ("syl.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")})
        assert ok.status_code == 201
        bad = api.c.post(f"/api/v1/courses/{c['ADS2']}/documents", headers=api.h("t1"), files={"file": ("x.pdf", b"not a pdf", "application/pdf")})
        assert bad.status_code == 400
        # syllabus is public to any signed-in user; materials are not
        assert api.get("s3", f"/files/{ok.json()['fileId']}").status_code == 200

    def test_signed_billing_webhook(self, api, client):
        body = b'{"type":"invoice.paid","data":{"object":{"id":"in_1","number":"INV-1","amount_paid":4900,"currency":"eur","status":"paid"}}}'
        t = str(int(time.time()))
        sig = hmac.new(b"whsec_test", t.encode() + b"." + body, hashlib.sha256).hexdigest()
        assert client.post("/api/v1/billing/webhook", content=body, headers={"stripe-signature": "t=1,v1=abc"}).status_code == 401
        assert client.post("/api/v1/billing/webhook", content=body, headers={"stripe-signature": f"t={t},v1={sig}"}).status_code == 200
        assert api.get("admin", "/billing/invoices").json()["items"][0]["amountCents"] == 4900

    def test_webhook_ssrf_guard(self, api):
        assert api.post("admin", "/integrations/webhooks", {"url": "https://169.254.169.254/latest"}).status_code == 400
        assert api.post("admin", "/integrations/webhooks", {"url": "http://example.com/hook"}).status_code == 400

    def test_gdpr_export_and_anonymize(self, api):
        exp = api.get("s1", "/users/me/export").json()
        assert exp["profile"]["email"] == "student1@educore.example" and "passwordHash" not in exp["profile"]
        _, u = ids(api)
        assert api.delete("admin", f"/users/{u['student3@educore.example']}?mode=anonymize").status_code == 204
        assert api.get("admin", "/users?q=anonymized").json()["total"] == 1

    def test_study_plan_and_single_institution(self, api):
        plan = api.get("s1", "/study-plan/me").json()
        assert {i["code"]: i["status"] for i in plan["items"]}["OOP"] == "passed"
        inst = api.get("super", "/institutions").json()["items"]
        assert len(inst) == 1
        assert api.post("super", "/institutions", {}).status_code == 409
