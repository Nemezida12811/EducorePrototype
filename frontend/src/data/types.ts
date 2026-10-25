export type Role = 'student' | 'instructor' | 'admin' | 'superadmin'
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
export type Mark = 'A' | 'B' | 'C' | 'D' | 'E' | 'FX'
export type Term = 'Winter' | 'Summer'

export interface OrgUnit {
  id: string
  name: string
  code: string
  parentId: string | null
}

export interface StudyProgram {
  id: string
  name: string
  degreeLevel: 'Bachelor' | 'Master'
  durationYears: number
  orgUnitId: string
  students: number
}

export interface Teacher {
  id: string
  name: string
  title: string
  orgUnitId: string
}

/** One component of Course.grading_scheme, e.g. "Midterm test", 20 points. */
export interface GradingComponent {
  name: string
  max: number
}

export type CompletionType = 'Exam' | 'Classified credit'

/** Course and its offering in one academic year (name, description, teachers, limit, year, archived). */
export interface Course {
  id: string
  code: string
  name: string
  description: string
  academicYear: string
  semester: Term
  credits: number
  studentLimit: number
  enrolled: number
  teacherIds: string[]
  archived: boolean
  orgUnitId: string
  completionType: CompletionType
  gradingScheme: GradingComponent[]
  guarantorId: string
  topics: string[]
  /** Courses that must be completed before enrolling. */
  prerequisiteIds: string[]
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
  /** The teacher who runs this session. */
  teacherId: string
  /** Practical groups (anything but a lecture): label such as "A", seat capacity and seats taken. */
  group?: string
  capacity?: number
  taken?: number
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

/** Points for one grading component; null means not graded yet. Aligned by index with the course scheme. */
export interface GradeEntry {
  points: number | null
  date?: string
}

/** One Grade per (student, course): components plus a total that becomes the final score. */
export interface StudentGrade {
  courseId: string
  entries: GradeEntry[]
  finalizedAt?: string
}

export interface StudyPlanItem {
  courseId: string
  yearOfStudy: number
  term: Term
  mandatory: boolean
}

export interface Semester {
  id: string
  academicYear: string
  term: Term
  enrollmentStart: string
  enrollmentEnd: string
  start: string
  teachingEnd: string
  examStart: string
  examEnd: string
}

export interface Holiday {
  date: string
  title: string
}

export type NoticeScope = 'institution' | 'department' | 'course' | 'group'

export interface Notice {
  id: string
  title: string
  body: string
  date: string
  author: string
  audience: 'all' | Role
  scope: NoticeScope
  courseId?: string
  /** For group notices: the practical group (a session) that receives it. */
  sessionId?: string
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

export interface DirectoryUser {
  id: string
  name: string
  email: string
  role: Role
  unit: string
  active: boolean
  /** Set for users who teach: links the account to a Teacher. */
  teacherId?: string
}

export interface DemoUser {
  name: string
  initials: string
  detail: string
}

export interface CourseDocument {
  id: string
  courseId: string
  name: string
  kind: 'Syllabus' | 'Material'
  sizeKb: number
  uploadedAt: string
  /** Only for files added during this session. */
  url?: string
}

/** Platform-wide limits and usage (one institution, no plans). */
export interface PlatformSettings {
  userLimit: number
  usersUsed: number
  storageLimitGb: number
  storageUsedGb: number
}
