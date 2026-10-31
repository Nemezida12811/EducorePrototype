/** Everything that changes data goes through here: call the API, then refresh the stores the change touches. */
import { api, ApiError, upload } from '../lib/api'
import { COMPLETION_TO_API, dayToNumber, sessionTypeToApi, apiRole, type Dto } from './mappers'
import {
  refreshAllSessions, refreshCourses, refreshDirectory, refreshEnrollments, refreshEvents, refreshExams, refreshNotices, refreshOrg,
  refreshPlan, refreshPlatform, refreshSessions, loadRoster,
} from './load'
import { noticesStore } from './stores'
import type { ClassSession, CompletionType, ExamFormat, GradingComponent, Role, Term } from './types'

export const errorMessage = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong. Try again.')

// ---------- enrollment ----------
const refreshStudentData = () => Promise.all([refreshEnrollments(), refreshCourses(), refreshSessions(), refreshExams(), refreshPlan()])

export async function enroll(courseId: string): Promise<'enrolled' | 'waitlisted'> {
  const e = await api<Dto>('/enrollments', { method: 'POST', json: { courseId } })
  await refreshStudentData()
  return e.status
}

export async function withdraw(enrollmentId: string) {
  await api(`/enrollments/${enrollmentId}`, { method: 'DELETE' })
  await refreshStudentData()
}

// ---------- exams ----------
export async function registerForExam(examId: string) {
  await api(`/exams/${examId}/registration`, { method: 'POST' })
  await refreshExams()
}

export async function cancelExamRegistration(examId: string) {
  await api(`/exams/${examId}/registration`, { method: 'DELETE' })
  await refreshExams()
}

export interface ExamInput {
  date: string
  time: string
  room: string
  format: ExamFormat
  term: number
  capacity: number
  registrationOpen: boolean
}

export async function addExam(courseId: string, x: ExamInput) {
  await api(`/courses/${courseId}/exams`, { method: 'POST', json: { ...x, format: x.format.toLowerCase() } })
  await refreshExams()
}

export async function deleteExam(examId: string) {
  await api(`/exams/${examId}`, { method: 'DELETE' })
  await refreshExams()
}

// ---------- notices ----------
export async function setNoticeRead(id: string, read: boolean) {
  noticesStore.set((prev) => prev.map((n) => (n.id === id ? { ...n, read } : n)))
  try {
    await api(`/announcements/${id}/read`, { method: read ? 'PUT' : 'DELETE' })
  } catch (e) {
    await refreshNotices()
    throw e
  }
}

export async function markAllNoticesRead() {
  noticesStore.set((prev) => prev.map((n) => ({ ...n, read: true })))
  try {
    await api('/announcements/read-all', { method: 'POST' })
  } catch (e) {
    await refreshNotices()
    throw e
  }
}

export async function publishNotice(n: { title: string; body: string; courseId?: string }) {
  await api('/announcements', { method: 'POST', json: n })
  await refreshNotices()
}

// ---------- courses ----------
export interface CourseInput {
  code: string
  name: string
  description: string
  departmentId: string | null
  guarantorId: string | null
  academicYear: string
  semester: Term
  credits: number
  capacity: number
  completion: CompletionType
  syllabus: string[]
  teacherIds: string[]
  prerequisiteIds: string[]
  /** Send it when creating, or when editing a course whose scheme changed (the API locks it once grades exist). */
  gradingScheme?: GradingComponent[]
}

/** A timetable row in the course form. Ids of rows that already exist are the API's; new rows have ids starting with "new-". */
export interface SessionDraft extends Omit<ClassSession, 'courseId'> {}
export const isNewDraft = (d: { id: string }) => d.id.startsWith('new-')

const sessionBody = (d: SessionDraft, teacherId: string | null) => ({
  kind: sessionTypeToApi(d.type),
  dayOfWeek: dayToNumber(d.day),
  startTime: d.start,
  endTime: d.end,
  room: d.room.trim(),
  teacherId,
})

export interface SaveCourseResult {
  id: string
  /** Sessions that could not be saved (the course itself was). */
  problems: string[]
}

/** Creates or updates a course, then brings its timetable in line with the form. */
export async function saveCourse(
  courseId: string | null,
  input: CourseInput,
  drafts: SessionDraft[],
  existingSessionIds: string[],
  saveTimetable: boolean,
): Promise<SaveCourseResult> {
  const { gradingScheme, completion, capacity, ...rest } = input
  const body = {
    ...rest,
    capacity,
    semester: rest.semester.toLowerCase(), // the API expects 'winter' | 'summer'
    completion: COMPLETION_TO_API[completion],
    ...(gradingScheme ? { gradingScheme: gradingScheme.map((c) => ({ name: c.name, maxPoints: c.max, minPoints: c.min })) } : {}),
  }
  const saved = courseId
    ? await api<Dto>(`/courses/${courseId}`, { method: 'PUT', json: body })
    : await api<Dto>('/courses', { method: 'POST', json: body })
  const id = saved.id as string
  const problems: string[] = []

  if (saveTimetable) {
    const teacherFor = (d: SessionDraft) => (d.teacherId && input.teacherIds.includes(d.teacherId) ? d.teacherId : input.guarantorId)
    // Removals first so a moved session can take over a freed slot.
    for (const sid of existingSessionIds.filter((x) => !drafts.some((d) => d.id === x))) {
      await api(`/sessions/${sid}`, { method: 'DELETE' }).catch((e) => problems.push(errorMessage(e)))
    }
    for (const [i, d] of drafts.entries()) {
      try {
        if (isNewDraft(d)) await api(`/courses/${id}/sessions`, { method: 'POST', json: sessionBody(d, teacherFor(d)) })
        else await api(`/sessions/${d.id}`, { method: 'PUT', json: sessionBody(d, teacherFor(d)) })
      } catch (e) {
        problems.push(`Session ${i + 1}: ${errorMessage(e)}`)
      }
    }
  }
  await Promise.all([refreshCourses(), refreshSessions(), refreshAllSessions().catch(() => undefined), refreshExams()])
  return { id, problems }
}

export async function setCourseArchived(courseId: string, archived: boolean) {
  if (archived) await api(`/courses/${courseId}`, { method: 'DELETE' })
  else await api(`/courses/${courseId}/restore`, { method: 'POST' })
  await Promise.all([refreshCourses(), refreshSessions(), refreshExams()])
}

export async function uploadCourseDocument(courseId: string, file: File, kind: 'syllabus' | 'material') {
  await upload(`/courses/${courseId}/documents?kind=${kind}`, file)
}

export async function deleteFile(fileId: string) {
  await api(`/files/${fileId}`, { method: 'DELETE' })
}

// ---------- grades ----------
/** Saves component points for one student (the API merges them with the points already entered). */
export async function saveGrade(courseId: string, studentId: string, components: Record<string, number>) {
  await api('/grades', { method: 'POST', json: { courseId, studentId, components } })
}

export async function reloadRoster(courseId: string) {
  await loadRoster(courseId)
}

// ---------- calendar ----------
export async function createEvent(e: { title: string; kind: string; startsAt: string; endsAt?: string }) {
  await api('/calendar/events', { method: 'POST', json: e })
  await refreshEvents()
}

export async function deleteEvent(id: string) {
  await api(`/calendar/events/${id}`, { method: 'DELETE' })
  await refreshEvents()
}

// ---------- users ----------
export interface UserInput {
  firstName: string
  lastName: string
  email: string
  role: Exclude<Role, 'superadmin'>
  departmentId: string | null
  studyProgramId: string | null
}

/** Returns the temporary password the API generated, shown once to the admin. */
export async function createUser(u: UserInput): Promise<string | null> {
  const r = await api<{ temporaryPassword: string | null }>('/users', {
    method: 'POST',
    json: { ...u, role: apiRole(u.role), departmentId: u.role === 'student' ? null : u.departmentId, studyProgramId: u.role === 'student' ? u.studyProgramId : null },
  })
  await refreshDirectory()
  return r.temporaryPassword
}

export async function updateUser(id: string, u: Partial<UserInput> & { active?: boolean }) {
  const { role, ...rest } = u
  await api(`/users/${id}`, { method: 'PUT', json: { ...rest, ...(role ? { role: apiRole(role) } : {}) } })
  await refreshDirectory()
}

// ---------- organization ----------
export async function saveDepartment(id: string | null, d: { code: string; name: string }) {
  await api(id ? `/departments/${id}` : '/departments', { method: id ? 'PUT' : 'POST', json: d })
  await refreshOrg()
}

export async function saveProgram(id: string | null, p: { name: string; departmentId: string; degree: string; creditsRequired: number }) {
  await api(id ? `/study-programs/${id}` : '/study-programs', { method: id ? 'PUT' : 'POST', json: p })
  await refreshOrg()
}

// ---------- platform ----------
export async function savePlatformLimits(institutionId: string, l: { maxUsers: number; maxStorageMb: number }) {
  await api(`/institutions/${institutionId}`, { method: 'PUT', json: l })
  await refreshPlatform()
}

