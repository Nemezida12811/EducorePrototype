import re
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..errors import bad_request, conflict, forbidden, not_found
from ..models import (Course, CourseSession, CourseTeacher, Enrollment, EnrollmentStatus, ExamTerm, Role, SessionKind, now, CalendarEvent)
from ..schemas import HHMM, CamelModel
from ..security import Principal, authenticate, can_manage_course, is_course_teacher, require_roles
from ..services import audit
from .courses import load_course

settings = get_settings()
router = APIRouter(tags=["schedule"])


class SessionIn(CamelModel):
    kind: SessionKind
    day_of_week: int = Field(ge=1, le=7)
    start_time: str = Field(pattern=HHMM)
    end_time: str = Field(pattern=HHMM)
    room: str = Field(min_length=1, max_length=50)
    teacher_id: str | None = None

    @model_validator(mode="after")
    def _order(self):
        if self.end_time <= self.start_time: raise ValueError("endTime must be after startTime")
        return self


class ExamIn(CamelModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=HHMM)
    room: str = Field(min_length=1, max_length=50)
    format: Literal["written", "oral", "online", "practical"] = "written"
    term: int = Field(1, ge=1, le=5)
    capacity: int = Field(30, ge=1, le=5000)
    registration_open: bool = True


class ExamUpdate(CamelModel):
    date: str | None = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str | None = Field(None, pattern=HHMM)
    room: str | None = Field(None, min_length=1, max_length=50)
    format: Literal["written", "oral", "online", "practical"] | None = None
    term: int | None = Field(None, ge=1, le=5)
    capacity: int | None = Field(None, ge=1, le=5000)
    registration_open: bool | None = None


class EventIn(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    kind: str = Field("deadline", max_length=30)
    starts_at: datetime
    ends_at: datetime | None = None


def _utc_naive(d: datetime | None):
    return d.astimezone(None).replace(tzinfo=None) if d and d.tzinfo else d


def _sessions_for(db: Session, p: Principal) -> list[dict]:
    q = select(CourseSession, Course).join(Course, Course.id == CourseSession.course_id).where(Course.archived.is_(False))
    if p.role == Role.student:
        q = q.where(CourseSession.course_id.in_(select(Enrollment.course_id).where(Enrollment.student_id == p.user_id, Enrollment.status == EnrollmentStatus.enrolled)))
    elif p.role == Role.teacher:
        q = q.where(CourseSession.teacher_id == p.user_id)
    rows = db.execute(q.order_by(CourseSession.day_of_week, CourseSession.start_time)).all()
    return [{"id": s.id, "courseId": c.id, "courseCode": c.code, "courseName": c.name, "semester": c.semester.value, "kind": s.kind.value,
             "dayOfWeek": s.day_of_week, "startTime": s.start_time, "endTime": s.end_time, "room": s.room, "teacherId": s.teacher_id} for s, c in rows]


@router.get("/schedule/me")
def my_schedule(p: Principal = Depends(require_roles(Role.student, Role.teacher, Role.admin)), db: Session = Depends(get_db)):
    return {"items": _sessions_for(db, p)}


def _esc(s: str) -> str: return re.sub(r"([\\;,])", r"\\\1", s).replace("\n", "\\n")


def _fold(line: str) -> str:
    """RFC 5545 folding: only lines over the limit are split; continuation lines start with a space (headroom for multi-byte chars)."""
    if len(line) <= 70: return line
    return "\r\n".join([line[:70]] + [" " + line[i:i + 68] for i in range(70, len(line), 68)])


def _first_occurrence(start_iso: str, dow: int, hhmm: str) -> str:
    base = date.fromisoformat(start_iso)
    d = base + timedelta(days=(dow - base.isoweekday()) % 7)
    return f"{d:%Y%m%d}T{hhmm.replace(':', '')}00"


@router.get("/schedule/me/export")
def export_ics(p: Principal = Depends(require_roles(Role.student, Role.teacher)), db: Session = Depends(get_db)):
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EduCore//Schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:EduCore schedule"]
    stamp = now().strftime("%Y%m%dT%H%M%SZ")
    for s in _sessions_for(db, p):
        start = settings.semester_start_winter if s["semester"] == "winter" else settings.semester_start_summer
        lines += ["BEGIN:VEVENT", f"UID:{s['id']}@educore", f"DTSTAMP:{stamp}",
                  f"DTSTART;TZID={settings.timezone}:{_first_occurrence(start, s['dayOfWeek'], s['startTime'])}",
                  f"DTEND;TZID={settings.timezone}:{_first_occurrence(start, s['dayOfWeek'], s['endTime'])}",
                  f"RRULE:FREQ=WEEKLY;COUNT={settings.semester_weeks}", f"SUMMARY:{_esc(s['courseName'] + ' (' + s['kind'] + ')')}",
                  f"LOCATION:{_esc(s['room'])}", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return Response("\r\n".join(_fold(l) for l in lines) + "\r\n", media_type="text/calendar; charset=utf-8",
                    headers={"content-disposition": 'attachment; filename="schedule.ics"'})


# ---- academic calendar ----
@router.get("/calendar/events")
def list_events(from_: datetime | None = Query(None, alias="from"), to: datetime | None = None, _: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    q = select(CalendarEvent)
    if from_: q = q.where(CalendarEvent.starts_at >= _utc_naive(from_))
    if to: q = q.where(CalendarEvent.starts_at <= _utc_naive(to))
    return {"items": [e.d() for e in db.scalars(q.order_by(CalendarEvent.starts_at))]}


@router.post("/calendar/events", status_code=201)
def create_event(body: EventIn, request: Request, p: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    s, e = _utc_naive(body.starts_at), _utc_naive(body.ends_at)
    if e and e < s: raise bad_request("invalid_range", "endsAt must not be before startsAt")
    ev = CalendarEvent(title=body.title, kind=body.kind, starts_at=s, ends_at=e, created_by=p.user_id); db.add(ev); db.flush()
    audit(db, request, "calendar.create", "calendar_event", ev.id); db.commit()
    return ev.d()


@router.delete("/calendar/events/{event_id}", status_code=204)
def delete_event(event_id: str, _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    ev = db.get(CalendarEvent, event_id)
    if not ev: raise not_found("Event")
    db.delete(ev); db.commit()
    return Response(status_code=204)


# ---- timetable sessions ----
def _check_teacher(db: Session, course_id: str, teacher_id: str | None) -> None:
    if teacher_id and not is_course_teacher(db, teacher_id, course_id):
        raise bad_request("invalid_teacher", "The assigned teacher must teach this course")


@router.post("/courses/{course_id}/sessions", status_code=201)
def add_session(course_id: str, body: SessionIn, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    if not can_manage_course(db, p, course_id): raise forbidden()
    if load_course(db, course_id).archived: raise conflict("course_archived", "Archived courses are read-only")
    _check_teacher(db, course_id, body.teacher_id)
    s = CourseSession(course_id=course_id, **body.model_dump()); db.add(s); db.flush()
    audit(db, request, "session.create", "course", course_id, {"sessionId": s.id}); db.commit()
    return s.d()


@router.put("/sessions/{session_id}")
def update_session(session_id: str, body: dict, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    s = db.get(CourseSession, session_id)
    if not s: raise not_found("Session")
    if not can_manage_course(db, p, s.course_id): raise forbidden()
    cur = {"kind": s.kind, "day_of_week": s.day_of_week, "start_time": s.start_time, "end_time": s.end_time, "room": s.room, "teacher_id": s.teacher_id}
    merged = SessionIn.model_validate({**{k: v for k, v in cur.items()}, **body})  # validate the merged result
    _check_teacher(db, s.course_id, merged.teacher_id)
    for k, v in merged.model_dump().items(): setattr(s, k, v)
    audit(db, request, "session.update", "course", s.course_id, {"sessionId": session_id}); db.commit()
    return s.d()


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    s = db.get(CourseSession, session_id)
    if not s: raise not_found("Session")
    if not can_manage_course(db, p, s.course_id): raise forbidden()
    db.delete(s); audit(db, request, "session.delete", "course", s.course_id, {"sessionId": session_id}); db.commit()
    return Response(status_code=204)


# ---- exam terms ----
@router.get("/exams")
def list_exams(p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    q = select(ExamTerm, Course).join(Course, Course.id == ExamTerm.course_id)
    if p.role == Role.student:
        q = q.where(ExamTerm.course_id.in_(select(Enrollment.course_id).where(Enrollment.student_id == p.user_id, Enrollment.status == EnrollmentStatus.enrolled)))
    elif p.role == Role.teacher:
        q = q.where(ExamTerm.course_id.in_(select(CourseTeacher.course_id).where(CourseTeacher.user_id == p.user_id)))
    return {"items": [{**x.d(), "courseCode": c.code, "courseName": c.name} for x, c in db.execute(q.order_by(ExamTerm.date, ExamTerm.time))]}


@router.post("/courses/{course_id}/exams", status_code=201)
def add_exam(course_id: str, body: ExamIn, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    if not can_manage_course(db, p, course_id): raise forbidden()
    if load_course(db, course_id).archived: raise conflict("course_archived", "Archived courses are read-only")
    x = ExamTerm(course_id=course_id, **body.model_dump()); db.add(x); db.flush()
    audit(db, request, "exam.create", "course", course_id, {"examId": x.id}); db.commit()
    return x.d()


@router.put("/exams/{exam_id}")
def update_exam(exam_id: str, body: ExamUpdate, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    x = db.get(ExamTerm, exam_id)
    if not x: raise not_found("Exam term")
    if not can_manage_course(db, p, x.course_id): raise forbidden()
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(x, k, v)  # only sent fields change
    db.commit()
    return x.d()


@router.delete("/exams/{exam_id}", status_code=204)
def delete_exam(exam_id: str, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    x = db.get(ExamTerm, exam_id)
    if not x: raise not_found("Exam term")
    if not can_manage_course(db, p, x.course_id): raise forbidden()
    db.delete(x); audit(db, request, "exam.delete", "course", x.course_id, {"examId": exam_id}); db.commit()
    return Response(status_code=204)
