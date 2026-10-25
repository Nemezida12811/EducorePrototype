from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import begin_immediate, get_db
from ..errors import conflict, forbidden, not_found
from ..models import Course, CoursePrerequisite, Enrollment, EnrollmentStatus, Grade, Role, User
from ..schemas import CamelModel
from ..security import Principal, authenticate, can_manage_course, require_roles, role_allowed
from ..services import audit, emit, is_passed, notify_users

router = APIRouter(tags=["enrollments"])


class EnrollIn(CamelModel):
    course_id: str


@router.post("/enrollments", status_code=201)
def enroll(body: EnrollIn, request: Request, p: Principal = Depends(require_roles(Role.student)), db: Session = Depends(get_db)):
    begin_immediate(db)  # take the write lock first so concurrent enrollments cannot oversell capacity
    c = db.get(Course, body.course_id)
    if not c: raise not_found("Course")
    if c.archived: raise conflict("course_archived", "Archived courses are closed for enrollment")
    if db.scalar(select(Enrollment.id).where(Enrollment.course_id == c.id, Enrollment.student_id == p.user_id)):
        raise conflict("already_enrolled", "You are already enrolled or on the waitlist")
    prereqs = [r for r in db.scalars(select(CoursePrerequisite.prerequisite_id).where(CoursePrerequisite.course_id == c.id))]
    if prereqs:
        passed = {g.course_id for g in db.scalars(select(Grade).where(Grade.student_id == p.user_id, Grade.course_id.in_(prereqs))) if is_passed(g.mark)}
        missing = [x for x in prereqs if x not in passed]
        if missing: raise conflict("prerequisites_missing", "Prerequisites have not been passed", {"missing": missing})
    n = db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.course_id == c.id, Enrollment.status == EnrollmentStatus.enrolled))
    e = Enrollment(course_id=c.id, student_id=p.user_id, status=EnrollmentStatus.enrolled if n < c.capacity else EnrollmentStatus.waitlisted)
    db.add(e); db.flush()
    audit(db, request, "enrollment.create", "enrollment", e.id, {"courseId": c.id, "status": e.status.value}); db.commit()
    emit("enrollment.created", {"id": e.id, "courseId": c.id, "studentId": p.user_id, "status": e.status.value})
    return e.d()


@router.delete("/enrollments/{enrollment_id}", status_code=204)
def withdraw(enrollment_id: str, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    begin_immediate(db)
    e = db.get(Enrollment, enrollment_id)
    if not e: raise not_found("Enrollment")
    if e.student_id != p.user_id and not role_allowed(p.role, [Role.admin]): raise forbidden()
    g = db.scalars(select(Grade).where(Grade.course_id == e.course_id, Grade.student_id == e.student_id)).first()
    if g and g.final_score is not None: raise conflict("already_graded", "Cannot withdraw from a course that has a final grade")
    was_enrolled, course_id = e.status == EnrollmentStatus.enrolled, e.course_id
    db.delete(e); db.flush()
    promoted = None
    if was_enrolled:  # a seat was freed: promote the longest-waiting student
        promoted = db.scalars(select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.waitlisted)
                              .order_by(Enrollment.created_at)).first()
        if promoted:
            promoted.status = EnrollmentStatus.enrolled
            notify_users(db, [promoted.student_id], "You got a seat", f"A place opened up in {db.get(Course, course_id).name}; you are now enrolled.")
    audit(db, request, "enrollment.delete", "enrollment", enrollment_id, {"courseId": course_id}); db.commit()
    emit("enrollment.removed", {"id": enrollment_id, "promotedEnrollmentId": promoted.id if promoted else None})
    return Response(status_code=204)


@router.get("/enrollments/me")
def my_enrollments(p: Principal = Depends(require_roles(Role.student)), db: Session = Depends(get_db)):
    rows = db.execute(select(Enrollment, Course, Grade).join(Course, Course.id == Enrollment.course_id)
                      .outerjoin(Grade, (Grade.course_id == Enrollment.course_id) & (Grade.student_id == Enrollment.student_id))
                      .where(Enrollment.student_id == p.user_id).order_by(Course.code)).all()
    return {"items": [{"id": e.id, "status": e.status.value, "createdAt": e.d()["createdAt"], "courseId": c.id, "code": c.code, "name": c.name,
                       "credits": c.credits, "academicYear": c.academic_year, "semester": c.semester.value, "archived": c.archived,
                       "finalScore": g.final_score if g else None, "mark": g.mark if g else None} for e, c, g in rows]}


@router.get("/courses/{course_id}/waitlist")
def waitlist(course_id: str, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    if not can_manage_course(db, p, course_id): raise forbidden()
    rows = db.execute(select(Enrollment, User).join(User, User.id == Enrollment.student_id)
                      .where(Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.waitlisted).order_by(Enrollment.created_at)).all()
    return {"items": [{"position": i + 1, "enrollmentId": e.id, "since": e.d()["createdAt"], "studentId": u.id, "firstName": u.first_name,
                       "lastName": u.last_name, "email": u.email} for i, (e, u) in enumerate(rows)]}
