from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import forbidden, not_found
from ..models import Announcement, Course, CourseTeacher, Enrollment, EnrollmentStatus, Notification, Role, User, now
from ..schemas import CamelModel
from ..security import Principal, authenticate, can_manage_course, require_roles, role_allowed
from ..services import Page, audit, emit, notify_users

router = APIRouter(tags=["notices"])


class AnnouncementIn(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10_000)
    course_id: str | None = None


class ChannelsIn(CamelModel):
    email: bool
    in_app: bool
    push: bool


@router.get("/announcements")
def list_announcements(page: Page = Depends(), course_id: str | None = Query(None, alias="courseId"),
                       p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    conds = []
    if not role_allowed(p.role, [Role.admin]):
        ids = (select(Enrollment.course_id).where(Enrollment.student_id == p.user_id, Enrollment.status == EnrollmentStatus.enrolled)
               if p.role == Role.student else select(CourseTeacher.course_id).where(CourseTeacher.user_id == p.user_id))
        conds.append(or_(Announcement.course_id.is_(None), Announcement.course_id.in_(ids)))
    if course_id: conds.append(Announcement.course_id == course_id)
    total = db.scalar(select(func.count()).select_from(Announcement).where(*conds))
    rows = db.execute(select(Announcement, Course.name, User.last_name).outerjoin(Course, Course.id == Announcement.course_id)
                      .outerjoin(User, User.id == Announcement.author_id).where(*conds).order_by(Announcement.created_at.desc())
                      .limit(page.page_size).offset(page.offset)).all()
    return page.wrap([{**a.d(), "courseName": cn, "authorName": an} for a, cn, an in rows], total)


@router.post("/announcements", status_code=201)
def publish(body: AnnouncementIn, request: Request, p: Principal = Depends(require_roles(Role.teacher, Role.admin)), db: Session = Depends(get_db)):
    if p.role == Role.teacher and not body.course_id: raise forbidden("Teachers can only publish to their own courses")
    if body.course_id and not can_manage_course(db, p, body.course_id): raise forbidden("You do not teach this course")
    a = Announcement(title=body.title, body=body.body, course_id=body.course_id, author_id=p.user_id); db.add(a); db.flush()
    if body.course_id:
        rec = set(db.scalars(select(Enrollment.student_id).where(Enrollment.course_id == body.course_id, Enrollment.status == EnrollmentStatus.enrolled)))
        rec |= set(db.scalars(select(CourseTeacher.user_id).where(CourseTeacher.course_id == body.course_id)))
    else:
        rec = set(db.scalars(select(User.id).where(User.active.is_(True))))
    rec.discard(p.user_id)
    notify_users(db, list(rec), f"New announcement: {body.title}", body.body[:200])
    audit(db, request, "announcement.publish", "announcement", a.id, {"courseId": body.course_id}); db.commit()
    emit("announcement.published", {"id": a.id, "courseId": a.course_id})
    return a.d()


@router.get("/notifications")
def list_notifications(page: Page = Depends(), unread: Literal["true", "false"] | None = None,
                       p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    mine = [Notification.user_id == p.user_id]
    conds = mine + ([Notification.read_at.is_(None)] if unread == "true" else [])
    total = db.scalar(select(func.count()).select_from(Notification).where(*conds))
    rows = db.scalars(select(Notification).where(*conds).order_by(Notification.created_at.desc()).limit(page.page_size).offset(page.offset)).all()
    unread_n = db.scalar(select(func.count()).select_from(Notification).where(*mine, Notification.read_at.is_(None)))
    return {**page.wrap([n.d() for n in rows], total), "unreadCount": unread_n}


@router.put("/notifications/settings")
def settings_(body: ChannelsIn, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    u = db.get(User, p.user_id)
    u.notification_channels = body.model_dump(by_alias=True); db.commit()
    return u.notification_channels


@router.post("/notifications/read-all", status_code=204)
def read_all(p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.user_id == p.user_id, Notification.read_at.is_(None))): n.read_at = now()
    db.commit()
    return Response(status_code=204)


@router.put("/notifications/{notification_id}/read")
def read_one(notification_id: str, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != p.user_id: raise not_found("Notification")
    n.read_at = now(); db.commit()
    return n.d()
