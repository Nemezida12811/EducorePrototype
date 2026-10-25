import re
from typing import Literal

from fastapi import APIRouter, Depends, File as FormFile, Query, Request, Response, UploadFile
from pydantic import Field, field_validator, model_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import MAX_UPLOAD_BYTES
from ..db import get_db
from ..errors import bad_request, conflict, forbidden, not_found
from ..models import (Completion, Course, CourseDocument, CoursePrerequisite, CourseSession, CourseTeacher, Department, Enrollment,
                      EnrollmentStatus, ExamTerm, File, Grade, Role, Semester, User)
from ..schemas import CamelModel
from ..security import Principal, authenticate, can_manage_course, require_roles, role_allowed
from ..services import Page, audit, emit, is_passed, read_upload, save_file

router = APIRouter(tags=["courses"])


class Component(CamelModel):
    name: str = Field(min_length=1, max_length=60)
    max_points: int = Field(ge=1, le=100)


def _check_scheme(v):
    if v is None: return v
    names = [c.name for c in v]
    if len(set(names)) != len(names): raise ValueError("Component names must be unique")
    if sum(c.max_points for c in v) != 100: raise ValueError("Component points must add up to 100")
    return v


class CourseIn(CamelModel):
    """Create payload (defaults apply). Updates use CourseUpdate, where only sent fields change."""
    code: str = Field(min_length=2, max_length=30)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field("", max_length=5000)
    department_id: str | None = None
    guarantor_id: str | None = None
    academic_year: str = Field(pattern=r"^\d{4}/\d{4}$")
    semester: Semester
    credits: int = Field(5, ge=0, le=30)
    capacity: int = Field(30, ge=1, le=5000)
    completion: Completion = Completion.exam
    grading_scheme: list[Component] = Field(min_length=1, max_length=12)
    syllabus: list[str] = Field(default_factory=list, max_length=60)
    teacher_ids: list[str] = Field(default_factory=list, max_length=20)
    prerequisite_ids: list[str] = Field(default_factory=list, max_length=20)

    _scheme = field_validator("grading_scheme")(_check_scheme)

    @model_validator(mode="after")
    def _guarantor(self):
        if self.guarantor_id and self.teacher_ids and self.guarantor_id not in self.teacher_ids:
            raise ValueError("Guarantor must be one of the teachers")
        return self


class CourseUpdate(CamelModel):
    code: str | None = Field(None, min_length=2, max_length=30)
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=5000)
    department_id: str | None = None
    guarantor_id: str | None = None
    academic_year: str | None = Field(None, pattern=r"^\d{4}/\d{4}$")
    semester: Semester | None = None
    credits: int | None = Field(None, ge=0, le=30)
    capacity: int | None = Field(None, ge=1, le=5000)
    completion: Completion | None = None
    grading_scheme: list[Component] | None = Field(None, min_length=1, max_length=12)
    syllabus: list[str] | None = Field(None, max_length=60)
    teacher_ids: list[str] | None = Field(None, max_length=20)
    prerequisite_ids: list[str] | None = Field(None, max_length=20)

    _scheme = field_validator("grading_scheme")(_check_scheme)


def load_course(db: Session, course_id: str) -> Course:
    c = db.get(Course, course_id)
    if not c: raise not_found("Course")
    return c


def _assert_teachers(db: Session, ids: list[str]) -> None:
    if not ids: return
    n = db.scalar(select(func.count()).select_from(User).where(User.id.in_(set(ids)), User.active.is_(True),
                                                                User.role.in_([Role.teacher, Role.admin, Role.super_admin])))
    if n != len(set(ids)): raise bad_request("invalid_teachers", "Every teacher must be an active teacher account")


def _teachers(db: Session, course_ids: list[str]) -> list[tuple]:
    return db.execute(select(CourseTeacher.course_id, User.id, User.first_name, User.last_name, User.email)
                      .join(User, User.id == CourseTeacher.user_id).where(CourseTeacher.course_id.in_(course_ids))).all()


@router.get("/courses")
def list_courses(page: Page = Depends(), q: str | None = Query(None, max_length=100), department_id: str | None = Query(None, alias="departmentId"),
                 semester: Semester | None = None, academic_year: str | None = Query(None, alias="academicYear"),
                 archived: Literal["true", "false", "all"] = "false", mine: Literal["true", "false"] = "false",
                 p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    conds = []
    if archived != "all": conds.append(Course.archived.is_(archived == "true"))
    if department_id: conds.append(Course.department_id == department_id)
    if semester: conds.append(Course.semester == semester)
    if academic_year: conds.append(Course.academic_year == academic_year)
    if q: conds.append(or_(func.lower(Course.name).like(f"%{q.lower()}%"), func.lower(Course.code).like(f"%{q.lower()}%")))
    if mine == "true" and p.role == Role.student:
        conds.append(Course.id.in_(select(Enrollment.course_id).where(Enrollment.student_id == p.user_id)))
    elif mine == "true" and p.role == Role.teacher:
        conds.append(Course.id.in_(select(CourseTeacher.course_id).where(CourseTeacher.user_id == p.user_id)))
    total = db.scalar(select(func.count()).select_from(Course).where(*conds))
    rows = db.scalars(select(Course).where(*conds).order_by(Course.code).limit(page.page_size).offset(page.offset)).all()
    ids = [c.id for c in rows]
    counts = db.execute(select(Enrollment.course_id, Enrollment.status, func.count()).where(Enrollment.course_id.in_(ids))
                        .group_by(Enrollment.course_id, Enrollment.status)).all() if ids else []
    teachers = _teachers(db, ids) if ids else []
    items = []
    for c in rows:
        cnt = lambda st: next((n for cid, s, n in counts if cid == c.id and s == st), 0)
        items.append({**c.d(), "enrolledCount": cnt(EnrollmentStatus.enrolled), "waitlistCount": cnt(EnrollmentStatus.waitlisted),
                      "teachers": [{"id": t.id, "firstName": t.first_name, "lastName": t.last_name, "isGuarantor": t.id == c.guarantor_id}
                                   for t in teachers if t.course_id == c.id]})
    return page.wrap(items, total)


@router.get("/courses/{course_id}")
def get_course(course_id: str, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    c = load_course(db, course_id)
    teachers = _teachers(db, [course_id])
    prereqs = db.execute(select(Course.id, Course.code, Course.name).join(CoursePrerequisite, CoursePrerequisite.prerequisite_id == Course.id)
                         .where(CoursePrerequisite.course_id == course_id)).all()
    docs = db.execute(select(CourseDocument.id, File.id, File.name, File.size, CourseDocument.kind).join(File, File.id == CourseDocument.file_id)
                      .where(CourseDocument.course_id == course_id)).all()
    counts = dict(db.execute(select(Enrollment.status, func.count()).where(Enrollment.course_id == course_id).group_by(Enrollment.status)).all())
    out = {**c.d(),
           "teachers": [{"id": t.id, "firstName": t.first_name, "lastName": t.last_name, "email": t.email, "isGuarantor": t.id == c.guarantor_id} for t in teachers],
           "sessions": [s.d() for s in db.scalars(select(CourseSession).where(CourseSession.course_id == course_id).order_by(CourseSession.day_of_week, CourseSession.start_time))],
           "prerequisites": [{"id": r[0], "code": r[1], "name": r[2]} for r in prereqs],
           "documents": [{"id": d[0], "fileId": d[1], "name": d[2], "size": d[3], "kind": d[4].value} for d in docs],
           "examTerms": [e.d() for e in db.scalars(select(ExamTerm).where(ExamTerm.course_id == course_id).order_by(ExamTerm.date))],
           "enrolledCount": counts.get(EnrollmentStatus.enrolled, 0), "waitlistCount": counts.get(EnrollmentStatus.waitlisted, 0),
           "canManage": can_manage_course(db, p, course_id)}
    if p.role == Role.student:
        enr = db.scalars(select(Enrollment).where(Enrollment.course_id == course_id, Enrollment.student_id == p.user_id)).first()
        g = db.scalars(select(Grade).where(Grade.course_id == course_id, Grade.student_id == p.user_id)).first()
        passed = {r.course_id for r in db.scalars(select(Grade).where(Grade.student_id == p.user_id, Grade.course_id.in_([r[0] for r in prereqs]))) if is_passed(r.mark)} if prereqs else set()
        out["myEnrollment"] = {"id": enr.id, "status": enr.status.value} if enr else None
        out["myGrade"] = {"components": g.components, "finalScore": g.final_score, "mark": g.mark} if g else None
        out["missingPrerequisites"] = [{"id": r[0], "code": r[1], "name": r[2]} for r in prereqs if r[0] not in passed]
    return out


@router.post("/courses", status_code=201)
def create_course(body: CourseIn, request: Request, p: Principal = Depends(require_roles(Role.admin, Role.teacher)), db: Session = Depends(get_db)):
    teacher_ids = list(dict.fromkeys(([p.user_id] if p.role == Role.teacher else []) + body.teacher_ids))
    _assert_teachers(db, teacher_ids)
    if body.prerequisite_ids and db.scalar(select(func.count()).select_from(Course).where(Course.id.in_(set(body.prerequisite_ids)))) != len(set(body.prerequisite_ids)):
        raise bad_request("invalid_prerequisites")
    if db.scalar(select(Course.id).where(Course.code == body.code)): raise conflict("code_taken", "A course with this code already exists")
    data = body.model_dump(exclude={"teacher_ids", "prerequisite_ids", "grading_scheme"})
    c = Course(**data, grading_scheme=[x.model_dump(by_alias=True) for x in body.grading_scheme])
    if not c.guarantor_id and teacher_ids: c.guarantor_id = teacher_ids[0]
    db.add(c); db.flush()
    db.add_all(CourseTeacher(course_id=c.id, user_id=t) for t in teacher_ids)
    db.add_all(CoursePrerequisite(course_id=c.id, prerequisite_id=x) for x in dict.fromkeys(body.prerequisite_ids))
    audit(db, request, "course.create", "course", c.id, {"code": c.code}); db.commit()
    emit("course.created", {"id": c.id, "code": c.code})
    return c.d()


@router.put("/courses/{course_id}")
def update_course(course_id: str, body: CourseUpdate, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    if not can_manage_course(db, p, course_id): raise forbidden("Only the course teachers or an admin can edit this course")
    c = load_course(db, course_id)
    if c.archived: raise conflict("course_archived", "Archived courses are read-only; restore the course first")
    data = body.model_dump(exclude_unset=True)  # only fields the client sent change
    if "grading_scheme" in data:
        if db.scalar(select(func.count()).select_from(Grade).where(Grade.course_id == course_id)):
            raise conflict("scheme_locked", "The grading scheme cannot change once grades have been entered")
        data["grading_scheme"] = [x.model_dump(by_alias=True) for x in body.grading_scheme]
    teacher_ids, prereq_ids = data.pop("teacher_ids", None), data.pop("prerequisite_ids", None)
    if prereq_ids is not None and course_id in prereq_ids: raise bad_request("invalid_prerequisites", "A course cannot require itself")
    if teacher_ids is not None:
        if not teacher_ids: raise bad_request("invalid_teachers", "A course needs at least one teacher")
        _assert_teachers(db, teacher_ids)
    if data.get("guarantor_id") and teacher_ids is not None and data["guarantor_id"] not in teacher_ids:
        raise bad_request("invalid_guarantor", "Guarantor must be one of the teachers")
    if "capacity" in data and data["capacity"] < db.scalar(select(func.count()).select_from(Enrollment).where(
            Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.enrolled)):
        raise conflict("capacity_below_enrolled", "Capacity cannot be lower than the number of enrolled students")
    for k, v in data.items(): setattr(c, k, v)
    if teacher_ids is not None:
        for r in db.scalars(select(CourseTeacher).where(CourseTeacher.course_id == course_id)): db.delete(r)
        db.flush()
        db.add_all(CourseTeacher(course_id=course_id, user_id=t) for t in dict.fromkeys(teacher_ids))
    if prereq_ids is not None:
        for r in db.scalars(select(CoursePrerequisite).where(CoursePrerequisite.course_id == course_id)): db.delete(r)
        db.flush()
        db.add_all(CoursePrerequisite(course_id=course_id, prerequisite_id=x) for x in dict.fromkeys(prereq_ids))
    audit(db, request, "course.update", "course", course_id, {"fields": list(body.model_dump(exclude_unset=True))}); db.commit()
    return c.d()


@router.delete("/courses/{course_id}", status_code=204)
def archive_course(course_id: str, request: Request, _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    """Archive keeps grades and history."""
    load_course(db, course_id).archived = True
    audit(db, request, "course.archive", "course", course_id); db.commit()
    emit("course.archived", {"id": course_id})
    return Response(status_code=204)


@router.post("/courses/{course_id}/restore")
def restore_course(course_id: str, request: Request, _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    c = load_course(db, course_id); c.archived = False
    audit(db, request, "course.restore", "course", course_id); db.commit()
    return c.d()


@router.get("/courses/{course_id}/students")
def course_students(course_id: str, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    if not can_manage_course(db, p, course_id): raise forbidden()
    load_course(db, course_id)
    rows = db.execute(select(Enrollment, User, Grade).join(User, User.id == Enrollment.student_id)
                      .outerjoin(Grade, (Grade.course_id == Enrollment.course_id) & (Grade.student_id == Enrollment.student_id))
                      .where(Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.enrolled).order_by(User.last_name)).all()
    return {"items": [{"enrollmentId": e.id, "enrolledAt": e.d()["createdAt"], "studentId": u.id, "firstName": u.first_name, "lastName": u.last_name,
                       "email": u.email, "gradeId": g.id if g else None, "components": g.components if g else None,
                       "finalScore": g.final_score if g else None, "mark": g.mark if g else None} for e, u, g in rows]}


@router.post("/courses/{course_id}/documents", status_code=201)
async def add_document(course_id: str, request: Request, kind: Literal["syllabus", "material"] = "material", file: UploadFile = FormFile(...),
                       p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    """PDF only, max 10 MB. Query: ?kind=syllabus|material"""
    if not role_allowed(p.role, [Role.admin, Role.teacher]) or not can_manage_course(db, p, course_id): raise forbidden()
    if load_course(db, course_id).archived: raise conflict("course_archived", "Archived courses are read-only")
    data = await read_upload(file)
    if data[:5] != b"%PDF-": raise bad_request("pdf_only", "Only PDF files are accepted")
    f = save_file(db, data, p.user_id, file.filename or "document.pdf", "application/pdf")
    doc = CourseDocument(course_id=course_id, file_id=f.id, kind=kind); db.add(doc)
    audit(db, request, "course.document_add", "course", course_id, {"fileId": f.id, "kind": kind}); db.commit()
    return {"id": doc.id, "fileId": f.id, "name": f.name, "size": f.size, "kind": kind}
