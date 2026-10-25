import { useMemo } from 'react'
import { INSTRUCTOR_ID } from '../data/demo'
import { useCourses, useExams, useSessions } from '../data/stores'
import { isGroup } from '../lib/groups'
import { useDemo } from './DemoContext'

/** Everything that belongs to the current role: courses, timetable, exams and visible notices. */
export function useMine() {
  const { role, enrolledIds, groupChoice, notices, readNoticeIds } = useDemo()
  const courses = useCourses()
  const sessions = useSessions()
  const exams = useExams()

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
      .filter((n) => {
        if (n.scope !== 'group') return true
        if (role === 'admin') return true
        if (role === 'student') return n.courseId !== undefined && ids.has(n.courseId) && groupChoice[n.courseId] === n.sessionId
        if (role === 'instructor') return sessions.find((x) => x.id === n.sessionId)?.teacherId === INSTRUCTOR_ID
        return false
      })
      .sort((a, b) => b.date.localeCompare(a.date))

    return {
      ids,
      courses: mineCourses,
      // Students attend every lecture plus their chosen practical group; teachers see the sessions they run;
      // admins see every session.
      sessions: sessions.filter((s) => {
        if (!ids.has(s.courseId)) return false
        if (role === 'student') return !isGroup(s) || groupChoice[s.courseId] === s.id
        if (role === 'instructor') return s.teacherId === INSTRUCTOR_ID
        return true
      }),
      exams: exams.filter((e) => ids.has(e.courseId)).sort((a, b) => a.date.localeCompare(b.date)),
      notices: visibleNotices,
      unread: visibleNotices.filter((n) => !readNoticeIds.has(n.id)).length,
    }
  }, [role, enrolledIds, groupChoice, notices, readNoticeIds, courses, sessions, exams])
}
