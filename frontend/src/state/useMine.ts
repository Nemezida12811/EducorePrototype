import { useMemo } from 'react'
import { useCourses, useExams, useNotices, useSessions } from '../data/stores'
import { useApp } from './AppContext'

/** Everything that belongs to the signed-in user: courses, timetable, exams and notices. The API already scopes sessions, exams and notices by role. */
export function useMine() {
  const { role, user, enrolledIds } = useApp()
  const courses = useCourses()
  const sessions = useSessions()
  const exams = useExams()
  const notices = useNotices()

  return useMemo(() => {
    const active = courses.filter((c) => !c.archived)
    const mineCourses =
      role === 'student' ? active.filter((c) => enrolledIds.has(c.id)) : role === 'instructor' ? active.filter((c) => c.teacherIds.includes(user.id)) : active
    const ids = new Set(mineCourses.map((c) => c.id))
    return {
      ids,
      courses: mineCourses,
      sessions: sessions.filter((s) => ids.has(s.courseId)),
      exams: exams.filter((e) => ids.has(e.courseId)).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)),
      notices,
      unread: notices.filter((n) => !n.read).length,
    }
  }, [role, user.id, enrolledIds, courses, sessions, exams, notices])
}
