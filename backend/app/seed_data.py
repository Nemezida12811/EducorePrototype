"""python -m app.seed_data [--students 150] [--seed 1]

Fills the database with generated, internally consistent test data: departments, study programs and plans, teachers, students, courses with
conflict-free timetables, prerequisites, enrollments (with waitlists), grades, exam terms and registrations, announcements and calendar dates.

Deterministic for a given --seed. Run it once on a seeded database (it calls the normal seed first when the database is empty).
Not meant for production: every generated account uses the password from SEED_ADMIN_PASSWORD.
"""
import argparse
import random
import unicodedata
from datetime import datetime, timedelta

from sqlalchemy import func, select

from .config import get_settings
from .db import Base, SessionLocal, engine
from .models import (Announcement, AnnouncementRead, CalendarEvent, Completion, Course, CoursePrerequisite, CourseSession, CourseTeacher, Department, Enrollment,
                     EnrollmentStatus, ExamRegistration, ExamTerm, Grade, Institution, Role, Room, RoomDepartment, RoomKind, Semester, StudyPlanItem, StudyProgram, User)
from .rooms_data import ROOMS as ROOMS_DATA
from .security import hash_password
from .seed import run_seed
from .services import compute_final

settings = get_settings()

DEPARTMENTS = [("KPI", "Department of Computers and Informatics"), ("KEMT", "Department of Electronics and Multimedia Communications"),
               ("KAI", "Department of Cybernetics and Artificial Intelligence"), ("KE", "Department of Theoretical Electrical Engineering")]

# name, degree, credits, department, departments whose courses belong to the plan
PROGRAMS = [("Computer Science", "Bc.", 180, "KPI", ("KPI",)), ("Software Engineering", "Ing.", 120, "KPI", ("KPI",)),
            ("Electronic Engineering", "Bc.", 180, "KEMT", ("KEMT", "KE")), ("Artificial Intelligence", "Ing.", 120, "KAI", ("KAI", "KPI")),
            ("Electrical Engineering", "Bc.", 180, "KE", ("KE", "KEMT"))]

FIRST_M = ["Peter", "Martin", "Juraj", "Michal", "Tomáš", "Jakub", "Marek", "Adam", "Ondrej", "Lukáš", "Matej", "Samuel", "Dávid", "Filip", "Roman", "Patrik"]
FIRST_F = ["Zuzana", "Mária", "Katarína", "Jana", "Lucia", "Veronika", "Natália", "Eva", "Simona", "Alžbeta", "Michaela", "Barbora", "Nikola", "Petra", "Monika", "Lenka"]
LAST = ["Novák", "Kováč", "Horváth", "Varga", "Tóth", "Nagy", "Baláž", "Szabó", "Molnár", "Lukáč", "Kollár", "Polák", "Šimko", "Bednár", "Urban", "Kubík",
        "Hudák", "Mazúr", "Oravec", "Sedlák", "Marek", "Kráľ", "Ondrej", "Pavlík", "Hric", "Kmeť", "Dudák", "Zeman", "Rybár", "Gajdoš"]

# code, name, department, semester (None = archived last year), credits, prerequisite codes, capacity, completion, scheme preset
SCHEMES = {
    "std": [("Assignments", 20, 8), ("Test", 20, 0), ("Exam", 60, 25)],  # name, max points, minimum to pass
    "proj": [("Project", 40, 16), ("Exam", 60, 25)],
    "cont": [("Assignments", 40, 15), ("Midterm test", 30, 10), ("Final test", 30, 10)],
}
COURSES = [
    ("KPI/PRG1", "Programming 1", "KPI", None, 6, [], 400, "exam", "std"), ("KPI/MAT1", "Mathematics 1", "KPI", None, 6, [], 400, "exam", "std"),
    ("KAI/DMA", "Discrete mathematics", "KAI", None, 5, [], 400, "exam", "std"), ("KE/CIR1", "Electrical circuits 1", "KE", None, 6, [], 400, "exam", "std"),
    ("KPI/CAS", "Computer architecture", "KPI", None, 5, [], 400, "exam", "std"),
    ("KPI/PRG2", "Programming 2", "KPI", "winter", 6, ["KPI/PRG1"], 90, "exam", "std"), ("KPI/ADS", "Algorithms and data structures", "KPI", "winter", 6, ["KPI/PRG1"], 80, "exam", "std"),
    ("KPI/DBS", "Database systems", "KPI", "winter", 5, ["KPI/PRG1"], 70, "exam", "proj"), ("KPI/NET", "Computer networks", "KPI", "winter", 5, [], 80, "exam", "std"),
    ("KPI/OSY", "Operating systems", "KPI", "winter", 5, ["KPI/CAS"], 70, "exam", "std"), ("KPI/SWE", "Software engineering", "KPI", "winter", 5, ["KPI/PRG1"], 60, "graded_credit", "cont"),
    ("KPI/WEB", "Web technologies", "KPI", "winter", 4, [], 50, "graded_credit", "cont"), ("KPI/SEC", "Information security", "KPI", "winter", 4, [], 60, "exam", "std"),
    ("KAI/ML1", "Machine learning 1", "KAI", "winter", 6, ["KPI/MAT1"], 50, "exam", "proj"), ("KAI/LOG", "Logic and reasoning", "KAI", "winter", 4, ["KAI/DMA"], 60, "exam", "std"),
    ("KAI/CVI", "Computer vision", "KAI", "winter", 5, ["KPI/MAT1"], 40, "exam", "proj"),
    ("KEMT/DSP", "Digital signal processing", "KEMT", "winter", 5, ["KPI/MAT1"], 50, "exam", "std"), ("KEMT/EMB", "Embedded systems", "KEMT", "winter", 6, ["KE/CIR1"], 40, "graded_credit", "cont"),
    ("KE/EMF", "Electromagnetic fields", "KE", "winter", 5, ["KPI/MAT1"], 50, "exam", "std"), ("KE/PWR", "Power electronics", "KE", "winter", 5, ["KE/CIR1"], 45, "exam", "std"),
    ("KPI/PRG3", "Advanced programming", "KPI", "summer", 5, ["KPI/PRG2"], 60, "exam", "std"), ("KPI/DST", "Distributed systems", "KPI", "summer", 5, ["KPI/NET"], 50, "exam", "proj"),
    ("KPI/MOB", "Mobile applications", "KPI", "summer", 4, [], 40, "graded_credit", "cont"), ("KAI/ML2", "Machine learning 2", "KAI", "summer", 6, ["KAI/ML1"], 40, "exam", "proj"),
    ("KAI/NLP", "Natural language processing", "KAI", "summer", 5, [], 40, "exam", "std"), ("KEMT/COM", "Digital communications", "KEMT", "summer", 5, [], 50, "exam", "std"),
]

TOPICS = ["Introduction and motivation", "Fundamental concepts", "Core techniques", "Case studies", "Design and analysis", "Tools and practice", "Advanced topics", "Revision"]
ALL = ("KPI", "KEMT", "KAI", "KE")
ROOMS = [(code, "", kind, cap, ALL) for code, kind, cap in ROOMS_DATA]  # every room is shared by all departments; narrow it under Rooms in the admin UI
DRAFT_COURSES = {"KPI/MOB", "KAI/NLP"}  # still being prepared by their teachers: students cannot see them yet
SLOTS = [("08:00", "09:40"), ("10:00", "11:40"), ("12:00", "13:40"), ("14:00", "15:40"), ("16:00", "17:40")]
YEAR, PREV_YEAR = "2026/2027", "2025/2026"


def ascii_name(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace(" ", "")


def female_surname(s: str) -> str:
    return s[:-1] + "á" if s.endswith("ý") else s + "ová" if not s.endswith("a") else s[:-1] + "ová"


def generate(db, n_students: int, seed: int) -> str:
    if settings.is_prod: return "Refusing to generate test data with ENV=production."
    if db.scalar(select(Course.id).where(Course.code == "KPI/PRG1")): return "Generated data is already present, nothing to do."
    rnd = random.Random(seed)
    pw = hash_password(settings.seed_admin_password)  # one hash for every account: bcrypt is slow on purpose
    inst = db.scalars(select(Institution).limit(1)).first()
    admin = db.scalars(select(User).where(User.role == Role.admin)).first() or db.scalars(select(User).where(User.role == Role.super_admin)).first()
    used_emails = set(db.scalars(select(User.email)))

    def make_user(first, last, role, dept=None, prog=None) -> User:
        base = f"{ascii_name(first)}.{ascii_name(last)}"
        email, n = f"{base}@educore.example", 1
        while email in used_emails:
            n += 1
            email = f"{base}{n}@educore.example"
        used_emails.add(email)
        u = User(email=email, password_hash=pw, first_name=first, last_name=last, role=role, department_id=dept.id if dept else None,
                 study_program_id=prog.id if prog else None, phone=f"+421 9{rnd.randint(10, 99)} {rnd.randint(100, 999)} {rnd.randint(100, 999)}")
        db.add(u)
        return u

    def person(female: bool | None = None):
        f = rnd.random() < 0.5 if female is None else female
        last = rnd.choice(LAST)
        return (rnd.choice(FIRST_F), female_surname(last)) if f else (rnd.choice(FIRST_M), last)

    # ---- organisation
    depts: dict[str, Department] = {}
    for code, name in DEPARTMENTS:
        d = db.scalars(select(Department).where(Department.code == code)).first() or Department(code=code, name=name)
        db.add(d); depts[code] = d
    db.flush()
    rooms: list[tuple[Room, set[str]]] = []
    for code, building, kind, cap, dcodes in ROOMS:
        room = db.scalars(select(Room).where(Room.code == code)).first() or Room(code=code, building=building, kind=kind, capacity=cap)
        db.add(room); db.flush()
        linked = set(db.scalars(select(RoomDepartment.department_id).where(RoomDepartment.room_id == room.id)))
        for dc in dcodes:
            if depts[dc].id not in linked: db.add(RoomDepartment(room_id=room.id, department_id=depts[dc].id))
        rooms.append((room, {depts[dc].id for dc in dcodes} | linked))
    db.flush()
    programs: list[tuple[StudyProgram, tuple[str, ...]]] = []
    for name, degree, credits, dcode, plan_depts in PROGRAMS:
        p = StudyProgram(name=name, degree=degree, credits_required=credits, department_id=depts[dcode].id); db.add(p); programs.append((p, plan_depts))
    db.flush()

    # ---- teachers (3 per department) and one more administrator
    teachers: dict[str, list[User]] = {c: [] for c in depts}
    for code, d in depts.items():
        for _ in range(3):
            f, l = person()
            u = make_user(f, l, Role.teacher, dept=d); teachers[code].append(u)
    db.flush()
    f, l = person()
    make_user(f, l, Role.admin, dept=None); db.flush()

    # ---- courses
    courses: dict[str, Course] = {}
    for i, (code, name, dcode, sem, credits, prereqs, cap, completion, scheme) in enumerate(COURSES):
        staff = teachers[dcode]
        guarantor = staff[i % len(staff)]
        c = Course(code=code, name=name, description=f"{name}: lectures with seminars and practical work. Generated demo course.", department_id=depts[dcode].id,
                   guarantor_id=guarantor.id, academic_year=PREV_YEAR if sem is None else YEAR, semester=Semester(sem or "winter"), credits=credits, capacity=cap,
                   completion=Completion(completion), grading_scheme=[{"name": n, "maxPoints": m, "minPoints": lo} for n, m, lo in SCHEMES[scheme]], syllabus=rnd.sample(TOPICS, 6),
                   archived=sem is None, group_count=1 if sem is None else 3 if cap >= 80 else 2 if cap >= 50 else 1, status="draft" if code in DRAFT_COURSES else "published")
        db.add(c); db.flush(); courses[code] = c
        for t in {guarantor.id, rnd.choice(staff).id}: db.add(CourseTeacher(course_id=c.id, user_id=t))
    for code, *_rest in COURSES:
        for pre in COURSES[[x[0] for x in COURSES].index(code)][5]: db.add(CoursePrerequisite(course_id=courses[code].id, prerequisite_id=courses[pre].id))
    db.flush()

    # ---- timetables without room or teacher clashes (per semester)
    # (semester, day, start, end, resource): rooms and teachers already booked, including sessions that existed before (the demo seed)
    booked: list[tuple[str, int, str, str, str]] = [
        (sem.value, ds.day_of_week, ds.start_time, ds.end_time, res) for ds, sem in db.execute(
            select(CourseSession, Course.semester).join(Course, Course.id == CourseSession.course_id).where(Course.archived.is_(False)))
        for res in (ds.room, ds.teacher_id) if res]
    def free(sem: str, d: int, start: str, end: str, *resources: str) -> bool:
        return not any(b[0] == sem and b[1] == d and b[2] < end and start < b[3] and b[4] in resources for b in booked)
    def place(c: Course, kind: str, teacher_id: str, group: int | None = None) -> None:
        # rooms of the course's department; prefer the matching kind and enough seats, relax both when nothing is free
        usable = [r for r, deps in rooms if c.department_id in deps and r.kind != RoomKind.online]
        want = RoomKind.lecture_hall if kind == "lecture" else RoomKind.lab if kind == "lab" else RoomKind.classroom
        tiers = [[r for r in usable if r.kind == want and r.capacity >= c.capacity], [r for r in usable if r.capacity >= c.capacity], usable]
        for tier in tiers:
            options = [(d, s, r.code) for d in range(1, 6) for s in range(len(SLOTS)) for r in tier]
            rnd.shuffle(options)
            for d, s, r in options:
                start, end = SLOTS[s]
                if not free(c.semester.value, d, start, end, r, teacher_id): continue
                booked.extend([(c.semester.value, d, start, end, r), (c.semester.value, d, start, end, teacher_id)])
                db.add(CourseSession(course_id=c.id, kind=kind, day_of_week=d, start_time=start, end_time=end, room=r, teacher_id=teacher_id, group_no=group))
                return
    for code, name, dcode, sem, *_ in COURSES:
        if sem is None: continue
        c = courses[code]
        place(c, "lecture", c.guarantor_id)
        kind2 = rnd.choice(["practical", "lab", "seminar"]) if rnd.random() < 0.8 else "lab"
        staff = list(db.scalars(select(CourseTeacher.user_id).where(CourseTeacher.course_id == c.id)))
        if c.group_count > 1:  # the practical is repeated for every group, each in its own slot and room
            for g in range(1, c.group_count + 1): place(c, kind2, rnd.choice(staff), g)
        else:
            place(c, kind2, rnd.choice(staff))
    db.flush()

    # ---- study plans
    plan_of: dict[str, set[str]] = {}
    for p, plan_depts in programs:
        ids = set()
        for code, name, dcode, sem, *_ in COURSES:
            if dcode in plan_depts or code == "KPI/MAT1":
                sno = 1 if sem is None else (3 if sem == "winter" else 4)
                db.add(StudyPlanItem(study_program_id=p.id, course_id=courses[code].id, semester_no=sno, required=rnd.random() < 0.75)); ids.add(code)
        plan_of[p.id] = ids
    db.flush()

    # ---- students: grades for last year's courses, enrollments for this winter's courses
    sessions_of: dict[str, list[CourseSession]] = {}
    for s in db.scalars(select(CourseSession)): sessions_of.setdefault(s.course_id, []).append(s)
    def overlaps(a: CourseSession, b: CourseSession) -> bool:
        return a.day_of_week == b.day_of_week and a.start_time < b.end_time and b.start_time < a.end_time
    taken: dict[str, int] = {}
    group_sizes: dict[str, dict[int, int]] = {}
    teacher_user = {t.id: t for ts in teachers.values() for t in ts}
    students: list[tuple[User, StudyProgram]] = []
    for i in range(n_students):
        p, _ = programs[i % len(programs)] if rnd.random() < 0.6 else rnd.choice(programs)
        f, l = person()
        u = make_user(f, l, Role.student, prog=p); db.flush(); students.append((u, p))
        passed: set[str] = set()
        base = rnd.gauss(80, 10)
        for code in sorted(plan_of[p.id]):
            c = courses[code]
            if not c.archived: continue
            frac = max(0.35, min(1.0, rnd.gauss(base, 12) / 100))
            comps = {s["name"]: max(0, min(s["maxPoints"], round(s["maxPoints"] * max(0, min(1, frac + rnd.uniform(-0.12, 0.12)))))) for s in c.grading_scheme}
            score, mark = compute_final(c.grading_scheme, comps)
            db.add(Enrollment(course_id=c.id, student_id=u.id)); db.add(Grade(course_id=c.id, student_id=u.id, components=comps, final_score=score, mark=mark,
                                                                              updated_by=c.guarantor_id))
            if mark != "FX": passed.add(code)
        mine: list[CourseSession] = []
        candidates = [code for code in sorted(plan_of[p.id]) if not courses[code].archived and courses[code].semester.value == "winter"
                      and all(pre in passed for pre in COURSES[[x[0] for x in COURSES].index(code)][5])]
        rnd.shuffle(candidates)
        for code in candidates[: rnd.randint(4, 6)]:
            c = courses[code]
            sizes = group_sizes.setdefault(c.id, {g: 0 for g in range(1, c.group_count + 1)})
            g = min(sizes, key=lambda x: (sizes[x], x))  # the emptiest group, like the API does
            its = [x for x in sessions_of.get(c.id, []) if x.group_no in (None, g)]
            if any(overlaps(a, b) for a in its for b in mine): continue
            full = taken.get(c.id, 0) >= c.capacity
            db.add(Enrollment(course_id=c.id, student_id=u.id, status=EnrollmentStatus.waitlisted if full else EnrollmentStatus.enrolled, group_no=None if full else g))
            if not full:
                sizes[g] += 1
                taken[c.id] = taken.get(c.id, 0) + 1; mine += its
                # mid-semester: the first one or two components are graded for most students
                k = rnd.choice([0, 1, 1, 2, 2])
                comps = {s["name"]: max(0, min(s["maxPoints"], round(s["maxPoints"] * max(0.2, min(1, rnd.gauss(base, 14) / 100)))))
                         for s in c.grading_scheme[:k]}
                if comps: db.add(Grade(course_id=c.id, student_id=u.id, components=comps, updated_by=c.guarantor_id))
    db.flush()

    # ---- exam terms (January and early February) and registrations
    day = datetime(2027, 1, 11)
    exam_busy: set[tuple[str, str, str]] = set()
    exams: list[ExamTerm] = []
    for code, name, dcode, sem, credits, prereqs, cap, completion, scheme in COURSES:
        c = courses[code]
        if c.archived or sem != "winter" or completion != "exam": continue
        for term in range(1, rnd.choice([2, 3]) + 1):
            for _ in range(60):
                date = (day + timedelta(days=rnd.randint(0, 24))).date()
                if date.weekday() > 4: continue
                t, room = rnd.choice(["09:00", "12:00", "14:30"]), rnd.choice([r.code for r, _d in rooms if r.kind not in (RoomKind.lab, RoomKind.online)])
                if (str(date), t, room) in exam_busy: continue
                exam_busy.add((str(date), t, room))
                x = ExamTerm(course_id=c.id, date=str(date), time=t, room=room, format=rnd.choice(["written", "written", "oral", "online"]), term=term,
                             capacity=rnd.choice([30, 40, 60]), registration_open=term == 1 or rnd.random() < 0.5)
                db.add(x); exams.append(x); break
    db.flush()
    by_course: dict[str, list[ExamTerm]] = {}
    for x in exams: by_course.setdefault(x.course_id, []).append(x)
    reg_count: dict[str, int] = {}
    held: dict[str, list[ExamTerm]] = {}
    for st in db.execute(select(Enrollment.student_id, Enrollment.course_id).where(Enrollment.status == EnrollmentStatus.enrolled)).all():
        terms = [x for x in by_course.get(st.course_id, []) if x.registration_open]
        if not terms or rnd.random() > 0.4: continue
        x = rnd.choice(terms)
        if reg_count.get(x.id, 0) >= x.capacity: continue
        if any(o.date == x.date and abs(int(o.time[:2]) - int(x.time[:2])) < 2 for o in held.get(st.student_id, [])): continue
        db.add(ExamRegistration(exam_id=x.id, student_id=st.student_id)); reg_count[x.id] = reg_count.get(x.id, 0) + 1; held.setdefault(st.student_id, []).append(x)

    # ---- announcements and calendar
    base_day = datetime(2026, 9, 10, 9, 0)
    institution_notes = [("Welcome to the new academic year", "Lectures start on Monday, 14 September. Check your timetable in the portal."),
                         ("Enrollment deadline", "Enrollment in winter courses closes on 20 September at 23:59."),
                         ("Library opening hours", "The library is open Monday to Friday from 8:00 to 20:00 during the semester."),
                         ("Scholarship applications", "Applications for the merit scholarship are accepted until 15 November."),
                         ("Planned system maintenance", "The portal will be unavailable on Saturday night from 22:00 to 02:00."),
                         ("Exam period schedule", "Exam terms for the winter semester are published. Register before the registration closes.")]
    for i, (title, body) in enumerate(institution_notes):
        db.add(Announcement(author_id=admin.id if admin else None, title=title, body=body, created_at=base_day + timedelta(days=i * 6, hours=i)))
    for c in courses.values():
        if c.archived or rnd.random() > 0.7: continue
        author = teacher_user.get(c.guarantor_id)
        db.add(Announcement(author_id=author.id if author else None, course_id=c.id, title=f"{c.name}: first assignment",
                            body="The first assignment is published. The deadline is in three weeks. Details are in the course materials.",
                            created_at=base_day + timedelta(days=rnd.randint(14, 45), hours=rnd.randint(0, 8))))
    db.flush()
    for a in db.scalars(select(Announcement)):  # roughly half of the students have read each announcement
        for st, _p in students:
            if rnd.random() < 0.5: db.add(AnnouncementRead(announcement_id=a.id, user_id=st.id))
    for title, kind, s, e in [("Winter semester", "semester", "2026-09-14", "2026-12-18"), ("Enrollment deadline", "deadline", "2026-09-20", None),
                              ("Rector's day (no classes)", "holiday", "2026-11-17", None), ("Christmas break", "holiday", "2026-12-21", "2027-01-03"),
                              ("Winter exam period", "exam period", "2027-01-11", "2027-02-05"), ("Summer semester", "semester", "2027-02-15", "2027-05-21"),
                              ("Summer enrollment opens", "deadline", "2027-02-01", None)]:
        db.add(CalendarEvent(title=title, kind=kind, starts_at=datetime.fromisoformat(s), ends_at=datetime.fromisoformat(e + "T23:59:00") if e else None,
                             created_by=admin.id if admin else None))
    db.commit()
    from .seed_rooms import remap
    remap(db)  # rooms by seat count: the smallest room that holds the enrolled students
    waiting = db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.status == EnrollmentStatus.waitlisted))
    return (f"Generated {len(COURSES)} courses, {sum(len(v) for v in teachers.values())} teachers, {n_students} students, {len(exams)} exam terms "
            f"({sum(reg_count.values())} registrations), {waiting} waitlisted enrollments. Password of all generated accounts: SEED_ADMIN_PASSWORD.")


if __name__ == "__main__":
    from . import models  # noqa: F401
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--students", type=int, default=150)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    Base.metadata.create_all(engine)
    with SessionLocal() as s:
        if not s.scalar(select(func.count()).select_from(Institution)): print(run_seed(s))
        print(generate(s, a.students, a.seed))
