import { coursesStore, teachersStore } from './stores'
import type { Course } from './types'

export const findCourse = (id: string): Course | undefined => coursesStore.get().find((c) => c.id === id)

/** Name of a teacher: the teacher directory first, then the teachers listed on courses (covers deactivated accounts). */
export function teacherName(id: string | null | undefined): string {
  if (!id) return 'No teacher assigned'
  const listed = teachersStore.get().find((x) => x.id === id)
  if (listed) return listed.name
  for (const c of coursesStore.get()) {
    const t = c.teachers.find((x) => x.id === id)
    if (t) return t.name
  }
  return 'Unknown teacher'
}

export const teacherNames = (course: Course): string[] => course.teachers.map((t) => t.name)
