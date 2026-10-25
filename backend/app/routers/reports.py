import io
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from openpyxl import Workbook
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import bad_request, forbidden, not_found
from ..models import Course, Enrollment, EnrollmentStatus, Grade, Role, User
from ..security import Principal, authenticate, can_manage_course, require_roles
from ..services import audit, to_csv
from .institutions import platform_usage

router = APIRouter(tags=["reports"])


def occupancy(db: Session) -> list[dict]:
    courses = db.scalars(select(Course).where(Course.archived.is_(False)).order_by(Course.code)).all()
    counts = db.execute(select(Enrollment.course_id, Enrollment.status, func.count()).group_by(Enrollment.course_id, Enrollment.status)).all()
    out = []
    for c in courses:
        n = lambda st: next((k for cid, s, k in counts if cid == c.id and s == st), 0)
        enrolled = n(EnrollmentStatus.enrolled)
        out.append({"courseId": c.id, "code": c.code, "name": c.name, "enrolled": enrolled, "capacity": c.capacity,
                    "waitlisted": n(EnrollmentStatus.waitlisted), "occupancyPct": round(enrolled / c.capacity * 100)})
    return out


def course_stats(db: Session, course_id: str) -> dict:
    c = db.get(Course, course_id)
    if not c: raise not_found("Course")
    enrolled = db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.course_id == course_id, Enrollment.status == EnrollmentStatus.enrolled))
    grades = [g for g in db.scalars(select(Grade).where(Grade.course_id == course_id)) if g.final_score is not None]
    dist = {m: 0 for m in ("A", "B", "C", "D", "E", "FX")}
    for g in grades: dist[g.mark] = dist.get(g.mark, 0) + 1
    passed = sum(1 for g in grades if g.mark != "FX")
    return {"courseId": course_id, "code": c.code, "name": c.name, "enrolled": enrolled, "graded": len(grades), "passed": passed,
            "passRate": round(passed / len(grades) * 100, 1) if grades else None,
            "averageScore": round(sum(g.final_score for g in grades) / len(grades), 1) if grades else None, "distribution": dist}


@router.get("/reports/institution/overview")
def overview(_: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    by_role = db.execute(select(User.role, func.count()).where(User.active.is_(True)).group_by(User.role)).all()
    return {"usersByRole": {r.value: n for r, n in by_role},
            "enrollments": db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.status == EnrollmentStatus.enrolled)),
            "occupancy": occupancy(db)}


@router.get("/reports/course/{course_id}")
def course_report(course_id: str, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    if not can_manage_course(db, p, course_id): raise forbidden()
    return course_stats(db, course_id)


@router.get("/reports/export")
def export(request: Request, report: Literal["occupancy", "course-stats"] = "occupancy", format: Literal["csv", "xlsx"] = "csv",
           course_id: str | None = Query(None, alias="courseId"), _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    if report == "occupancy": rows = occupancy(db)
    else:
        if not course_id: raise bad_request("course_id_required", "courseId is required for course-stats")
        s = course_stats(db, course_id)
        dist = s.pop("distribution")
        rows = [{**s, **{f"mark_{k}": v for k, v in dist.items()}}]
    audit(db, request, "report.export", "report", None, {"report": report, "format": format}); db.commit()
    if format == "csv":
        return Response(to_csv(rows), media_type="text/csv; charset=utf-8", headers={"content-disposition": f'attachment; filename="{report}.csv"'})
    wb = Workbook(); ws = wb.active; ws.title = report
    cols = list(rows[0]) if rows else []
    ws.append(cols)
    for r in rows:
        ws.append([r[c] for c in cols])
    for row in ws.iter_rows(min_row=2):  # strings must stay text, never formulas
        for cell in row:
            if isinstance(cell.value, str): cell.data_type = "s"
    buf = io.BytesIO(); wb.save(buf)
    return Response(buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"content-disposition": f'attachment; filename="{report}.xlsx"'})


@router.get("/reports/platform/usage")
def usage(_: Principal = Depends(require_roles(Role.super_admin)), db: Session = Depends(get_db)):
    return platform_usage(db)
