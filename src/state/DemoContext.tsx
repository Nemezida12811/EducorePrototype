import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  DEMO_TODAY,
  initialGroupChoice,
  initialRegisteredExamIds,
  notices as initialNotices,
  studentEnrolledIds,
  users,
} from '../data/demo'
import { getCourse } from '../data/selectors'
import type { ClassSession, Course, Notice, NoticeScope, Role } from '../data/types'

export interface NewNotice {
  title: string
  body: string
  scope: NoticeScope
  courseId?: string
  sessionId?: string
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
  /** Practical group chosen per course (course id to session id). */
  groupChoice: Readonly<Record<string, string>>
  /** Students in a practical group, adjusted by the demo student's own choice. */
  groupTaken: (session: ClassSession) => number
  /** Enrolled -> withdraw, waitlisted -> leave list, seats left -> enroll (with a group), full -> join waitlist. */
  toggleEnrollment: (courseId: string, groupId?: string) => void
  /** Move an enrolled student to another practical group of the same course. */
  chooseGroup: (courseId: string, sessionId: string) => void
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
  const [groupChoice, setGroupChoice] = useState<Readonly<Record<string, string>>>(initialGroupChoice)
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

  const groupTaken = useCallback(
    (session: ClassSession) => {
      const now = groupChoice[session.courseId] === session.id
      const before = initialGroupChoice[session.courseId] === session.id
      return (session.taken ?? 0) + (now ? 1 : 0) - (before ? 1 : 0)
    },
    [groupChoice],
  )

  const toggleEnrollment = useCallback(
    (courseId: string, groupId?: string) => {
      const course = getCourse(courseId)
      if (enrolled.has(courseId)) {
        setEnrolled((p) => toggled(p, courseId))
        setGroupChoice((p) => {
          const { [courseId]: _removed, ...rest } = p
          return rest
        })
      } else if (waitlist.has(courseId)) setWaitlist((p) => toggled(p, courseId))
      else if (seatsTaken(course) < course.studentLimit) {
        setEnrolled((p) => toggled(p, courseId))
        if (groupId) setGroupChoice((p) => ({ ...p, [courseId]: groupId }))
      } else setWaitlist((p) => toggled(p, courseId))
    },
    [enrolled, waitlist, seatsTaken],
  )

  const chooseGroup = useCallback((courseId: string, sessionId: string) => setGroupChoice((p) => ({ ...p, [courseId]: sessionId })), [])

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
      groupChoice,
      groupTaken,
      toggleEnrollment,
      chooseGroup,
      notices,
      readNoticeIds: read,
      toggleNoticeRead,
      markNoticesRead,
      addNotice,
    }),
    [role, registered, toggleExamRegistration, enrolled, waitlist, seatsTaken, groupChoice, groupTaken, toggleEnrollment, chooseGroup, notices, read, toggleNoticeRead, markNoticesRead, addNotice],
  )
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo(): DemoState {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>')
  return ctx
}
