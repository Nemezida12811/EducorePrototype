import { courses, exams, INSTRUCTOR_ID, sessions, studentEnrolledIds, teachers } from './demo'
import type { ClassSession, Course, Exam, Role } from './types'

const courseMap = new Map(courses.map((c) => [c.id, c]))
const teacherMap = new Map(teachers.map((t) => [t.id, t]))

export function getCourse(id: string): Course {
  const course = courseMap.get(id)
  if (!course) throw new Error(`Unknown course: ${id}`)
  return course
}

export function teacherName(id: string): string {
  const t = teacherMap.get(id)
  return t ? `${t.title} ${t.name}` : 'Unknown teacher'
}

export function teacherNames(course: Course): string[] {
  return course.teacherIds.map(teacherName)
}

/** Active courses relevant to a role: enrolled (student) or teaching (instructor). */
export function myCourseIds(role: Role): Set<string> {
  if (role === 'student') return new Set(studentEnrolledIds)
  return new Set(
    courses.filter((c) => !c.archived && c.teacherIds.includes(INSTRUCTOR_ID)).map((c) => c.id),
  )
}

export function myCourses(role: Role): Course[] {
  const ids = myCourseIds(role)
  return courses.filter((c) => ids.has(c.id))
}

export function mySessions(role: Role): ClassSession[] {
  const ids = myCourseIds(role)
  return sessions.filter((s) => ids.has(s.courseId))
}

export function myExams(role: Role): Exam[] {
  const ids = myCourseIds(role)
  return exams.filter((e) => ids.has(e.courseId)).sort((a, b) => a.date.localeCompare(b.date))
}
