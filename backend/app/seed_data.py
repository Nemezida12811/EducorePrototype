"""python -m app.seed_data [--students 100] [--seed 1]

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
from .models import (Announcement, AnnouncementRead, CalendarEvent, Completion, Course, CourseDocument, CoursePrerequisite, CourseSession, CourseTeacher, Department,
                     DocKind, Enrollment, EnrollmentStatus, ExamRegistration, ExamTerm, Grade, GradeHistory, Institution, Notification, Role, Room, RoomDepartment, RoomKind,
                     Semester, StudyPlanItem, StudyProgram, User)
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
    "demo": [("Midterm", 30, 0), ("Project", 30, 0), ("Exam", 40, 15)],  # the demo seed's scheme (app/seed.py SCHEME)
}
# About 90 % of everything belongs to KPI (Department of Computers and Informatics): its courses, sessions, teachers and students.
# The other three departments keep one course each, so they are not empty.
COURSES = [
    # last year (archived): the common first year
    ("KPI/PRG1", "Programming 1", "KPI", None, 6, [], 400, "exam", "std"), ("KPI/MAT1", "Mathematics 1", "KPI", None, 6, [], 400, "exam", "std"),
    ("KPI/DMA", "Discrete mathematics", "KPI", None, 5, [], 400, "exam", "std"), ("KPI/CAS", "Computer architecture", "KPI", None, 5, [], 400, "exam", "std"),
    ("KE/CIR1", "Electrical circuits 1", "KE", None, 6, [], 400, "exam", "std"), ("OOP", "Object-oriented programming", "KPI", None, 5, [], 400, "exam", "demo"),
    # winter semester (active now)
    ("KPI/PRG2", "Programming 2", "KPI", "winter", 6, ["KPI/PRG1"], 90, "exam", "std"), ("ADS2", "Algorithms and data structures 2", "KPI", "winter", 6, ["OOP"], 80, "exam", "demo"),
    ("DB1", "Databases", "KPI", "winter", 5, [], 70, "exam", "demo"), ("KPI/NET", "Computer networks", "KPI", "winter", 5, [], 80, "exam", "std"),
    ("KPI/OSY", "Operating systems", "KPI", "winter", 5, ["KPI/CAS"], 70, "exam", "std"), ("KPI/SWE", "Software engineering", "KPI", "winter", 5, ["KPI/PRG1"], 60, "graded_credit", "cont"),
    ("KPI/WEB", "Web technologies", "KPI", "winter", 4, [], 50, "graded_credit", "cont"), ("KPI/SEC", "Information security", "KPI", "winter", 4, [], 60, "exam", "std"),
    ("KPI/LOG", "Logic and formal methods", "KPI", "winter", 4, ["KPI/DMA"], 50, "exam", "std"), ("KPI/CVI", "Computer vision", "KPI", "winter", 5, ["KPI/MAT1"], 40, "exam", "proj"),
    ("KPI/EMB", "Embedded systems programming", "KPI", "winter", 6, ["KPI/CAS"], 40, "graded_credit", "cont"),
    ("KPI/CMP", "Compilers", "KPI", "winter", 5, ["KPI/PRG1", "KPI/DMA"], 40, "exam", "std"), ("KPI/CGR", "Computer graphics", "KPI", "winter", 5, ["KPI/MAT1"], 40, "exam", "proj"),
    ("KPI/TST", "Software testing", "KPI", "winter", 4, ["KPI/PRG1"], 50, "graded_credit", "cont"), ("KPI/CLD", "Cloud computing", "KPI", "winter", 4, [], 50, "exam", "proj"),
    ("KPI/HCI", "Human-computer interaction", "KPI", "winter", 4, [], 40, "graded_credit", "cont"), ("KPI/FPR", "Functional programming", "KPI", "winter", 4, ["KPI/PRG1"], 40, "exam", "std"),
    ("KAI/ML1", "Machine learning 1", "KAI", "winter", 6, ["KPI/MAT1"], 50, "exam", "proj"), ("KEMT/DSP", "Digital signal processing", "KEMT", "winter", 5, ["KPI/MAT1"], 50, "exam", "std"),
    # summer semester (published, not running yet)
    ("KPI/PRG3", "Advanced programming", "KPI", "summer", 5, ["KPI/PRG2"], 60, "exam", "std"), ("KPI/DST", "Distributed systems", "KPI", "summer", 5, ["KPI/NET"], 50, "exam", "proj"),
    ("KPI/MOB", "Mobile applications", "KPI", "summer", 4, [], 40, "graded_credit", "cont"), ("KPI/ML2", "Deep learning", "KPI", "summer", 6, ["KAI/ML1"], 40, "exam", "proj"),
    ("KPI/NLP", "Natural language processing", "KPI", "summer", 5, [], 40, "exam", "std"), ("KPI/ITP", "IT project management", "KPI", "summer", 4, [], 60, "graded_credit", "cont"),
    ("KPI/BIG", "Big data processing", "KPI", "summer", 5, ["DB1"], 40, "exam", "proj"),
]

TOPICS = ["Introduction and motivation", "Fundamental concepts", "Core techniques", "Case studies", "Design and analysis", "Tools and practice", "Advanced topics", "Revision"]
ALL = ("KPI", "KEMT", "KAI", "KE")
ROOMS = [(code, "", kind, cap, ALL) for code, kind, cap in ROOMS_DATA]  # every room is shared by all departments; narrow it under Rooms in the admin UI
# OOP, ADS2 and DB1 come from the demo seed (app/seed.py): they are upgraded in place, so the quick sign-in accounts get full, realistic data.
# The demo teachers guarantee these courses (teacher1 is the quick sign-in teacher, student1 the quick sign-in student).
DEMO_GUARANTOR = {"OOP": "teacher1@educore.example", "ADS2": "teacher1@educore.example", "KPI/PRG2": "teacher1@educore.example", "KPI/OSY": "teacher1@educore.example",
                  "KPI/PRG3": "teacher1@educore.example", "DB1": "teacher2@educore.example", "KPI/SEC": "teacher2@educore.example", "KPI/WEB": "teacher2@educore.example",
                  "KPI/BIG": "teacher2@educore.example"}
DEMO_STUDENTS = ("student1@educore.example", "student2@educore.example", "student3@educore.example")
TEACHERS = {"KPI": 25, "KAI": 1, "KEMT": 1, "KE": 1}
KPI_SHARE = 0.9  # share of all students (the existing ones included) in KPI's study programs
DRAFT_COURSES = {"KPI/MOB", "KPI/NLP"}  # still being prepared by their teachers: students cannot see them yet
SLOTS = [("08:00", "09:40"), ("10:00", "11:40"), ("12:00", "13:40"), ("14:00", "15:40"), ("16:00", "17:40")]
YEAR, PREV_YEAR = "2026/2027", "2025/2026"


def ascii_name(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace(" ", "")


def female_surname(s: str) -> str:
    return s[:-1] + "á" if s.endswith("ý") else s + "ová" if not s.endswith("a") else s[:-1] + "ová"


def generate(db, n_students: int, seed: int) -> str:
    if settings.is_prod and not settings.seed_demo: return "Refusing to generate test data with ENV=production (set SEED_DEMO=true to allow it)."
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
    for p in db.scalars(select(StudyProgram).where(StudyProgram.department_id == depts["KPI"].id)):  # the demo seed's "Informatics" gets a full plan too
        if all(p is not q for q, _ in programs): programs.append((p, ("KPI",)))
    db.flush()

    # ---- teachers (KPI 25, the other departments 1 each: with the demo seed's two KPI teachers that is 27 of 30) and one more administrator
    teachers: dict[str, list[User]] = {c: [] for c in depts}
    for code, d in depts.items():
        for _ in range(TEACHERS.get(code, 1)):
            f, l = person()
            u = make_user(f, l, Role.teacher, dept=d); teachers[code].append(u)
    db.flush()
    f, l = person()
    make_user(f, l, Role.admin, dept=None); db.flush()
    by_email = {u.email: u for u in db.scalars(select(User).where(User.email.in_(set(DEMO_GUARANTOR.values()) | set(DEMO_STUDENTS) | {"admin@educore.example"})))}
    for u in by_email.values():  # the demo seed's accounts look like everybody else
        u.phone = u.phone or f"+421 9{rnd.randint(10, 99)} {rnd.randint(100, 999)} {rnd.randint(100, 999)}"
    demo_teachers = [u for u in by_email.values() if u.role == Role.teacher]

    # ---- courses
    courses: dict[str, Course] = {}
    per_dept: dict[str, int] = {}
    for i, (code, name, dcode, sem, credits, prereqs, cap, completion, scheme) in enumerate(COURSES):
        staff = teachers[dcode] + (demo_teachers if dcode == "KPI" else [])
        if code in DEMO_GUARANTOR and DEMO_GUARANTOR[code] in by_email: guarantor = by_email[DEMO_GUARANTOR[code]]
        else: guarantor = teachers[dcode][per_dept.get(dcode, 0) % len(teachers[dcode])]; per_dept[dcode] = per_dept.get(dcode, 0) + 1  # round robin inside the department
        fields = dict(name=name, description=f"{name}: lectures with seminars and practical work at the {dict(DEPARTMENTS)[dcode]}.", department_id=depts[dcode].id,
                      guarantor_id=guarantor.id, academic_year=PREV_YEAR if sem is None else YEAR, semester=Semester(sem or "winter"), credits=credits, capacity=cap,
                      completion=Completion(completion), syllabus=rnd.sample(TOPICS, 6), archived=sem is None,
                      group_count=1 if sem is None else 3 if cap >= 80 else 2 if cap >= 50 else 1, status="draft" if code in DRAFT_COURSES else "published")
        scheme_rows = [{"name": n, "maxPoints": m, "minPoints": lo} for n, m, lo in SCHEMES[scheme]]
        c = db.scalars(select(Course).where(Course.code == code)).first()
        if c:  # a demo seed course: same id (its enrollments and grades stay), realistic size, a fresh timetable and exam terms
            for k, v in fields.items(): setattr(c, k, v)
            if not db.scalar(select(Grade.id).where(Grade.course_id == c.id)): c.grading_scheme = scheme_rows
            for x in db.scalars(select(CourseSession).where(CourseSession.course_id == c.id)): db.delete(x)
            for x in db.scalars(select(ExamTerm).where(ExamTerm.course_id == c.id)):
                if not db.scalar(select(ExamRegistration.id).where(ExamRegistration.exam_id == x.id)): db.delete(x)
        else:
            c = Course(code=code, grading_scheme=scheme_rows, **fields); db.add(c)
        db.flush(); courses[code] = c
        have = set(db.scalars(select(CourseTeacher.user_id).where(CourseTeacher.course_id == c.id)))
        for t in {guarantor.id, rnd.choice(staff).id} - have: db.add(CourseTeacher(course_id=c.id, user_id=t))
    for code, *_rest in COURSES:
        have = set(db.scalars(select(CoursePrerequisite.prerequisite_id).where(CoursePrerequisite.course_id == courses[code].id)))
        for pre in COURSES[[x[0] for x in COURSES].index(code)][5]:
            if courses[pre].id not in have: db.add(CoursePrerequisite(course_id=courses[code].id, prerequisite_id=courses[pre].id))
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
                if not free(c.semester.value, d, start, end, r, teacher_id, c.id): continue  # c.id: a course's lecture and its practicals never overlap
                booked.extend([(c.semester.value, d, start, end, r), (c.semester.value, d, start, end, teacher_id)]
                              + ([(c.semester.value, d, start, end, c.id)] if kind == "lecture" or group is None else []))
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
        in_plan = set(db.scalars(select(StudyPlanItem.course_id).where(StudyPlanItem.study_program_id == p.id)))
        for code, name, dcode, sem, *_ in COURSES:
            if dcode in plan_depts or code == "KPI/MAT1":
                sno = 1 if sem is None else (3 if sem == "winter" else 4)
                if courses[code].id not in in_plan:
                    db.add(StudyPlanItem(study_program_id=p.id, course_id=courses[code].id, semester_no=sno, required=rnd.random() < 0.75))
                ids.add(code)
        plan_of[p.id] = ids
    db.flush()

    # ---- students: grades for last year's courses, then 4-5 active (enrolled, not waitlisted) winter courses each.
    # Courses of the student's own study plan come first, published winter courses of other departments fill the rest as electives.
    sessions_of: dict[str, list[CourseSession]] = {}
    for s in db.scalars(select(CourseSession)): sessions_of.setdefault(s.course_id, []).append(s)
    def overlaps(a: CourseSession, b: CourseSession) -> bool:
        return a.day_of_week == b.day_of_week and a.start_time < b.end_time and b.start_time < a.end_time
    active = [c for c in db.scalars(select(Course).where(Course.archived.is_(False), Course.status == "published", Course.semester == Semester.winter))]
    prereqs_of: dict[str, set[str]] = {}
    for cp in db.scalars(select(CoursePrerequisite)): prereqs_of.setdefault(cp.course_id, set()).add(cp.prerequisite_id)
    taken: dict[str, int] = {}
    group_sizes: dict[str, dict[int, int]] = {}
    for e in db.scalars(select(Enrollment).where(Enrollment.status == EnrollmentStatus.enrolled)):  # seats already used by the demo seed
        taken[e.course_id] = taken.get(e.course_id, 0) + 1
        if e.group_no: group_sizes.setdefault(e.course_id, {}).setdefault(e.group_no, 0); group_sizes[e.course_id][e.group_no] += 1
    teacher_user = {t.id: t for ts in teachers.values() for t in ts} | {t.id: t for t in demo_teachers}
    plan_ids = {p.id: {courses[c].id for c in codes} for p, codes in ((p, plan_of[p.id]) for p, _ in programs)}

    def partial_grade(u: User, c: Course, level: float, k: int | None = None) -> None:
        """Mid-semester: the first one or two components are graded for most students (with history and a notification, like the API does)."""
        k = min(rnd.choice([0, 1, 1, 2, 2]) if k is None else k, len(c.grading_scheme) - 1)  # the final component (the exam) is still ahead
        comps = {s["name"]: max(0, min(s["maxPoints"], round(s["maxPoints"] * max(0.2, min(1, rnd.gauss(level, 14) / 100))))) for s in c.grading_scheme[:k]}
        if not comps or db.scalar(select(Grade.id).where(Grade.course_id == c.id, Grade.student_id == u.id)): return
        g = Grade(course_id=c.id, student_id=u.id, components=comps, updated_by=c.guarantor_id); db.add(g); db.flush()
        when = datetime(2026, 10, 12, 10) + timedelta(days=rnd.randint(0, 34), hours=rnd.randint(0, 8))
        db.add(GradeHistory(grade_id=g.id, changed_by=c.guarantor_id, before=None, after={"components": comps, "finalScore": None, "mark": None}, changed_at=when))
        db.add(Notification(user_id=u.id, title=f"Grade updated: {c.name}", body="A grade component was entered.", created_at=when,
                            read_at=when + timedelta(hours=rnd.randint(1, 48)) if rnd.random() < 0.7 else None))

    def settle_existing(u: User, level: float) -> None:
        """The demo seed's enrollments after its courses got a new timetable: a clash-free group, promotion from the waitlist when a seat is free, partial grades."""
        mine: list[CourseSession] = []
        for e in db.scalars(select(Enrollment).where(Enrollment.student_id == u.id).order_by(Enrollment.created_at)):
            c = db.get(Course, e.course_id)
            if c.archived or e.status not in (EnrollmentStatus.enrolled, EnrollmentStatus.waitlisted): continue
            if e.status == EnrollmentStatus.waitlisted and taken.get(c.id, 0) >= c.capacity: continue
            sizes = group_sizes.setdefault(c.id, {})
            options = sorted(range(1, max(1, c.group_count) + 1), key=lambda g: (g != e.group_no, sizes.get(g, 0), g))
            fit = next((g for g in options if not any(overlaps(x, y) for x in sessions_of.get(c.id, []) if x.group_no in (None, g) for y in mine)), None)
            was = e.group_no if e.status == EnrollmentStatus.enrolled else None
            if was: sizes[was] = sizes.get(was, 1) - 1; taken[c.id] = taken.get(c.id, 1) - 1
            if fit is None: db.delete(e); continue  # cannot attend it any more: the top-up below finds another course
            e.status, e.group_no = EnrollmentStatus.enrolled, fit
            sizes[fit] = sizes.get(fit, 0) + 1; taken[c.id] = taken.get(c.id, 0) + 1
            mine += [x for x in sessions_of.get(c.id, []) if x.group_no in (None, fit)]
            partial_grade(u, c, level, k=rnd.choice([1, 2]))
        db.flush()

    def enroll_up_to(u: User, target: int, plan: set[str], passed: set[str], level: float, waitlist_chance: float = 0.15) -> None:
        """Enroll u in active courses until it has `target` of them: no timetable clash, prerequisites passed, a free seat in some group."""
        mine_ids = set(db.scalars(select(Enrollment.course_id).where(Enrollment.student_id == u.id)))
        mine: list[CourseSession] = []
        have = 0
        for e in db.scalars(select(Enrollment).where(Enrollment.student_id == u.id, Enrollment.status == EnrollmentStatus.enrolled)):
            c = db.get(Course, e.course_id)
            if c.archived: continue
            have += 1; mine += [x for x in sessions_of.get(c.id, []) if x.group_no in (None, e.group_no)]
        def attempt():
            own = [c for c in active if c.id in plan]; other = [c for c in active if c.id not in plan]
            rnd.shuffle(own); rnd.shuffle(other)
            picks, waits, sess, n, used = [], [], list(mine), have, dict(taken)
            for c in own + other:
                if n >= target: break
                if c.id in mine_ids or not prereqs_of.get(c.id, set()) <= passed: continue
                if used.get(c.id, 0) >= c.capacity:  # full: sometimes the student queues up anyway (does not count towards the target)
                    if rnd.random() < waitlist_chance: waits.append(c)
                    continue
                sizes = {g: group_sizes.get(c.id, {}).get(g, 0) for g in range(1, max(1, c.group_count) + 1)}
                for g in sorted(sizes, key=lambda x: (sizes[x], x)):  # the emptiest group without a clash, like the API does
                    its = [x for x in sessions_of.get(c.id, []) if x.group_no in (None, g)]
                    if any(overlaps(x, y) for x in its for y in sess): continue
                    picks.append((c, g)); sess += its; used[c.id] = used.get(c.id, 0) + 1; n += 1
                    break
            return picks, waits, n
        best = None
        for _ in range(30):  # greedy picking can paint itself into a corner: reshuffle a few times
            r = attempt()
            if best is None or r[2] > best[2]: best = r
            if r[2] >= target: break
        picks, waits, _n = best
        for c in waits: db.add(Enrollment(course_id=c.id, student_id=u.id, status=EnrollmentStatus.waitlisted))
        for c, g in picks:
            db.add(Enrollment(course_id=c.id, student_id=u.id, status=EnrollmentStatus.enrolled, group_no=g))
            sizes = group_sizes.setdefault(c.id, {}); sizes[g] = sizes.get(g, 0) + 1; taken[c.id] = taken.get(c.id, 0) + 1
            partial_grade(u, c, level, k=rnd.choice([1, 2]) if u.email in DEMO_STUDENTS else None)  # the quick sign-in students: something in every course
        db.flush()

    def first_year(u: User, level: float) -> set[str]:
        """Final grades for the common first year (last year's courses, every program); returns the ids of the passed ones."""
        passed: set[str] = set()
        done = set(db.scalars(select(Enrollment.course_id).where(Enrollment.student_id == u.id)))
        for code in sorted(c[0] for c in COURSES if c[3] is None):
            c = courses[code]
            if c.id in done: continue  # already graded by the demo seed (student1's OOP)
            frac = max(0.35, min(1.0, rnd.gauss(level, 12) / 100))
            comps = {s["name"]: max(0, min(s["maxPoints"], round(s["maxPoints"] * max(0, min(1, frac + rnd.uniform(-0.12, 0.12)))))) for s in c.grading_scheme}
            score, mark = compute_final(c.grading_scheme, comps)
            if mark == "FX" and len(passed) < len([x for x in COURSES if x[3] is None and x[0] < code]):  # one failure at most: the rest were passed on a resit
                comps = {s["name"]: max(comps[s["name"]], s["minPoints"] + rnd.randint(0, 4)) for s in c.grading_scheme}
                need = 51 + rnd.randint(0, 8) - sum(comps.values())  # E or D: just enough to pass
                if need > 0: comps[c.grading_scheme[-1]["name"]] = min(c.grading_scheme[-1]["maxPoints"], comps[c.grading_scheme[-1]["name"]] + need)
                score, mark = compute_final(c.grading_scheme, comps)
            db.add(Enrollment(course_id=c.id, student_id=u.id)); db.add(Grade(course_id=c.id, student_id=u.id, components=comps, final_score=score, mark=mark,
                                                                              updated_by=c.guarantor_id))
            if mark != "FX": passed.add(c.id)
        db.flush()
        return passed

    # the students that already exist (the demo seed's student1-3) get topped up too
    existing = list(db.scalars(select(User).where(User.role == Role.student)))
    for u in existing:
        level = rnd.gauss(80, 10)
        passed = {g.course_id for g in db.scalars(select(Grade).where(Grade.student_id == u.id)) if g.mark and g.mark != "FX"}
        passed |= first_year(u, level)
        settle_existing(u, level)
        enroll_up_to(u, 5 if u.email in DEMO_STUDENTS else rnd.choice([4, 5]), plan_ids.get(u.study_program_id, set()), passed, level, waitlist_chance=0)
    n_new = max(0, n_students - len(existing))
    students: list[tuple[User, StudyProgram]] = [(u, None) for u in existing]
    kpi = depts["KPI"].id
    kpi_programs = [p for p, _ in programs if p.department_id == kpi]; other_programs = [p for p, _ in programs if p.department_id != kpi]
    kpi_existing = sum(1 for u in existing if u.department_id == kpi)
    n_kpi = max(0, min(n_new, round(KPI_SHARE * max(n_students, len(existing))) - kpi_existing))
    for i in range(n_new):
        p = kpi_programs[i % len(kpi_programs)] if i < n_kpi else other_programs[i % len(other_programs)]
        f, l = person()
        u = make_user(f, l, Role.student, prog=p); u.department_id = p.department_id; db.flush(); students.append((u, p))
        base = rnd.gauss(80, 10)
        passed = first_year(u, base)
        db.flush()
        enroll_up_to(u, rnd.choice([4, 4, 5]), plan_ids[p.id], passed, base)
    short = [u.email for u, _ in students
             if db.scalar(select(func.count()).select_from(Enrollment).join(Course, Course.id == Enrollment.course_id)
                          .where(Enrollment.student_id == u.id, Enrollment.status == EnrollmentStatus.enrolled, Course.archived.is_(False))) < 4]
    if short: print(f"Warning: {len(short)} students have fewer than 4 active courses (no free seats or clash-free slots): {', '.join(short[:5])}")

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
    demo_ids = {u.id for u in by_email.values() if u.role == Role.student}
    reg_count: dict[str, int] = {}
    held: dict[str, list[ExamTerm]] = {}
    for st in db.execute(select(Enrollment.student_id, Enrollment.course_id).where(Enrollment.status == EnrollmentStatus.enrolled)).all():
        terms = [x for x in by_course.get(st.course_id, []) if x.registration_open]
        if not terms or rnd.random() > (0.9 if st.student_id in demo_ids else 0.4): continue
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
    course_notes = [("first assignment", "The first assignment is published. The deadline is in three weeks. Details are in the course materials.", (14, 30)),
                    ("midterm test", "The midterm test takes place in week 7 during the lecture. Bring your student ID; no notes are allowed.", (31, 45)),
                    ("results published", "Points from the latest assessment are in the portal. Consultations are on Thursday after the lecture.", (46, 63)),
                    ("exam terms", "Exam terms for January and February are published. Register in the portal at least three days before the term.", (64, 66))]
    enrolled_in: dict[str, list[str]] = {}
    for e in db.scalars(select(Enrollment).where(Enrollment.status == EnrollmentStatus.enrolled)): enrolled_in.setdefault(e.course_id, []).append(e.student_id)
    for c in courses.values():
        if c.archived or c.status != "published" or c.semester != Semester.winter: continue
        author = teacher_user.get(c.guarantor_id)
        demo = author in demo_teachers
        for title, body, (lo, hi) in course_notes:
            if not demo and rnd.random() > 0.55: continue  # the demo teachers' courses get the whole series
            when = base_day + timedelta(days=rnd.randint(lo, hi), hours=rnd.randint(0, 8))
            if when > datetime(2026, 11, 16, 8): continue  # nothing from the future
            db.add(Announcement(author_id=author.id if author else None, course_id=c.id, title=f"{c.name}: {title}", body=body, created_at=when))
            for sid in enrolled_in.get(c.id, []):  # the API notifies the enrolled students
                db.add(Notification(user_id=sid, title=f"New announcement: {c.name}: {title}", body=body[:200], created_at=when,
                                    read_at=when + timedelta(hours=rnd.randint(1, 72)) if rnd.random() < 0.6 else None))
        if author:  # teachers' own inbox: enrollment summary and exam registrations
            n = len(enrolled_in.get(c.id, []))
            db.add(Notification(user_id=author.id, title=f"Enrollment closed: {c.name}", body=f"{n} students are enrolled in {c.group_count} group(s).",
                                created_at=datetime(2026, 9, 21, 7, 30), read_at=datetime(2026, 9, 21, 9, 12)))
            if c.completion == Completion.exam:
                db.add(Notification(user_id=author.id, title=f"Exam registration opened: {c.name}", body="Students can now register for the published exam terms.",
                                    created_at=datetime(2026, 11, 9, 8, 0), read_at=None if demo else datetime(2026, 11, 9, 13, 0)))
    db.flush()

    # ---- course documents: a syllabus and lecture notes (small generated PDFs) for every running course
    from .pdf import Doc
    from .services import save_file
    dept_name = {d.id: d.name for d in depts.values()}
    for c in courses.values():
        if c.archived or c.status != "published" or c.semester != Semester.winter: continue
        if db.scalar(select(CourseDocument.id).where(CourseDocument.course_id == c.id)): continue
        author = teacher_user.get(c.guarantor_id)
        d = Doc(); d.line(f"{c.code} – {c.name}", 16, True, 10)
        d.line(f"{dept_name.get(c.department_id, '')} · {c.academic_year}, {c.semester.value} semester · {c.credits} ECTS", 10, gap=14)
        if author: d.line(f"Guarantor: {author.first_name} {author.last_name} ({author.email})", gap=14)
        d.line("Weekly topics", 12, True, 6)
        for i, t in enumerate(c.syllabus or [], 1): d.line(f"{i}. {t}")
        d.space(); d.line("Assessment", 12, True, 6)
        for comp in c.grading_scheme: d.line(f"{comp['name']}: up to {comp['maxPoints']} points" + (f", at least {comp['minPoints']} required" if comp.get("minPoints") else ""))
        d.line("Final mark: A 91–100, B 81–90, C 71–80, D 61–70, E 51–60, FX below 51 points.", gap=10)
        f = save_file(db, d.render(), author.id if author else None, f"{c.code.replace('/', '-')} syllabus.pdf", "application/pdf")
        db.add(CourseDocument(course_id=c.id, file_id=f.id, kind=DocKind.syllabus))
        for week, topic in list(enumerate(c.syllabus or [], 1))[:rnd.randint(2, 4)]:
            d = Doc(); d.line(f"{c.name}", 14, True, 8); d.line(f"Lecture {week}: {topic}", 12, True, 12)
            for para in ("Goals of the lecture and how it connects to the previous one.", "Key definitions with examples from practice.",
                         "Worked example solved step by step.", "Exercises for the seminar and recommended reading."):
                d.line(f"• {para}")
            f = save_file(db, d.render(), author.id if author else None, f"{c.code.replace('/', '-')} lecture {week:02d}.pdf", "application/pdf")
            db.add(CourseDocument(course_id=c.id, file_id=f.id, kind=DocKind.material))
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
    return (f"Generated {len(COURSES)} courses, {sum(len(v) for v in teachers.values())} teachers, {len(students)} students ({n_new} new), {len(exams)} exam terms "
            f"({sum(reg_count.values())} registrations), {waiting} waitlisted enrollments. Password of all generated accounts: SEED_ADMIN_PASSWORD.")


if __name__ == "__main__":
    from . import models  # noqa: F401
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--students", type=int, default=100, help="total number of students after generation (the existing ones count)")
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    Base.metadata.create_all(engine)
    with SessionLocal() as s:
        if not s.scalar(select(func.count()).select_from(Institution)): print(run_seed(s))
        print(generate(s, a.students, a.seed))
