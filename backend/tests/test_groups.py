class TestGroups:
    def _course(self, api, code, groups):
        r = api.post("t1", "/courses", {"code": code, "name": code, "academicYear": "2026/2027", "semester": "summer", "groupCount": groups,
                                        "gradingScheme": [{"name": "A", "maxPoints": 100}]})
        assert r.status_code == 201, r.text
        return r.json()

    def _session(self, api, cid, room, group, day, start="08:00", end="09:00"):
        return api.post("t1", f"/courses/{cid}/sessions", {"kind": "practical", "dayOfWeek": day, "startTime": start, "endTime": end, "room": room, "groupNo": group})

    def test_sessions_belong_to_a_group_or_to_all(self, api):
        c = self._course(api, "GRP1", 2)
        assert c["groupCount"] == 2
        assert self._session(api, c["id"], "Hyperion", 3, 1).json()["error"] == "invalid_group"  # only 2 groups
        lecture = api.post("t1", f"/courses/{c['id']}/sessions", {"kind": "lecture", "dayOfWeek": 1, "startTime": "10:00", "endTime": "11:00", "room": "Meridian"})
        assert lecture.status_code == 201 and lecture.json()["groupNo"] is None  # all groups
        assert self._session(api, c["id"], "Aurora", 1, 2).json()["groupNo"] == 1
        assert self._session(api, c["id"], "Romulus", 2, 2).json()["groupNo"] == 2  # same time, other group, other room
        clash = self._session(api, c["id"], "Aurora", 2, 2)
        assert clash.status_code == 409 and clash.json()["error"] == "room_clash"  # groups do not share a room
        # lowering the group count below a group that still has sessions is refused; raising and lowering otherwise works
        low = api.put("t1", f"/courses/{c['id']}", {"groupCount": 1})
        assert low.status_code == 409 and low.json()["error"] == "groups_in_use"
        assert api.put("t1", f"/courses/{c['id']}", {"groupCount": 3}).json()["groupCount"] == 3

    def test_students_are_balanced_and_see_their_own_group_only(self, api):
        c = self._course(api, "GRP2", 2)
        api.post("t1", f"/courses/{c['id']}/sessions", {"kind": "lecture", "dayOfWeek": 4, "startTime": "08:00", "endTime": "09:00", "room": "Meridian"})
        g1 = self._session(api, c["id"], "Aurora", 1, 5).json()
        g2 = self._session(api, c["id"], "Romulus", 2, 5).json()
        # the semester filter is irrelevant here: /schedule/me lists sessions of non-archived courses
        e1 = api.post("s1", "/enrollments", {"courseId": c["id"]}).json()
        assert e1["groupNo"] == 1  # the first student goes to the emptiest group (lowest number on a tie)
        mine = {s["id"] for s in api.get("s1", "/schedule/me").json()["items"] if s["courseId"] == c["id"]}
        assert g1["id"] in mine and g2["id"] not in mine and len(mine) == 2  # the lecture (all groups) + own group's practical
        assert api.get("t1", "/schedule/me").json()["items"]  # teachers see everything they teach
        roster = api.get("t1", f"/grades/course/{c['id']}").json()
        assert roster["groupCount"] == 2 and roster["items"][0]["group"] == 1 and roster["items"][0]["enrollmentId"] == e1["id"]
        # a teacher moves the student; the student's schedule follows
        assert api.put("t1", f"/enrollments/{e1['id']}/group", {"group": 2}).status_code == 200
        mine = {s["id"] for s in api.get("s1", "/schedule/me").json()["items"] if s["courseId"] == c["id"]}
        assert g2["id"] in mine and g1["id"] not in mine
        assert api.put("t1", f"/enrollments/{e1['id']}/group", {"group": 5}).json()["error"] == "invalid_group"
        assert api.put("s1", f"/enrollments/{e1['id']}/group", {"group": 1}).status_code == 403  # students cannot move themselves
        # more groups later: students without a valid group are spread out
        assert api.put("t1", f"/courses/{c['id']}", {"groupCount": 1}).json()["error"] == "groups_in_use"
