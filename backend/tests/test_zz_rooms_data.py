"""Runs after test_api.py on the same database: puts the institution's rooms in place and moves old timetables onto them."""
from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Course, CourseSession, ExamTerm, Room
from app.rooms_data import ROOMS
from app.seed_rooms import ensure_rooms, remap


def test_rooms_are_added_and_timetables_remapped(api):
    with SessionLocal() as db:
        db.add(Room(code="B-999", building="B", kind="classroom", capacity=10)); db.commit()  # a leftover old demo-style room, unused
        s = db.scalars(select(CourseSession)).first()
        s.room = "Old room nobody registered"; db.commit()
        result = remap(db)
        assert result["unresolved"] == 0 and result["sessions_moved"] >= 1
        assert {r.code for r in db.scalars(select(Room))} >= {code for code, _k, _c in ROOMS}
        allowed = {code.lower() for code, _k, _c in ROOMS}
        assert all(x.room.lower() in allowed for x in db.scalars(select(CourseSession)))
        assert all(x.room.lower() in allowed for x in db.scalars(select(ExamTerm)))
        # no two live sessions share a room at overlapping times
        live = db.execute(select(CourseSession, Course.semester).join(Course, Course.id == CourseSession.course_id).where(Course.archived.is_(False))).all()
        for i, (a, sa) in enumerate(live):
            for b, sb in live[i + 1:]:
                assert not (sa == sb and a.day_of_week == b.day_of_week and a.room.lower() == b.room.lower() and a.start_time < b.end_time and b.start_time < a.end_time)
        # online rooms are never picked automatically; repeating the command changes nothing
        assert not any(x.room in ("Virtual, Webex", "Zasadačka online") for x in db.scalars(select(CourseSession)))
        assert remap(db)["sessions_moved"] == 0
        ensure_rooms(db); db.commit()
        assert db.scalar(select(func.count()).select_from(Room).where(Room.code == "Meridian")) == 1  # no duplicates
