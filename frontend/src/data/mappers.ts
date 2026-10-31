/** Turns API payloads (camelCase JSON, UUID ids) into the types the UI uses, and back. */
import type { AuthUser } from '../lib/api'
import type {
  CalendarEvent, ClassSession, CompletionType, Course, CourseDetailData, CourseDocument, CoursePrerequisite, DirectoryUser, Day, EnrollmentItem,
  Exam, ExamFormat, Mark, Notice, OrgUnit, PlatformSettings, Role, RosterRow, SessionType, StudentGrade, StudyPlan, StudyProgram, Teacher,
} from './types'

// The payloads are plain JSON; the mappers are the one place that knows their shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Dto = Record<string, any>

export const fullName = (first?: string | null, last?: string | null) => `${first ?? ''} ${last ?? ''}`.trim()

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

export const uiRole = (r: AuthUser['role']): Role => (r === 'teacher' ? 'instructor' : r === 'super_admin' ? 'superadmin' : r)
export const apiRole = (r: Role): AuthUser['role'] => (r === 'instructor' ? 'teacher' : r === 'superadmin' ? 'super_admin' : r)

const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const dayToNumber = (d: Day) => DAYS.indexOf(d) + 1

const SESSION_TYPE: Record<string, SessionType> = { lecture: 'Lecture', practical: 'Practical', lab: 'Lab', seminar: 'Seminar' }
export const sessionTypeToApi = (t: SessionType) => t.toLowerCase()

const COMPLETION: Record<string, CompletionType> = { exam: 'Exam', credit: 'Credit', graded_credit: 'Classified credit' }
export const COMPLETION_TO_API: Record<CompletionType, string> = { Exam: 'exam', Credit: 'credit', 'Classified credit': 'graded_credit' }

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

export function mapCourse(c: Dto): Course {
  const teachers = ((c.teachers ?? []) as Dto[]).map((t) => ({ id: t.id as string, name: fullName(t.firstName, t.lastName), isGuarantor: !!t.isGuarantor }))
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description ?? '',
    academicYear: c.academicYear,
    semester: c.semester === 'summer' ? 'Summer' : 'Winter',
    credits: c.credits,
    studentLimit: c.capacity,
    enrolled: c.enrolledCount ?? 0,
    waitlisted: c.waitlistCount ?? 0,
    teachers,
    teacherIds: teachers.map((t) => t.id),
    archived: !!c.archived,
    orgUnitId: c.departmentId ?? null,
    completionType: COMPLETION[c.completion] ?? 'Exam',
    gradingScheme: ((c.gradingScheme ?? []) as Dto[]).map((x) => ({ name: x.name, max: x.maxPoints, min: x.minPoints ?? 0 })),
    guarantorId: c.guarantorId ?? null,
    topics: c.syllabus ?? [],
  }
}

export function mapSession(s: Dto, courseId?: string): ClassSession {
  return {
    id: s.id,
    courseId: courseId ?? s.courseId,
    day: DAYS[(s.dayOfWeek as number) - 1] ?? 'Mon',
    start: s.startTime,
    end: s.endTime,
    type: SESSION_TYPE[s.kind] ?? 'Lecture',
    room: s.room,
    teacherId: s.teacherId ?? null,
  }
}

export function mapExam(x: Dto, courseId?: string): Exam {
  return {
    id: x.id,
    courseId: courseId ?? x.courseId,
    date: x.date,
    start: x.time,
    room: x.room,
    format: cap(x.format) as ExamFormat,
    term: x.term,
    capacity: x.capacity,
    registered: x.registered ?? 0,
    registration: x.registrationOpen ? 'open' : 'closed',
    registeredByMe: !!x.registeredByMe,
  }
}

export const markOf = (m: unknown): Mark | null => (typeof m === 'string' ? (m as Mark) : null)

export function mapGrade(g: Dto): StudentGrade {
  return { courseId: g.courseId, components: g.components ?? {}, finalScore: g.finalScore ?? null, mark: markOf(g.mark), updatedAt: g.updatedAt }
}

export function mapRosterRow(r: Dto): RosterRow {
  return {
    id: r.studentId,
    name: fullName(r.firstName, r.lastName),
    email: r.email,
    components: r.components ?? null,
    finalScore: r.finalScore ?? null,
    mark: markOf(r.mark),
  }
}

export function mapNotice(a: Dto): Notice {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    date: String(a.createdAt).slice(0, 10),
    author: a.authorName ?? 'Unknown author',
    scope: a.courseId ? 'course' : 'institution',
    courseId: a.courseId ?? undefined,
    read: !!a.read,
  }
}

export const mapEvent = (e: Dto): CalendarEvent => ({ id: e.id, title: e.title, kind: e.kind, start: e.startsAt, end: e.endsAt ?? undefined })

export const mapEnrollment = (e: Dto): EnrollmentItem => ({ id: e.id, courseId: e.courseId, status: e.status })

export const mapOrgUnit = (d: Dto): OrgUnit => ({ id: d.id, name: d.name, code: d.code })

export const mapProgram = (p: Dto): StudyProgram => ({
  id: p.id, name: p.name, degree: p.degree, creditsRequired: p.creditsRequired, orgUnitId: p.departmentId, students: p.students ?? 0,
})

export const mapTeacher = (t: Dto): Teacher => ({ id: t.id, name: fullName(t.firstName, t.lastName), orgUnitId: t.departmentId ?? null })

export function mapUser(u: Dto, units: OrgUnit[], programs: StudyProgram[]): DirectoryUser {
  const role = uiRole(u.role)
  const unit =
    role === 'instructor' ? (units.find((d) => d.id === u.departmentId)?.code ?? '-')
    : role === 'student' ? (programs.find((p) => p.id === u.studyProgramId)?.name ?? '-')
    : 'Study office'
  return {
    id: u.id, firstName: u.firstName, lastName: u.lastName, name: fullName(u.firstName, u.lastName), email: u.email, role, unit,
    active: !!u.active, departmentId: u.departmentId ?? null, studyProgramId: u.studyProgramId ?? null,
  }
}

export function mapPlatform(inst: Dto): PlatformSettings {
  return {
    institutionId: inst.id,
    userLimit: inst.maxUsers,
    usersUsed: inst.usage.users.used,
    storageLimitMb: inst.maxStorageMb,
    storageUsedMb: inst.usage.storage.usedBytes / (1024 * 1024),
  }
}

export function mapPlan(p: Dto): StudyPlan {
  return {
    programName: p.programName ?? null,
    creditsRequired: p.creditsRequired ?? null,
    creditsEarned: p.creditsEarned ?? 0,
    items: ((p.items ?? []) as Dto[]).map((i) => ({ courseId: i.courseId, semesterNo: i.semesterNo, mandatory: !!i.required, status: i.status, mark: markOf(i.mark) })),
  }
}

const mapPrereq = (r: Dto): CoursePrerequisite => ({ id: r.id, code: r.code, name: r.name })

export function mapCourseDetail(c: Dto): CourseDetailData {
  const base = mapCourse(c)
  const doc = (d: Dto): CourseDocument => ({ id: d.id, fileId: d.fileId, name: d.name, kind: d.kind === 'syllabus' ? 'Syllabus' : 'Material', sizeKb: Math.max(1, Math.round(d.size / 1024)) })
  return {
    ...base,
    prerequisites: ((c.prerequisites ?? []) as Dto[]).map(mapPrereq),
    sessions: ((c.sessions ?? []) as Dto[]).map((s) => mapSession(s, c.id)),
    documents: ((c.documents ?? []) as Dto[]).map(doc),
    exams: ((c.examTerms ?? []) as Dto[]).map((x) => mapExam(x, c.id)),
    canManage: !!c.canManage,
    myEnrollment: c.myEnrollment ?? null,
    myGrade: c.myGrade ? { components: c.myGrade.components ?? {}, finalScore: c.myGrade.finalScore ?? null, mark: markOf(c.myGrade.mark) } : null,
    missingPrerequisites: ((c.missingPrerequisites ?? []) as Dto[]).map(mapPrereq),
  }
}
