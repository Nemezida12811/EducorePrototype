/** Loads the signed-in user's data from the API into the stores. Each refresh* can also be called after a mutation. */
import { api } from '../lib/api'
import {
  mapCourse, mapEnrollment, mapEvent, mapExam, mapGrade, mapNotice, mapOrgUnit, mapPlan, mapPlatform, mapProgram, mapRosterRow, mapSession, mapTeacher,
  mapUser, type Dto,
} from './mappers'
import {
  allSessionsStore, coursesStore, directoryStore, enrollmentsStore, eventsStore, examsStore, gradesStore, institutionStore, noticesStore, orgUnitsStore,
  planStore, platformStore, programsStore, rostersStore, sessionsStore, teachersStore,
} from './stores'
import type { Role } from './types'

/** Walks every page of a paginated list endpoint. */
export async function fetchAll(path: string): Promise<Dto[]> {
  const out: Dto[] = []
  const sep = path.includes('?') ? '&' : '?'
  for (let page = 1; ; page += 1) {
    const r = await api<{ items: Dto[]; total: number }>(`${path}${sep}page=${page}&pageSize=100`)
    out.push(...r.items)
    if (r.items.length === 0 || out.length >= r.total) return out
  }
}

export const refreshCourses = async () => coursesStore.set((await fetchAll('/courses?archived=all')).map(mapCourse))
export const refreshSessions = async () => sessionsStore.set((await api<{ items: Dto[] }>('/schedule/me')).items.map((s) => mapSession(s)))
export const refreshAllSessions = async () => allSessionsStore.set((await api<{ items: Dto[] }>('/schedule/all')).items.map((s) => mapSession(s)))
export const refreshExams = async () => examsStore.set((await api<{ items: Dto[] }>('/exams')).items.map((x) => mapExam(x)))
export const refreshTeachers = async () => teachersStore.set((await api<{ items: Dto[] }>('/teachers')).items.map(mapTeacher))
export const refreshNotices = async () => noticesStore.set((await fetchAll('/announcements')).map(mapNotice))
export const refreshEvents = async () => eventsStore.set((await api<{ items: Dto[] }>('/calendar/events')).items.map(mapEvent))
export const refreshEnrollments = async () => enrollmentsStore.set((await api<{ items: Dto[] }>('/enrollments/me')).items.map(mapEnrollment))
export const refreshGrades = async () => gradesStore.set((await api<{ items: Dto[] }>('/grades/me')).items.map(mapGrade))
export const refreshPlan = async () => planStore.set(mapPlan(await api<Dto>('/study-plan/me')))
export const refreshInstitution = async () => {
  const i = await api<{ id: string; name: string }>('/institution')
  institutionStore.set({ id: i.id, name: i.name })
}

export async function refreshOrg() {
  const [units, programs] = await Promise.all([api<{ items: Dto[] }>('/departments'), api<{ items: Dto[] }>('/study-programs')])
  orgUnitsStore.set(units.items.map(mapOrgUnit))
  programsStore.set(programs.items.map(mapProgram))
}

export async function refreshDirectory() {
  const users = await fetchAll('/users')
  directoryStore.set(users.map((u) => mapUser(u, orgUnitsStore.get(), programsStore.get())))
}

export async function refreshPlatform() {
  const list = await api<{ items: Dto[] }>('/institutions')
  const first = list.items[0]
  if (first) platformStore.set(mapPlatform(await api<Dto>(`/institutions/${first.id}`)))
}

/** Roster and grades of one course (teachers of the course and admins). */
export async function loadRoster(courseId: string) {
  const r = await api<{ items: Dto[] }>(`/grades/course/${courseId}`)
  rostersStore.set((prev) => ({ ...prev, [courseId]: r.items.map(mapRosterRow) }))
}

/** Everything a role needs for its pages, loaded in parallel. */
export async function loadAll(role: Role) {
  const common = [refreshInstitution(), refreshCourses(), refreshSessions(), refreshExams(), refreshNotices(), refreshEvents(), refreshOrg()]
  const byRole: Promise<unknown>[] = []
  if (role === 'student') byRole.push(refreshEnrollments(), refreshGrades(), refreshPlan(), refreshTeachers())
  if (role === 'instructor') byRole.push(refreshTeachers(), refreshAllSessions())
  if (role === 'admin' || role === 'superadmin') byRole.push(refreshTeachers(), refreshAllSessions())
  await Promise.all([...common, ...byRole])
  // These need the departments and programs loaded above to label each account.
  if (role === 'admin' || role === 'superadmin') await refreshDirectory()
  if (role === 'superadmin') await refreshPlatform()
}
