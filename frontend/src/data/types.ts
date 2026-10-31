export type Role = 'student' | 'instructor' | 'admin' | 'superadmin'
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
export type Mark = 'A' | 'B' | 'C' | 'D' | 'E' | 'FX'
export type Term = 'Winter' | 'Summer'

/** A department (the API has one flat list per institution). */
export interface OrgUnit {
  id: string
  name: string
  code: string
}

export interface StudyProgram {
  id: string
  name: string
  /** Degree label such as "Bc." or "Ing.". */
  degree: string
  creditsRequired: number
  orgUnitId: string
  students: number
}

export interface Teacher {
  id: string
  name: string
  orgUnitId: string | null
}

/** One component of Course.grading_scheme, e.g. "Midterm test", 20 points. */
export interface GradingComponent {
  name: string
  max: number
  /** Minimum points on this component needed to pass the course (0 = none). */
  min: number
}

export type CompletionType = 'Exam' | 'Credit' | 'Classified credit'

export interface CourseTeacher {
  id: string
  name: string
  isGuarantor: boolean
}

/** Course and its offering in one academic year (name, description, teachers, limit, year, archived). */
export interface Course {
  id: string
  code: string
  name: string
  description: string
  /** As stored by the API, for example "2026/2027". */
  academicYear: string
  semester: Term
  credits: number
  studentLimit: number
  /** Students holding a seat (waitlisted students are not counted). */
  enrolled: number
  waitlisted: number
  teachers: CourseTeacher[]
  teacherIds: string[]
  archived: boolean
  orgUnitId: string | null
  completionType: CompletionType
  gradingScheme: GradingComponent[]
  guarantorId: string | null
  topics: string[]
}

export interface CoursePrerequisite {
  id: string
  code: string
  name: string
}

export interface CourseDocument {
  id: string
  fileId: string
  name: string
  kind: 'Syllabus' | 'Material'
  sizeKb: number
}

export interface MyGrade {
  components: Record<string, number>
  finalScore: number | null
  mark: Mark | null
}

/** Everything the course page needs: the list fields plus what only GET /courses/:id returns. */
export interface CourseDetailData extends Course {
  prerequisites: CoursePrerequisite[]
  sessions: ClassSession[]
  documents: CourseDocument[]
  exams: Exam[]
  canManage: boolean
  /** Students only. */
  myEnrollment: { id: string; status: 'enrolled' | 'waitlisted' } | null
  myGrade: MyGrade | null
  missingPrerequisites: CoursePrerequisite[]
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
  teacherId: string | null
}

export type ExamFormat = 'Written' | 'Oral' | 'Online' | 'Practical'

export interface Exam {
  id: string
  courseId: string
  date: string // ISO yyyy-mm-dd
  start: string
  room: string
  format: ExamFormat
  term: number
  capacity: number
  registered: number
  registration: 'open' | 'closed'
  /** Whether the signed-in student is registered for this term. */
  registeredByMe: boolean
}

/** One grade per (student, course): component points keyed by component name, plus the final score the API derives. */
export interface StudentGrade {
  courseId: string
  components: Record<string, number>
  finalScore: number | null
  mark: Mark | null
  updatedAt: string
}

export type PlanStatus = 'passed' | 'failed' | 'enrolled' | 'todo'

export interface StudyPlanItem {
  courseId: string
  semesterNo: number
  mandatory: boolean
  status: PlanStatus
  mark: Mark | null
}

export interface StudyPlan {
  programName: string | null
  creditsRequired: number | null
  creditsEarned: number
  items: StudyPlanItem[]
}

export type NoticeScope = 'institution' | 'course'

export interface Notice {
  id: string
  title: string
  body: string
  date: string
  author: string
  scope: NoticeScope
  courseId?: string
  read: boolean
}

export interface CalendarEvent {
  id: string
  title: string
  kind: string
  /** ISO date-time. */
  start: string
  end?: string
}

export interface RosterStudent {
  id: string
  name: string
  email: string
}

/** A student's row in a course roster, with the grade (if any) from the grades API. */
export interface RosterRow extends RosterStudent {
  components: Record<string, number> | null
  finalScore: number | null
  mark: Mark | null
}

export interface EnrollmentItem {
  id: string
  courseId: string
  status: 'enrolled' | 'waitlisted'
}

export interface DirectoryUser {
  id: string
  firstName: string
  lastName: string
  name: string
  email: string
  role: Role
  unit: string
  active: boolean
  departmentId: string | null
  studyProgramId: string | null
}

/** Platform-wide limits and usage (one institution, no plans). */
export interface PlatformSettings {
  institutionId: string
  userLimit: number
  usersUsed: number
  storageLimitMb: number
  storageUsedMb: number
}
