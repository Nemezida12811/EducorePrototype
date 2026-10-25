import { useSyncExternalStore } from 'react'
import {
  courses,
  directory,
  documents,
  exams,
  orgUnits,
  platform,
  rosterGrades,
  sessions,
  studyPrograms,
  teachers,
} from './demo'
import type { ClassSession, Course, CourseDocument, DirectoryUser, Exam, OrgUnit, PlatformSettings, StudyProgram, Teacher } from './types'

/** Minimal external store: module-level state that React components subscribe to. Resets on reload. */
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
    use: () => useSyncExternalStore(subscribe, () => value),
  }
}

export const coursesStore = createStore<Course[]>(courses)
export const sessionsStore = createStore<ClassSession[]>(sessions)
export const teachersStore = createStore<Teacher[]>(teachers)
export const directoryStore = createStore<DirectoryUser[]>(directory)
export const orgUnitsStore = createStore<OrgUnit[]>(orgUnits)
export const programsStore = createStore<StudyProgram[]>(studyPrograms)
export const documentsStore = createStore<CourseDocument[]>(documents)
export const examsStore = createStore<Exam[]>(exams)
export const platformStore = createStore<PlatformSettings>(platform)

/** Points per student in roster order, one entry per grading component (null = not graded). */
const fullRows = Object.fromEntries(
  Object.entries(rosterGrades).map(([courseId, rows]) => {
    const length = courses.find((c) => c.id === courseId)!.gradingScheme.length
    return [courseId, rows.map((r) => Array.from({ length }, (_, i) => (i < r.length ? r[i] : null)))]
  }),
) as Record<string, (number | null)[][]>

export const rosterGradesStore = createStore<Record<string, (number | null)[][]>>(fullRows)

export const useCourses = coursesStore.use
export const useSessions = sessionsStore.use
export const useTeachers = teachersStore.use
export const useDirectory = directoryStore.use
export const useOrgUnits = orgUnitsStore.use
export const usePrograms = programsStore.use
export const useDocuments = documentsStore.use
export const useExams = examsStore.use
export const usePlatform = platformStore.use
export const useRosterGrades = rosterGradesStore.use

export function setRosterGrade(courseId: string, student: number, component: number, value: number | null) {
  rosterGradesStore.set((prev) => ({
    ...prev,
    [courseId]: prev[courseId].map((row, i) => (i === student ? row.map((v, j) => (j === component ? value : v)) : row)),
  }))
}
