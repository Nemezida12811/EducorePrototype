"""python -m app.seed  — idempotent. Production: institution + super admin only. Development: demo data too."""
from sqlalchemy import func, select

from .config import get_settings
from .db import Base, SessionLocal, engine
from .models import (Announcement, CalendarEvent, Course, CoursePrerequisite, CourseSession, CourseTeacher, Department, Enrollment,
                     EnrollmentStatus, ExamTerm, Grade, Institution, Role, StudyPlanItem, StudyProgram, User, now)
from .security import hash_password
from .services import compute_final

settings = get_settings()
SCHEME = [{"name": "Midterm", "maxPoints": 30}, {"name": "Project", "maxPoints": 30}, {"name": "Exam", "maxPoints": 40}]


def run_seed(db) -> str:
    if db.scalar(select(func.count()).select_from(Institution)): return "Already seeded, nothing to do."
    pw = hash_password(settings.seed_admin_password)
    inst = Institution(name="EduCore University", domain="educore.example"); db.add(inst)
    root = User(email="superadmin@educore.example", password_hash=pw, first_name="Super", last_name="Admin", role=Role.super_admin); db.add(root)
    if settings.is_prod:
        db.commit()
        return f'Production seed: institution "{inst.name}" and super admin {root.email} created. Change the password immediately.'

    dept = Department(code="KPI", name="Department of Computers and Informatics"); db.add(dept); db.flush()
    prog = StudyProgram(name="Informatics", department_id=dept.id, degree="Bc.", credits_required=180); db.add(prog); db.flush()

    def mk(email, first, last, role):
        u = User(email=email, password_hash=pw, first_name=first, last_name=last, role=role, department_id=dept.id,
                 study_program_id=prog.id if role == Role.student else None)
        db.add(u); db.flush(); return u

    mk("admin@educore.example", "Anna", "Admin", Role.admin)
    t1, t2 = mk("teacher1@educore.example", "Peter", "Novák", Role.teacher), mk("teacher2@educore.example", "Mária", "Kováčová", Role.teacher)
    s1, s2, s3 = (mk("student1@educore.example", "Ľubomír", "Šimko", Role.student), mk("student2@educore.example", "Zuzana", "Horváthová", Role.student),
                  mk("student3@educore.example", "Ján", "Tóth", Role.student))

    def course(code, name, teacher, archived=False, year="2026/2027", sem="winter", capacity=30):
        c = Course(code=code, name=name, description=f"{name} – demo course.", department_id=dept.id, guarantor_id=teacher.id, academic_year=year,
                   semester=sem, credits=5, capacity=capacity, grading_scheme=SCHEME, syllabus=["Introduction", "Core concepts", "Applications", "Revision"],
                   archived=archived)
        db.add(c); db.flush(); db.add(CourseTeacher(course_id=c.id, user_id=teacher.id)); return c

    oop = course("OOP", "Object-oriented programming", t1, archived=True, year="2025/2026")
    ads2 = course("ADS2", "Algorithms and data structures 2", t1)
    db1 = course("DB1", "Databases", t2, capacity=2)
    db.add(CoursePrerequisite(course_id=ads2.id, prerequisite_id=oop.id))
    db.add_all([CourseSession(course_id=ads2.id, kind="lecture", day_of_week=1, start_time="09:00", end_time="10:40", room="B-201", teacher_id=t1.id),
                CourseSession(course_id=ads2.id, kind="lab", day_of_week=3, start_time="13:00", end_time="14:40", room="LAB-3", teacher_id=t1.id),
                CourseSession(course_id=db1.id, kind="lecture", day_of_week=2, start_time="11:00", end_time="12:40", room="B-105", teacher_id=t2.id)])
    db.add(ExamTerm(course_id=ads2.id, date="2027-01-20", time="09:00", room="B-201", format="written", term=1, capacity=30))
    db.add_all([StudyPlanItem(study_program_id=prog.id, course_id=oop.id, semester_no=1), StudyPlanItem(study_program_id=prog.id, course_id=ads2.id, semester_no=3),
                StudyPlanItem(study_program_id=prog.id, course_id=db1.id, semester_no=3)])
    comps = {"Midterm": 24, "Project": 26, "Exam": 33}
    score, mark = compute_final(SCHEME, comps)
    db.add(Grade(course_id=oop.id, student_id=s1.id, components=comps, final_score=score, mark=mark, updated_by=t1.id))
    E = EnrollmentStatus
    # DB1 has capacity 2, so student3 starts on the waitlist
    for c, s, st in [(oop, s1, E.enrolled), (ads2, s1, E.enrolled), (ads2, s2, E.enrolled), (db1, s1, E.enrolled), (db1, s2, E.enrolled), (db1, s3, E.waitlisted)]:
        db.add(Enrollment(course_id=c.id, student_id=s.id, status=st)); db.flush()  # flush keeps created_at ordering stable
    db.add(Announcement(author_id=t1.id, title="Welcome to the new semester", body="Lectures start on Monday."))
    db.add(CalendarEvent(title="Enrollment deadline", kind="deadline", starts_at=now().replace(year=2026, month=9, day=20, hour=23, minute=59), created_by=root.id))
    db.commit()
    return ("Seeded demo data. All demo accounts use the password from SEED_ADMIN_PASSWORD.\n"
            "  superadmin@ · admin@ · teacher1@ · teacher2@ · student1@ · student2@ · student3@educore.example")


if __name__ == "__main__":
    from . import models  # noqa: F401
    Base.metadata.create_all(engine)
    with SessionLocal() as s: print(run_seed(s))
