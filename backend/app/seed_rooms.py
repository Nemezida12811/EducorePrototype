"""python -m app.seed_rooms [--remap]

Adds the institution's rooms (app/rooms_data.py) to the database, each belonging to every existing department. Safe to repeat.
With --remap it also moves every timetable entry and exam term onto these rooms (clash-free: each session gets the smallest suitable room that still holds its enrolled students)
and deletes the old demo rooms that nothing uses any more.
"""
import argparse

from sqlalchemy import func, select

from .db import Base, SessionLocal, engine, upgrade_schema
from .models import Course, CourseSession, Department, Enrollment, EnrollmentStatus, ExamRegistration, ExamTerm, Room, RoomDepartment, RoomKind
from .rooms_data import OLD_DEMO_CODES, ROOMS


def ensure_rooms(db) -> list[Room]:
    deps = list(db.scalars(select(Department)))
    out = []
    for code, kind, cap in ROOMS:
        room = db.scalars(select(Room).where(func.lower(Room.code) == code.lower())).first()
        if not room:
            room = Room(code=code, building="", kind=kind, capacity=cap); db.add(room); db.flush()
        room.active = True
        linked = set(db.scalars(select(RoomDepartment.department_id).where(RoomDepartment.room_id == room.id)))
        for d in deps:
            if d.id not in linked: db.add(RoomDepartment(room_id=room.id, department_id=d.id))
        out.append(room)
    db.flush()
    return out


def _minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def remap(db) -> dict[str, int]:
    pool = ensure_rooms(db)
    physical = [r for r in pool if r.kind != RoomKind.online]
    codes = {r.code.lower() for r in pool}
    booked: list[tuple[str, int, str, str, str]] = []  # semester, day, start, end, room code (live courses only)
    moved = unresolved = 0
    enrolled: dict[str, int] = {}
    in_group: dict[tuple[str, int], int] = {}
    for cid, g, n in db.execute(select(Enrollment.course_id, Enrollment.group_no, func.count()).where(Enrollment.status == EnrollmentStatus.enrolled)
                                .group_by(Enrollment.course_id, Enrollment.group_no)):
        enrolled[cid] = enrolled.get(cid, 0) + n
        if g: in_group[(cid, g)] = n
    rows = db.execute(select(CourseSession, Course).join(Course, Course.id == CourseSession.course_id)
                      .order_by(Course.archived, Course.semester, CourseSession.day_of_week, CourseSession.start_time, Course.code)).all()
    for s, c in rows:
        # seats needed: the enrolled students (of the session's group, if it has one); a course nobody joined yet is sized by its limit
        if enrolled.get(c.id):
            need = in_group.get((c.id, s.group_no), 0) if s.group_no else enrolled[c.id]
        else:
            need = -(-c.capacity // (c.group_count if s.group_no else 1))
        suitable = [r for r in physical if (r.kind == RoomKind.lab) == (s.kind.value == "lab")]
        tiers = [[r for r in suitable if r.capacity >= need], [r for r in physical if r.capacity >= need]]
        sem = c.semester.value

        def free(r: Room) -> bool:
            return c.archived or not any(b[0] == sem and b[1] == s.day_of_week and b[2] < s.end_time and s.start_time < b[3] and b[4] == r.code.lower() for b in booked)
        chosen = None
        for tier in tiers:  # smallest room first: seats are not wasted on small groups
            chosen = next((r for r in sorted(tier, key=lambda r: (r.capacity, r.code)) if free(r)), None)
            if chosen: break
        if not chosen:  # nothing big enough is free: take the biggest free room and report it
            chosen = next((r for r in sorted(physical, key=lambda r: (-r.capacity, r.code)) if free(r)), None)
            unresolved += 1
        if not chosen: continue
        if s.room != chosen.code: moved += 1
        s.room = chosen.code
        if not c.archived: booked.append((sem, s.day_of_week, s.start_time, s.end_time, chosen.code.lower()))
    # exam terms: halls and classrooms with enough seats, no two exams in one room within two hours
    exams: list[tuple[str, str, str]] = []
    exam_moved = 0
    regs = dict(db.execute(select(ExamRegistration.exam_id, func.count()).group_by(ExamRegistration.exam_id)).all())
    for x in db.scalars(select(ExamTerm).order_by(ExamTerm.date, ExamTerm.time)):
        need = regs.get(x.id) or x.capacity
        cands = sorted([r for r in physical if r.kind != RoomKind.lab and r.capacity >= need] or [r for r in physical if r.kind != RoomKind.lab],
                       key=lambda r: (r.capacity, r.code))
        ok = lambda r: not any(e[0] == x.date and e[2] == r.code.lower() and abs(_minutes(e[1]) - _minutes(x.time)) < 120 for e in exams)
        r = next((r for r in cands if ok(r)), None)  # smallest free room that holds the registered students
        if not r: unresolved += 1; continue
        if x.room != r.code: exam_moved += 1
        x.room = r.code; exams.append((x.date, x.time, r.code.lower()))
    db.flush()
    removed = 0
    for old in db.scalars(select(Room).where(Room.code.in_(OLD_DEMO_CODES))):
        if old.code.lower() in codes: continue
        if not db.scalar(select(func.count()).select_from(CourseSession).where(func.lower(CourseSession.room) == old.code.lower())):
            db.delete(old); removed += 1
    db.commit()
    return {"sessions_moved": moved, "exams_moved": exam_moved, "old_rooms_removed": removed, "unresolved": unresolved}


if __name__ == "__main__":
    from . import models  # noqa: F401
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--remap", action="store_true", help="move timetable entries and exam terms onto the new rooms")
    a = ap.parse_args()
    Base.metadata.create_all(engine); upgrade_schema()
    with SessionLocal() as s:
        if a.remap: print(remap(s))
        else:
            ensure_rooms(s); s.commit(); print(f"{len(ROOMS)} rooms are in place.")
