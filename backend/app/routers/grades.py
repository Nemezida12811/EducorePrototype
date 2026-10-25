import uuid

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import begin_immediate, get_db
from ..errors import bad_request, conflict, forbidden, not_found
from ..models import Course, Enrollment, EnrollmentStatus, Grade, GradeHistory, Institution, Role, StudyProgram, User, now
from ..pdf import Doc
from ..schemas import CamelModel
from ..security import Principal, authenticate, can_manage_course, require_roles
from ..services import audit, compute_final, emit, is_passed, notify_users

router = APIRouter(tags=["grades"])


class GradeIn(CamelModel):
    course_id: str
    student_id: str
    components: dict[str, float] = Field(min_length=1)


def _my_rows(db: Session, student_id: str):
    return db.execute(select(Grade, Course).join(Course, Course.id == Grade.course_id).where(Grade.student_id == student_id)
                      .order_by(Course.academic_year, Course.semester, Course.code)).all()


def _summary(rows) -> dict:
    graded = [(g, c) for g, c in rows if g.final_score is not None]
    credits = sum(c.credits for _, c in graded)
    return {"creditsEarned": sum(c.credits for g, c in graded if is_passed(g.mark)),
            "weightedAverage": round(sum(g.final_score * c.credits for g, c in graded) / credits, 1) if credits else None,
            "gradedCourses": len(graded)}


@router.post("/grades")
def set_grade(body: GradeIn, request: Request, p: Principal = Depends(require_roles(Role.teacher)), db: Session = Depends(get_db)):
    if not can_manage_course(db, p, body.course_id): raise forbidden("You do not teach this course")
    begin_immediate(db)
    c = db.get(Course, body.course_id)
    if not c: raise not_found("Course")
    if c.archived: raise conflict("course_archived", "Archived courses are read-only")
    if not db.scalars(select(Enrollment).where(Enrollment.course_id == c.id, Enrollment.student_id == body.student_id,
                                               Enrollment.status == EnrollmentStatus.enrolled)).first():
        raise bad_request("not_enrolled", "The student is not enrolled in this course")
    for name, pts in body.components.items():
        d = next((x for x in c.grading_scheme if x["name"] == name), None)
        if not d: raise bad_request("unknown_component", f'"{name}" is not part of this course\'s grading scheme')
        if pts < 0 or pts > d["maxPoints"]: raise bad_request("points_out_of_range", f'"{name}" allows 0 to {d["maxPoints"]} points')
    g = db.scalars(select(Grade).where(Grade.course_id == c.id, Grade.student_id == body.student_id)).first()
    before = {"components": g.components, "finalScore": g.final_score, "mark": g.mark} if g else None
    merged = {**(g.components if g else {}), **body.components}
    score, mark = compute_final(c.grading_scheme, merged)
    if g:
        g.components, g.final_score, g.mark, g.updated_by, g.updated_at = merged, score, mark, p.user_id, now()
    else:
        g = Grade(course_id=c.id, student_id=body.student_id, components=merged, final_score=score, mark=mark, updated_by=p.user_id); db.add(g)
    db.flush()
    db.add(GradeHistory(grade_id=g.id, changed_by=p.user_id, before=before, after={"components": merged, "finalScore": score, "mark": mark}))
    audit(db, request, "grade.set", "grade", g.id, {"courseId": c.id, "studentId": body.student_id, "finalScore": score, "mark": mark})
    notify_users(db, [body.student_id], f"Grade updated: {c.name}",
                 "A grade component was entered." if score is None else f"Final score {score} ({mark}).")
    db.commit()
    emit("grade.updated", {"id": g.id, "courseId": c.id, "studentId": body.student_id})
    return g.d()


@router.get("/grades/me")
def my_grades(p: Principal = Depends(require_roles(Role.student)), db: Session = Depends(get_db)):
    rows = _my_rows(db, p.user_id)
    return {"items": [{"id": g.id, "courseId": c.id, "code": c.code, "name": c.name, "credits": c.credits, "academicYear": c.academic_year,
                       "semester": c.semester.value, "components": g.components, "finalScore": g.final_score, "mark": g.mark,
                       "updatedAt": g.d()["updatedAt"]} for g, c in rows], "summary": _summary(rows)}


@router.get("/grades/me/transcript")
def transcript(request: Request, p: Principal = Depends(require_roles(Role.student)), db: Session = Depends(get_db)):
    u = db.get(User, p.user_id)
    rows = [(g, c) for g, c in _my_rows(db, p.user_id) if g.final_score is not None]
    s = _summary(rows)
    doc = Doc()
    doc.line("Výpis výsledkov / Transcript of records", 18, bold=True, gap=10)
    doc.line(f"{u.first_name} {u.last_name} · {u.email}", 11)
    doc.line(f"Issued: {now().date().isoformat()}", 10, gap=10)
    group = ""
    for g, c in rows:
        label = f"{c.academic_year} – {c.semester.value} semester"
        if label != group:
            group = label; doc.space(6); doc.line(label, 12, bold=True)
        doc.line(f"{c.code}  {c.name}  —  {c.credits} cr.  ·  {g.final_score}  ({g.mark})", 10)
    doc.space(10)
    doc.line(f"Credits earned: {s['creditsEarned']}   Weighted average score: {s['weightedAverage'] if s['weightedAverage'] is not None else '–'}", 11, bold=True)
    doc.line("Generated electronically by EduCore.", 8)
    audit(db, request, "document.transcript", "user", u.id); db.commit()
    return Response(doc.render(), media_type="application/pdf", headers={"content-disposition": 'attachment; filename="transcript.pdf"'})


@router.get("/grades/course/{course_id}")
def course_grades(course_id: str, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    if not can_manage_course(db, p, course_id): raise forbidden()
    c = db.get(Course, course_id)
    if not c: raise not_found("Course")
    rows = db.execute(select(User, Grade).join(Enrollment, Enrollment.student_id == User.id)
                      .outerjoin(Grade, (Grade.course_id == Enrollment.course_id) & (Grade.student_id == Enrollment.student_id))
                      .where(Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.enrolled).order_by(User.last_name)).all()
    return {"gradingScheme": c.grading_scheme, "archived": c.archived,
            "items": [{"studentId": u.id, "firstName": u.first_name, "lastName": u.last_name, "email": u.email, "gradeId": g.id if g else None,
                       "components": g.components if g else None, "finalScore": g.final_score if g else None, "mark": g.mark if g else None,
                       "updatedAt": g.d()["updatedAt"] if g else None} for u, g in rows]}


@router.get("/grades/{grade_id}/history")
def history(grade_id: str, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    g = db.get(Grade, grade_id)
    if not g: raise not_found("Grade")
    if not can_manage_course(db, p, g.course_id): raise forbidden()
    rows = db.execute(select(GradeHistory, User.last_name).outerjoin(User, User.id == GradeHistory.changed_by)
                      .where(GradeHistory.grade_id == grade_id).order_by(GradeHistory.changed_at.desc())).all()
    return {"items": [{"id": h.id, "changedAt": h.d()["changedAt"], "before": h.before, "after": h.after, "changedBy": name} for h, name in rows]}


@router.post("/documents/transcript-request")
def certificate(request: Request, p: Principal = Depends(require_roles(Role.student)), db: Session = Depends(get_db)):
    """Certificate of study (potvrdenie o štúdiu)."""
    u = db.get(User, p.user_id)
    prog = db.get(StudyProgram, u.study_program_id) if u.study_program_id else None
    inst = db.scalars(select(Institution).limit(1)).first()
    doc_id = str(uuid.uuid4())
    d = Doc()
    d.line(inst.name if inst else "EduCore", 18, bold=True, gap=14, center=True)
    d.line("Potvrdenie o štúdiu / Certificate of study", 16, bold=True, gap=30, center=True)
    d.line(f"This is to certify that {u.first_name} {u.last_name} ({u.email}) is an enrolled student", 12)
    d.line(f'of the study programme "{prog.name}" ({prog.degree}).' if prog else "of the institution.", 12, gap=24)
    d.line(f"Issued: {now().date().isoformat()}   ·   Document ID: {doc_id}", 10)
    audit(db, request, "document.certificate", "user", u.id, {"documentId": doc_id}); db.commit()
    return Response(d.render(), media_type="application/pdf", headers={"content-disposition": 'attachment; filename="certificate-of-study.pdf"'})
