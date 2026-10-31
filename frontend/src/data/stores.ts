import { useSyncExternalStore } from 'react'
import type {
  CalendarEvent, ClassSession, Course, DirectoryUser, EnrollmentItem, Exam, Notice, OrgUnit, PlatformSettings, RosterRow, StudentGrade, StudyPlan,
  StudyProgram, Teacher,
} from './types'

/** Minimal external store: module-level state that React components subscribe to. Filled from the API by data/load.ts. */
function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }
  return {
    get: () => value,
    set(next: T | ((prev: T) => T)) {
      value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
      listeners.forEach((l) => l())
    },
    reset: () => {
      value = initial
      listeners.forEach((l) => l())
    },
    use: () => useSyncExternalStore(subscribe, () => value),
  }
}

export const coursesStore = createStore<Course[]>([])
export const sessionsStore = createStore<ClassSession[]>([])
/** Every session of every active course (teachers and admins only): used to avoid double-booking. */
export const allSessionsStore = createStore<ClassSession[]>([])
export const teachersStore = createStore<Teacher[]>([])
export const directoryStore = createStore<DirectoryUser[]>([])
export const orgUnitsStore = createStore<OrgUnit[]>([])
export const programsStore = createStore<StudyProgram[]>([])
export const examsStore = createStore<Exam[]>([])
export const noticesStore = createStore<Notice[]>([])
export const eventsStore = createStore<CalendarEvent[]>([])
export const enrollmentsStore = createStore<EnrollmentItem[]>([])
export const gradesStore = createStore<StudentGrade[]>([])
export const planStore = createStore<StudyPlan | null>(null)
export const platformStore = createStore<PlatformSettings | null>(null)
export const institutionStore = createStore<{ id: string; name: string } | null>(null)
/** Course rosters with grades, by course id (teachers and admins), loaded on demand. */
export const rostersStore = createStore<Record<string, RosterRow[]>>({})

const ALL = [
  coursesStore, sessionsStore, allSessionsStore, teachersStore, directoryStore, orgUnitsStore, programsStore, examsStore, noticesStore, eventsStore,
  enrollmentsStore, gradesStore, planStore, platformStore, institutionStore, rostersStore,
]
/** Forget everything (sign-out): the next user must never see the previous user's data. */
export const resetStores = () => ALL.forEach((s) => s.reset())

export const useCourses = coursesStore.use
export const useSessions = sessionsStore.use
export const useAllSessions = allSessionsStore.use
export const useTeachers = teachersStore.use
export const useDirectory = directoryStore.use
export const useOrgUnits = orgUnitsStore.use
export const usePrograms = programsStore.use
export const useExams = examsStore.use
export const useNotices = noticesStore.use
export const useEvents = eventsStore.use
export const useEnrollments = enrollmentsStore.use
export const useGrades = gradesStore.use
export const usePlan = planStore.use
export const usePlatform = platformStore.use
export const useInstitution = institutionStore.use
export const useRosters = rostersStore.use
