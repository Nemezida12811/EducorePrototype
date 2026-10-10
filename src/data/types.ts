export type Role = 'student' | 'instructor'
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
export type Mark = 'A' | 'B' | 'C' | 'D' | 'E' | 'FX'

export interface Teacher {
  id: string
  name: string
  title: string
}

/** Mirrors the Course model: name, description, teachers, student limit, year, archived state. */
export interface Course {
  id: string
  code: string
  name: string
  description: string
  academicYear: string
  semester: 'Winter' | 'Summer'
  credits: number
  studentLimit: number
  enrolled: number
  teacherIds: string[]
  archived: boolean
}

export type SessionType = 'Lecture' | 'Practical' | 'Lab' | 'Seminar'

export interface ClassSession {
  id: string
  courseId: string
  day: Day
  start: string
  end: string
  type: SessionType
  room: string
}

export interface Exam {
  id: string
  courseId: string
  date: string // ISO yyyy-mm-dd
  start: string
  room: string
  format: 'Written' | 'Oral' | 'Practical'
  term: string
  capacity: number
  registered: number
  registration: 'open' | 'closed'
}

export interface Assessment {
  id: string
  courseId: string
  title: string
  date: string
  points: number
  maxPoints: number
}

export interface FinalMark {
  courseId: string
  mark: Mark
  date: string
}

export interface Notice {
  id: string
  title: string
  body: string
  date: string
  author: string
  audience: 'all' | Role
}

export interface GradingTask {
  id: string
  courseId: string
  title: string
  submissions: number
  due: string
}

export interface RosterStudent {
  id: string
  name: string
}

export interface DemoUser {
  name: string
  initials: string
  detail: string
}
