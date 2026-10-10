import { courses, teachers } from './demo'
import type { Course } from './types'

const courseMap = new Map(courses.map((c) => [c.id, c]))
const teacherMap = new Map(teachers.map((t) => [t.id, t]))

export const findCourse = (id: string): Course | undefined => courseMap.get(id)

export function getCourse(id: string): Course {
  const course = courseMap.get(id)
  if (!course) throw new Error(`Unknown course: ${id}`)
  return course
}

export function teacherName(id: string): string {
  const t = teacherMap.get(id)
  return t ? `${t.title} ${t.name}` : 'Unknown teacher'
}

export const teacherNames = (course: Course): string[] => course.teacherIds.map(teacherName)
