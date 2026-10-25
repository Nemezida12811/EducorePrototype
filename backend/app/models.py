import enum
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def uid() -> str: return str(uuid.uuid4())
def now() -> datetime: return datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC (SQLite has no tz)
def iso(d: datetime | None) -> str | None: return d.isoformat(timespec="milliseconds") + "Z" if d else None
def camel(s: str) -> str: return re.sub(r"_([a-z])", lambda m: m.group(1).upper(), s)


class Role(str, enum.Enum): student = "student"; teacher = "teacher"; admin = "admin"; super_admin = "super_admin"
class SessionKind(str, enum.Enum): lecture = "lecture"; practical = "practical"; lab = "lab"; seminar = "seminar"
class Completion(str, enum.Enum): exam = "exam"; credit = "credit"; graded_credit = "graded_credit"
class Semester(str, enum.Enum): winter = "winter"; summer = "summer"
class EnrollmentStatus(str, enum.Enum): enrolled = "enrolled"; waitlisted = "waitlisted"
class DocKind(str, enum.Enum): syllabus = "syllabus"; material = "material"


def E(e): return Enum(e, native_enum=False, length=20)


class Serializable:
    __table__: Any
    def d(self, exclude: tuple[str, ...] = ()) -> dict:
        """camelCase dict of the row's columns (datetimes -> ISO-8601 Z, enums -> values)."""
        out = {}
        for c in self.__table__.columns:
            if c.name in exclude: continue
            v = getattr(self, c.name)
            out[camel(c.name)] = iso(v) if isinstance(v, datetime) else (v.value if isinstance(v, enum.Enum) else v)
        return out


class Institution(Base, Serializable):
    """Single-institution deployment: exactly one row. Also holds platform limits."""
    __tablename__ = "institutions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200))
    domain: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="active")
    plan: Mapped[str] = mapped_column(String(50), default="standard")
    plan_renews_at: Mapped[datetime | None] = mapped_column(DateTime)
    max_users: Mapped[int] = mapped_column(Integer, default=5000)
    max_storage_mb: Mapped[int] = mapped_column(Integer, default=10240)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Department(Base, Serializable):
    __tablename__ = "departments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(200))


class StudyProgram(Base, Serializable):
    __tablename__ = "study_programs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200))
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"))
    degree: Mapped[str] = mapped_column(String(20), default="Bc.")
    credits_required: Mapped[int] = mapped_column(Integer, default=180)


class User(Base, Serializable):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str | None] = mapped_column(Text)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(E(Role), default=Role.student)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    study_program_id: Mapped[str | None] = mapped_column(ForeignKey("study_programs.id"))
    notification_channels: Mapped[dict] = mapped_column(JSON, default=lambda: {"email": True, "inApp": True, "push": False})
    totp_secret: Mapped[str | None] = mapped_column(Text)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    anonymized_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    def public(self) -> dict:
        d = self.d(exclude=("password_hash", "totp_secret", "totp_enabled", "anonymized_at"))
        d["twoFactorEnabled"] = self.totp_enabled
        return d


class RefreshToken(Base, Serializable):
    __tablename__ = "refresh_tokens"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_agent: Mapped[str | None] = mapped_column(Text)
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    last_used_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)


class PasswordReset(Base):
    __tablename__ = "password_resets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime)


class Course(Base, Serializable):
    __tablename__ = "courses"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    guarantor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    academic_year: Mapped[str] = mapped_column(String(9))
    semester: Mapped[Semester] = mapped_column(E(Semester))
    credits: Mapped[int] = mapped_column(Integer, default=5)
    capacity: Mapped[int] = mapped_column(Integer, default=30)
    completion: Mapped[Completion] = mapped_column(E(Completion), default=Completion.exam)
    grading_scheme: Mapped[list] = mapped_column(JSON)  # [{name, maxPoints}]
    syllabus: Mapped[list] = mapped_column(JSON, default=list)
    archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class CourseTeacher(Base):
    __tablename__ = "course_teachers"
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class CoursePrerequisite(Base):
    __tablename__ = "course_prerequisites"
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)
    prerequisite_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True)


class CourseSession(Base, Serializable):
    __tablename__ = "course_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    kind: Mapped[SessionKind] = mapped_column(E(SessionKind))
    day_of_week: Mapped[int] = mapped_column(Integer)  # 1 = Monday
    start_time: Mapped[str] = mapped_column(String(5))
    end_time: Mapped[str] = mapped_column(String(5))
    room: Mapped[str] = mapped_column(String(50))
    teacher_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))


class StudyPlanItem(Base):
    __tablename__ = "study_plan_items"
    __table_args__ = (UniqueConstraint("study_program_id", "course_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    study_program_id: Mapped[str] = mapped_column(ForeignKey("study_programs.id", ondelete="CASCADE"))
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    semester_no: Mapped[int] = mapped_column(Integer)
    required: Mapped[bool] = mapped_column(Boolean, default=True)


class Enrollment(Base, Serializable):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("course_id", "student_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[EnrollmentStatus] = mapped_column(E(EnrollmentStatus), default=EnrollmentStatus.enrolled)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Grade(Base, Serializable):
    __tablename__ = "grades"
    __table_args__ = (UniqueConstraint("course_id", "student_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    components: Mapped[dict] = mapped_column(JSON, default=dict)
    final_score: Mapped[int | None] = mapped_column(Integer)
    mark: Mapped[str | None] = mapped_column(String(2))
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class GradeHistory(Base, Serializable):
    __tablename__ = "grade_history"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    grade_id: Mapped[str] = mapped_column(ForeignKey("grades.id", ondelete="CASCADE"))
    changed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    before: Mapped[dict | None] = mapped_column(JSON)
    after: Mapped[dict] = mapped_column(JSON)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ExamTerm(Base, Serializable):
    __tablename__ = "exam_terms"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    date: Mapped[str] = mapped_column(String(10))
    time: Mapped[str] = mapped_column(String(5))
    room: Mapped[str] = mapped_column(String(50))
    format: Mapped[str] = mapped_column(String(20), default="written")
    term: Mapped[int] = mapped_column(Integer, default=1)
    capacity: Mapped[int] = mapped_column(Integer, default=30)
    registration_open: Mapped[bool] = mapped_column(Boolean, default=True)


class File(Base, Serializable):
    __tablename__ = "files"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    storage_key: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class CourseDocument(Base):
    __tablename__ = "course_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    file_id: Mapped[str] = mapped_column(ForeignKey("files.id", ondelete="CASCADE"))
    kind: Mapped[DocKind] = mapped_column(E(DocKind), default=DocKind.material)


class Announcement(Base, Serializable):
    __tablename__ = "announcements"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    author_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    course_id: Mapped[str | None] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Notification(Base, Serializable):
    __tablename__ = "notifications"
    __table_args__ = (Index("notif_user_idx", "user_id", "created_at"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    read_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class CalendarEvent(Base, Serializable):
    __tablename__ = "calendar_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(30), default="deadline")
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class AuditLog(Base, Serializable):
    __tablename__ = "audit_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    actor_id: Mapped[str | None] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(80))
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    ip: Mapped[str | None] = mapped_column(String(64))
    at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)


class ApiKey(Base, Serializable):
    __tablename__ = "api_keys"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(100))
    prefix: Mapped[str] = mapped_column(String(12), unique=True)
    key_hash: Mapped[str] = mapped_column(String(64))
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)


class Webhook(Base, Serializable):
    __tablename__ = "webhooks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    url: Mapped[str] = mapped_column(Text)
    secret: Mapped[str] = mapped_column(String(80))
    events: Mapped[list] = mapped_column(JSON)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Invoice(Base, Serializable):
    __tablename__ = "invoices"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    external_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    number: Mapped[str | None] = mapped_column(String(50))
    amount_cents: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="eur")
    status: Mapped[str] = mapped_column(String(20))
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=now)
