import { coursesStore, teachersStore } from './stores'
import type { Course } from './types'

export const findCourse = (id: string): Course | undefined => coursesStore.get().find((c) => c.id === id)

export function getCourse(id: string): Course {
  const course = findCourse(id)
  if (!course) throw new Error(`Unknown course: ${id}`)
  return course
}

export function teacherName(id: string): string {
  const t = teachersStore.get().find((x) => x.id === id)
  return t ? `${t.title} ${t.name}`.trim() : 'Unknown teacher'
}

export const teacherNames = (course: Course): string[] => course.teacherIds.map(teacherName)
