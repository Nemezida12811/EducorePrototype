import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  DEMO_TODAY,
  initialRegisteredExamIds,
  notices as initialNotices,
  studentEnrolledIds,
  users,
} from '../data/demo'
import { getCourse } from '../data/selectors'
import type { Course, Notice, NoticeScope, Role } from '../data/types'

export interface NewNotice {
  title: string
  body: string
  scope: NoticeScope
  courseId?: string
}

interface DemoState {
  role: Role
  setRole: (role: Role) => void
  registeredExamIds: ReadonlySet<string>
  toggleExamRegistration: (examId: string) => void
  enrolledIds: ReadonlySet<string>
  waitlistIds: ReadonlySet<string>
  /** Seats taken, adjusted by the demo student's own enrollment changes. */
  seatsTaken: (course: Course) => number
  /** Enrolled -> withdraw, waitlisted -> leave list, seats left -> enroll, full -> join waitlist. */
  toggleEnrollment: (courseId: string) => void
  notices: Notice[]
  readNoticeIds: ReadonlySet<string>
  toggleNoticeRead: (id: string) => void
  markNoticesRead: (ids: string[]) => void
  addNotice: (notice: NewNotice) => void
}

const DemoContext = createContext<DemoState | null>(null)

const toggled = (set: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('student')
  const [registered, setRegistered] = useState<ReadonlySet<string>>(() => new Set(initialRegisteredExamIds))
  const [enrolled, setEnrolled] = useState<ReadonlySet<string>>(() => new Set(studentEnrolledIds))
  const [waitlist, setWaitlist] = useState<ReadonlySet<string>>(() => new Set())
  const [notices, setNotices] = useState<Notice[]>(initialNotices)
  const [read, setRead] = useState<ReadonlySet<string>>(() => new Set())

  const toggleExamRegistration = useCallback((id: string) => setRegistered((p) => toggled(p, id)), [])

  const seatsTaken = useCallback(
    (course: Course) => {
      if (course.archived) return course.enrolled
      const now = enrolled.has(course.id)
      const before = studentEnrolledIds.includes(course.id)
      return course.enrolled + (now ? 1 : 0) - (before ? 1 : 0)
    },
    [enrolled],
  )

  const toggleEnrollment = useCallback(
    (courseId: string) => {
      const course = getCourse(courseId)
      if (enrolled.has(courseId)) setEnrolled((p) => toggled(p, courseId))
      else if (waitlist.has(courseId)) setWaitlist((p) => toggled(p, courseId))
      else if (seatsTaken(course) < course.studentLimit) setEnrolled((p) => toggled(p, courseId))
      else setWaitlist((p) => toggled(p, courseId))
    },
    [enrolled, waitlist, seatsTaken],
  )

  const toggleNoticeRead = useCallback((id: string) => setRead((p) => toggled(p, id)), [])
  const markNoticesRead = useCallback((ids: string[]) => setRead((p) => new Set([...p, ...ids])), [])

  const addNotice = useCallback(
    (n: NewNotice) => {
      const created: Notice = {
        ...n,
        id: `n-${Date.now()}`,
        date: DEMO_TODAY,
        author: users[role].name,
        audience: 'all',
      }
      setNotices((p) => [created, ...p])
    },
    [role],
  )

  const value = useMemo<DemoState>(
    () => ({
      role,
      setRole,
      registeredExamIds: registered,
      toggleExamRegistration,
      enrolledIds: enrolled,
      waitlistIds: waitlist,
      seatsTaken,
      toggleEnrollment,
      notices,
      readNoticeIds: read,
      toggleNoticeRead,
      markNoticesRead,
      addNotice,
    }),
    [role, registered, toggleExamRegistration, enrolled, waitlist, seatsTaken, toggleEnrollment, notices, read, toggleNoticeRead, markNoticesRead, addNotice],
  )
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo(): DemoState {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>')
  return ctx
}
