import { useMemo } from 'react'
import { courses, exams, INSTRUCTOR_ID, sessions } from '../data/demo'
import { useDemo } from './DemoContext'

/** Everything that belongs to the current role: courses, timetable, exams and visible notices. */
export function useMine() {
  const { role, enrolledIds, notices, readNoticeIds } = useDemo()

  return useMemo(() => {
    const active = courses.filter((c) => !c.archived)
    const mineCourses =
      role === 'student'
        ? active.filter((c) => enrolledIds.has(c.id))
        : role === 'instructor'
          ? active.filter((c) => c.teacherIds.includes(INSTRUCTOR_ID))
          : active
    const ids = new Set(mineCourses.map((c) => c.id))

    const visibleNotices = notices
      .filter((n) => n.audience === 'all' || n.audience === role)
      .filter((n) => n.scope !== 'course' || role === 'admin' || (n.courseId !== undefined && ids.has(n.courseId)))
      .sort((a, b) => b.date.localeCompare(a.date))

    return {
      ids,
      courses: mineCourses,
      sessions: sessions.filter((s) => ids.has(s.courseId)),
      exams: exams.filter((e) => ids.has(e.courseId)).sort((a, b) => a.date.localeCompare(b.date)),
      notices: visibleNotices,
      unread: visibleNotices.filter((n) => !readNoticeIds.has(n.id)).length,
    }
  }, [role, enrolledIds, notices, readNoticeIds])
}
