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


class TestExamRegistration:
    def test_register_cancel_and_visibility(self, api):
        c, _ = ids(api)
        exam = api.get("s1", "/exams").json()["items"][0]
        assert exam["courseCode"] == "ADS2" and exam["registered"] == 0 and exam["registeredByMe"] is False
        assert api.post("s1", f"/exams/{exam['id']}/registration").status_code == 201
        dup = api.post("s1", f"/exams/{exam['id']}/registration")
        assert dup.status_code == 409 and dup.json()["error"] == "already_registered"
        assert api.get("t1", "/exams").json()["items"][0]["registered"] == 1
        assert api.get("s1", "/exams").json()["items"][0]["registeredByMe"] is True
        assert api.delete("s1", f"/exams/{exam['id']}/registration").status_code == 204
        assert api.delete("s1", f"/exams/{exam['id']}/registration").status_code == 404

    def test_rules(self, api):
        c, _ = ids(api)
        ads2 = api.get("s1", "/exams").json()["items"][0]
        assert api.post("t1", f"/exams/{ads2['id']}/registration").status_code == 403  # students only
        # a second term that overlaps one the student already holds -> rejected
        db1 = api.post("t1", f"/courses/{c['ADS2']}/exams", {"date": ads2["date"], "time": "10:00", "room": "Hyperion", "capacity": 1, "term": 2})
        assert db1.status_code == 201
        assert api.post("s1", f"/exams/{ads2['id']}/registration").status_code == 201
        r = api.post("s1", f"/exams/{db1.json()['id']}/registration")
        assert r.status_code == 409 and r.json()["error"] == "exam_overlap"
        api.delete("s1", f"/exams/{ads2['id']}/registration")
        # closed registration and capacity
        api.put("t1", f"/exams/{db1.json()['id']}", {"registrationOpen": False})
        assert api.post("s1", f"/exams/{db1.json()['id']}/registration").json()["error"] == "registration_closed"


class TestAnnouncementReadState:
    def test_read_unread_and_read_all(self, api):
        first = api.get("s1", "/announcements").json()
        assert first["unreadCount"] == 1 and first["items"][0]["read"] is False
        aid = first["items"][0]["id"]
        assert api.put("s1", f"/announcements/{aid}/read").status_code == 204
        assert api.get("s1", "/announcements").json()["unreadCount"] == 0
        assert api.delete("s1", f"/announcements/{aid}/read").status_code == 204
        assert api.get("s1", "/announcements").json()["unreadCount"] == 1
        assert api.post("s1", "/announcements/read-all").status_code == 204
        assert api.get("s1", "/announcements").json()["unreadCount"] == 0
        assert api.get("t1", "/announcements").json()["items"][0]["read"] is True  # the author never sees their own as unread
        assert api.put("s1", "/announcements/does-not-exist/read").status_code == 404


class TestMiscAdditions:
    def test_teacher_directory_is_open_to_students(self, api):
        r = api.get("s1", "/teachers")
        assert r.status_code == 200 and {t["lastName"] for t in r.json()["items"]} == {"Novák", "Kováčová"}

    def test_mark_scale_matches_frontend(self):
        from app.services import mark_for
        assert [mark_for(x) for x in (100, 93, 92, 85, 84, 77, 76, 69, 68, 61, 60, 0)] == ["A", "A", "B", "B", "C", "C", "D", "D", "E", "E", "FX", "FX"]

    def test_program_student_counts(self, api):
        prog = api.get("admin", "/study-programs").json()["items"][0]
        assert prog["students"] >= 1


class TestSessions:
    def test_update_accepts_camel_case_and_detects_clashes(self, api):
        c, _ = ids(api)
        detail = api.get("t1", f"/courses/{c['ADS2']}").json()
        lecture = next(s for s in detail["sessions"] if s["kind"] == "lecture")
        r = api.put("t1", f"/sessions/{lecture['id']}", {"room": "Romulus", "startTime": "09:10"})
        assert r.status_code == 200 and (r.json()["room"], r.json()["startTime"], r.json()["dayOfWeek"]) == ("Romulus", "09:10", 1)
        # DB1's Tuesday lecture is in Hyperion: another course may not take that room at the same time
        bad = api.post("t1", f"/courses/{c['ADS2']}/sessions", {"kind": "practical", "dayOfWeek": 2, "startTime": "11:30", "endTime": "12:30", "room": "hyperion"})
        assert bad.status_code == 409 and bad.json()["error"] == "room_clash"
        t1_id = detail["teachers"][0]["id"]
        also = api.post("t1", f"/courses/{c['ADS2']}/sessions", {"kind": "practical", "dayOfWeek": 1, "startTime": "10:00", "endTime": "11:00", "room": "Aurora", "teacherId": t1_id})
        assert also.status_code == 409 and also.json()["error"] == "teacher_clash"  # still teaching the (shifted) lecture
        assert api.get("t1", "/schedule/all").status_code == 200 and api.get("s1", "/schedule/all").status_code == 403

    def test_institution_name_for_everyone(self, api):
        assert api.get("s1", "/institution").json()["name"] == "EduCore University"


class TestGradingMinimums:
    def test_component_minimum_fails_the_course(self, api):
        scheme = [{"name": "Labs 1", "maxPoints": 50, "minPoints": 0}, {"name": "Exam", "maxPoints": 50, "minPoints": 20}]
        r = api.post("t1", "/courses", {"code": "MINX", "name": "Minimums", "academicYear": "2026/2027", "semester": "winter", "gradingScheme": scheme})
        assert r.status_code == 201 and r.json()["gradingScheme"][1]["minPoints"] == 20
        cid = r.json()["id"]
        assert api.post("s1", "/enrollments", {"courseId": cid}).status_code == 201
        s1 = ids(api)[1]["student1@educore.example"]
        g = api.post("t1", "/grades", {"courseId": cid, "studentId": s1, "components": {"Labs 1": 50, "Exam": 15}}).json()
        assert g["finalScore"] == 65 and g["mark"] == "FX"  # 65 would be a D, but the exam is below its minimum
        g = api.post("t1", "/grades", {"courseId": cid, "studentId": s1, "components": {"Exam": 25}}).json()
        assert g["finalScore"] == 75 and g["mark"] == "D"

    def test_minimum_cannot_exceed_maximum(self, api):
        bad = [{"name": "A", "maxPoints": 40, "minPoints": 50}, {"name": "B", "maxPoints": 60}]
        r = api.post("t1", "/courses", {"code": "MINBAD", "name": "Bad", "academicYear": "2026/2027", "semester": "winter", "gradingScheme": bad})
        assert r.status_code == 400
        many = [{"name": f"Lab {i}", "maxPoints": 4} for i in range(1, 26)]  # 25 works x 4 = 100
        assert api.post("t1", "/courses", {"code": "MANY", "name": "Many", "academicYear": "2026/2027", "semester": "winter", "gradingScheme": many}).status_code == 201


def dept_ids(api):
    return {d["code"]: d["id"] for d in api.get("admin", "/departments").json()["items"]}


class TestRooms:
    def test_admin_manages_rooms_for_several_departments(self, api):
        d = dept_ids(api)
        kemt = api.post("admin", "/departments", {"code": "KEMT", "name": "Electronics"}).json()["id"]
        body = {"code": "N-1", "building": "N", "kind": "lab", "capacity": 20, "departmentIds": [d["KPI"], kemt]}
        assert api.post("t1", "/rooms", body).status_code == 403 and api.post("s1", "/rooms", body).status_code == 403
        r = api.post("admin", "/rooms", body)
        assert r.status_code == 201 and sorted(r.json()["departmentIds"]) == sorted([d["KPI"], kemt]) and r.json()["sessionCount"] == 0
        assert api.post("admin", "/rooms", {**body, "code": "n-1"}).json()["error"] == "room_code_taken"  # case-insensitive
        assert api.post("admin", "/rooms", {**body, "code": "N-2", "departmentIds": []}).status_code == 400  # must belong to a department
        assert api.post("admin", "/rooms", {**body, "code": "N-3", "departmentIds": ["nope"]}).json()["error"] == "invalid_departments"
        # everybody can read the registry, filtered by department, kind and size
        only_kemt = api.get("s1", f"/rooms?departmentId={kemt}").json()["items"]
        assert [x["code"] for x in only_kemt] == ["N-1"]
        assert "N-1" in [x["code"] for x in api.get("t1", "/rooms?kind=lab&minCapacity=20").json()["items"]]
        assert "N-1" not in [x["code"] for x in api.get("t1", "/rooms?minCapacity=500").json()["items"]]
        upd = api.put("admin", f"/rooms/{r.json()['id']}", {"capacity": 25, "departmentIds": [kemt]}).json()
        assert upd["capacity"] == 25 and upd["departmentIds"] == [kemt]
        assert api.delete("admin", f"/rooms/{r.json()['id']}").status_code == 204

    def test_sessions_need_a_registered_room_of_the_courses_department(self, api):
        c, _ = ids(api)
        d = dept_ids(api)
        api.post("admin", "/rooms", {"code": "K-1", "kind": "classroom", "capacity": 10, "departmentIds": [dept_ids(api)["KEMT"]]})
        mk = lambda code, dept: api.post("t1", "/courses", {"code": code, "name": code, "academicYear": "2026/2027", "semester": "summer", "departmentId": dept,
                                                              "gradingScheme": [{"name": "A", "maxPoints": 100}]}).json()["id"]
        kpi_course = mk("RMK1", d["KPI"])
        sess = lambda room, day=3: api.post("t1", f"/courses/{kpi_course}/sessions", {"kind": "lecture", "dayOfWeek": day, "startTime": "08:00", "endTime": "09:00", "room": room})
        assert sess("Nowhere").json()["error"] == "unknown_room"
        assert sess("K-1").json()["error"] == "room_not_available"  # K-1 belongs to KEMT only
        ok = sess("aurora")
        assert ok.status_code == 201 and ok.json()["room"] == "Aurora"  # stored with the registered spelling
        free_dept = mk("RMK2", None)  # a course without a department may use any room
        assert api.post("t1", f"/courses/{free_dept}/sessions", {"kind": "lecture", "dayOfWeek": 4, "startTime": "08:00", "endTime": "09:00", "room": "K-1"}).status_code == 201
        # deactivated rooms cannot be booked and deleting a used room is refused
        b102 = next(x for x in api.get("admin", "/rooms").json()["items"] if x["code"] == "Aurora")
        assert b102["sessionCount"] >= 1 and api.delete("admin", f"/rooms/{b102['id']}").json()["error"] == "room_in_use"
        api.put("admin", f"/rooms/{b102['id']}", {"active": False})
        assert sess("Aurora", day=5).json()["error"] == "room_inactive"
        assert "Aurora" not in [x["code"] for x in api.get("t1", "/rooms").json()["items"]]  # inactive rooms are hidden by default
        api.put("admin", f"/rooms/{b102['id']}", {"active": True, "code": "AuroraX"})  # renaming keeps timetables intact
        assert api.get("t1", f"/courses/{kpi_course}").json()["sessions"][0]["room"] == "AuroraX"
        api.put("admin", f"/rooms/{b102['id']}", {"code": "Aurora"})


class TestDrafts:
    def _course(self, api, code, **extra):
        r = api.post("t1", "/courses", {"code": code, "name": code, "academicYear": "2026/2027", "semester": "winter",
                                        "gradingScheme": [{"name": "A", "maxPoints": 100}], **extra})
        assert r.status_code == 201, r.text
        return r.json()

    def test_drafts_are_hidden_from_students_until_published(self, api):
        c = self._course(api, "DRF1", status="draft")
        assert c["status"] == "draft"
        assert "DRF1" not in [x["code"] for x in api.get("s1", "/courses?pageSize=100").json()["items"]]
        assert api.get("s1", f"/courses/{c['id']}").status_code == 404
        assert api.post("s1", "/enrollments", {"courseId": c["id"]}).status_code == 404
        assert "DRF1" in [x["code"] for x in api.get("t1", "/courses?pageSize=100").json()["items"]]
        assert "DRF1" not in [x["code"] for x in api.get("t2", "/courses?pageSize=100").json()["items"]]  # another teacher does not see it
        assert api.get("admin", f"/courses/{c['id']}").status_code == 200
        assert api.put("t1", f"/courses/{c['id']}", {"status": "published"}).json()["status"] == "published"
        assert api.post("s1", "/enrollments", {"courseId": c["id"]}).status_code == 201
        back = api.put("t1", f"/courses/{c['id']}", {"status": "draft"})
        assert back.status_code == 409 and back.json()["error"] == "has_enrollments"

    def test_enrollment_has_no_date_window(self, api):
        # enrollment is always open for a published course, and the old date fields no longer exist
        bad = api.post("t1", "/courses", {"code": "OPEN0", "name": "x", "academicYear": "2026/2027", "semester": "winter", "gradingScheme": [{"name": "A", "maxPoints": 100}],
                                           "enrollmentOpensAt": "2999-01-01T00:00:00Z"})
        assert bad.status_code == 400
        c = self._course(api, "OPEN1")
        assert "enrollmentOpensAt" not in c and api.post("s1", "/enrollments", {"courseId": c["id"]}).status_code == 201


def test_schema_upgrade_adds_new_columns_to_an_old_database():
    from sqlalchemy import create_engine, inspect
    from app.db import Base, upgrade_schema
    old = create_engine("sqlite://")
    with old.begin() as conn:
        conn.exec_driver_sql("CREATE TABLE courses (id VARCHAR(36) PRIMARY KEY, code VARCHAR(30))")
        conn.exec_driver_sql("INSERT INTO courses VALUES ('c1', 'OLD1')")
    Base.metadata.create_all(old)  # creates the missing tables, leaves the old courses table alone
    upgrade_schema(old)
    cols = {c["name"] for c in inspect(old).get_columns("courses")}
    assert {"status", "group_count"} <= cols
    with old.connect() as conn:
        assert conn.exec_driver_sql("SELECT status FROM courses WHERE id = 'c1'").scalar() == "published"  # existing courses stay published
        assert conn.exec_driver_sql("SELECT group_count FROM courses WHERE id = 'c1'").scalar() == 1  # and have a single group
