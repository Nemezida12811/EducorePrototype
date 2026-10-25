from fastapi import APIRouter, Depends, Request
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import conflict, not_found
from ..models import Course, Department, Enrollment, EnrollmentStatus, Grade, Role, StudyPlanItem, StudyProgram, User
from ..schemas import CamelModel
from ..security import Principal, authenticate, require_roles
from ..services import audit, is_passed

router = APIRouter(tags=["organization"])
admin = Depends(require_roles(Role.admin))


class DeptIn(CamelModel):
    code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=200)


class DeptUpdate(CamelModel):
    code: str | None = Field(None, min_length=1, max_length=20)
    name: str | None = Field(None, min_length=1, max_length=200)


class ProgramIn(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    department_id: str
    degree: str = Field("Bc.", max_length=20)
    credits_required: int = Field(180, ge=1, le=600)


class ProgramUpdate(CamelModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    department_id: str | None = None
    degree: str | None = Field(None, max_length=20)
    credits_required: int | None = Field(None, ge=1, le=600)


class PlanItem(CamelModel):
    course_id: str
    semester_no: int = Field(ge=1, le=12)
    required: bool = True


class PlanIn(CamelModel):
    items: list[PlanItem] = Field(max_length=300)


@router.get("/departments")
def departments(_: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    return {"items": [d.d() for d in db.scalars(select(Department).order_by(Department.code))]}


@router.post("/departments", status_code=201)
def create_department(body: DeptIn, request: Request, db: Session = Depends(get_db), _: Principal = admin):
    if db.scalar(select(Department.id).where(Department.code == body.code)): raise conflict("code_taken")
    d = Department(**body.model_dump()); db.add(d); db.flush()
    audit(db, request, "department.create", "department", d.id); db.commit()
    return d.d()


@router.put("/departments/{dept_id}")
def update_department(dept_id: str, body: DeptUpdate, request: Request, db: Session = Depends(get_db), _: Principal = admin):
    d = db.get(Department, dept_id)
    if not d: raise not_found("Department")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(d, k, v)
    audit(db, request, "department.update", "department", dept_id); db.commit()
    return d.d()


@router.get("/study-programs")
def programs(_: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    return {"items": [p.d() for p in db.scalars(select(StudyProgram).order_by(StudyProgram.name))]}


@router.post("/study-programs", status_code=201)
def create_program(body: ProgramIn, request: Request, db: Session = Depends(get_db), _: Principal = admin):
    sp = StudyProgram(**body.model_dump()); db.add(sp); db.flush()
    audit(db, request, "study_program.create", "study_program", sp.id); db.commit()
    return sp.d()


@router.put("/study-programs/{program_id}")
def update_program(program_id: str, body: ProgramUpdate, request: Request, db: Session = Depends(get_db), _: Principal = admin):
    sp = db.get(StudyProgram, program_id)
    if not sp: raise not_found("Study program")
    for k, v in body.model_dump(exclude_unset=True).items(): setattr(sp, k, v)  # only sent fields change
    audit(db, request, "study_program.update", "study_program", program_id); db.commit()
    return sp.d()


@router.put("/study-programs/{program_id}/plan")
def replace_plan(program_id: str, body: PlanIn, request: Request, db: Session = Depends(get_db), _: Principal = admin):
    if not db.get(StudyProgram, program_id): raise not_found("Study program")
    for r in db.scalars(select(StudyPlanItem).where(StudyPlanItem.study_program_id == program_id)): db.delete(r)
    db.flush()
    db.add_all(StudyPlanItem(study_program_id=program_id, **i.model_dump()) for i in body.items)
    audit(db, request, "study_plan.replace", "study_program", program_id, {"count": len(body.items)}); db.commit()
    return {"count": len(body.items)}


@router.get("/study-plan/me")
def my_plan(p: Principal = Depends(require_roles(Role.student)), db: Session = Depends(get_db)):
    """The student's plan with live status: passed | failed | enrolled | todo."""
    u = db.get(User, p.user_id)
    if not u.study_program_id: return {"programId": None, "items": [], "creditsEarned": 0, "creditsRequired": None}
    prog = db.get(StudyProgram, u.study_program_id)
    plan = db.execute(select(StudyPlanItem, Course).join(Course, Course.id == StudyPlanItem.course_id)
                      .where(StudyPlanItem.study_program_id == prog.id).order_by(StudyPlanItem.semester_no, Course.code)).all()
    grades = {g.course_id: g for g in db.scalars(select(Grade).where(Grade.student_id == u.id))}
    enrolled = set(db.scalars(select(Enrollment.course_id).where(Enrollment.student_id == u.id, Enrollment.status == EnrollmentStatus.enrolled)))
    items = []
    for i, c in plan:
        g = grades.get(c.id)
        status = ("passed" if is_passed(g.mark) else "failed") if g and g.mark else "enrolled" if c.id in enrolled else "todo"
        items.append({"courseId": c.id, "code": c.code, "name": c.name, "credits": c.credits, "semesterNo": i.semester_no, "required": i.required,
                      "status": status, "mark": g.mark if g else None, "finalScore": g.final_score if g else None})
    return {"programId": prog.id, "programName": prog.name, "creditsRequired": prog.credits_required,
            "creditsEarned": sum(x["credits"] for x in items if x["status"] == "passed"), "items": items}
