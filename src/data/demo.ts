import type {
  ClassSession,
  Course,
  CourseDocument,
  DemoUser,
  DirectoryUser,
  Day,
  Exam,
  GradingComponent,
  GradingTask,
  Holiday,
  Notice,
  PlatformSettings,
  OrgUnit,
  Role,
  RosterStudent,
  Semester,
  StudentGrade,
  StudyPlanItem,
  StudyProgram,
  Teacher,
} from './types'

export const university = {
  name: 'Technical University of Košice',
  faculty: 'Faculty of Electrical Engineering and Informatics',
}

export const semesterLabel = 'Winter semester 2026/27'

/** The demo has no clock: this date drives "today", calendar status and the dashboard day. */
export const DEMO_TODAY = '2026-10-12'
export const DEMO_DAY: Day = 'Mon'
export const DEMO_DAY_LONG = 'Monday'

export const degree = { requiredCredits: 180, creditsBeforeArchive: 90 }

export const users: Record<Role, DemoUser> = {
  student: { name: 'Eva Nováková', initials: 'EN', detail: 'Applied Informatics, year 3' },
  instructor: { name: 'Peter Horváth', initials: 'PH', detail: 'Associate professor, Informatics' },
  admin: { name: 'Mária Szabová', initials: 'MS', detail: 'Study office administrator' },
  superadmin: { name: 'Jakub Lenárt', initials: 'JL', detail: 'Platform operator' },
}

export const INSTRUCTOR_ID = 't1'
export const STUDENT_PROGRAM_ID = 'ai'

export const orgUnits: OrgUnit[] = [
  { id: 'fei', name: 'Faculty of Electrical Engineering and Informatics', code: 'FEI', parentId: null },
  { id: 'kpi', name: 'Department of Computers and Informatics', code: 'KPI', parentId: 'fei' },
  { id: 'kemt', name: 'Department of Electronics and Multimedia Telecommunications', code: 'KEMT', parentId: 'fei' },
  { id: 'kmat', name: 'Department of Mathematics', code: 'KMAT', parentId: 'fei' },
  { id: 'lang', name: 'Department of Languages', code: 'LJ', parentId: 'fei' },
]

export const studyPrograms: StudyProgram[] = [
  { id: 'ai', name: 'Applied Informatics', degreeLevel: 'Bachelor', durationYears: 3, orgUnitId: 'kpi', students: 412 },
  { id: 'inf', name: 'Informatics', degreeLevel: 'Master', durationYears: 2, orgUnitId: 'kpi', students: 238 },
  { id: 'etc', name: 'Electronics and Telecommunications', degreeLevel: 'Bachelor', durationYears: 3, orgUnitId: 'kemt', students: 305 },
  { id: 'mm', name: 'Multimedia Engineering', degreeLevel: 'Master', durationYears: 2, orgUnitId: 'kemt', students: 142 },
]

export const teachers: Teacher[] = [
  { id: 't1', name: 'Peter Horváth', title: 'Assoc. Prof.', orgUnitId: 'kpi' },
  { id: 't2', name: 'Lucia Bartošová', title: 'Dr.', orgUnitId: 'kpi' },
  { id: 't3', name: 'Martin Kolesár', title: 'Prof.', orgUnitId: 'kpi' },
  { id: 't4', name: 'Zuzana Mihalová', title: 'Dr.', orgUnitId: 'kemt' },
  { id: 't5', name: 'Katarína Ondrejová', title: 'Mgr.', orgUnitId: 'lang' },
  { id: 't6', name: 'Tomáš Gregor', title: 'Dr.', orgUnitId: 'kpi' },
  { id: 't7', name: 'Jana Petrášová', title: 'Prof.', orgUnitId: 'kmat' },
]

type CourseMeta = Pick<Course, 'orgUnitId' | 'completionType' | 'gradingScheme' | 'guarantorId' | 'topics'>
type BaseCourse = Omit<Course, keyof CourseMeta | 'prerequisiteIds'>

const scheme = (...pairs: [string, number][]): GradingComponent[] => pairs.map(([name, max]) => ({ name, max }))

/** Fields from the Course catalog record: department, completion type, grading scheme (sums to 100). */
const courseMeta: Record<string, CourseMeta> = {
  ads2: {
    orgUnitId: 'kpi', completionType: 'Exam', guarantorId: 't1',
    gradingScheme: scheme(['Problem sets', 20], ['Midterm test', 20], ['Exam', 60]),
    topics: ['Graph traversal and shortest paths', 'Minimum spanning trees', 'Dynamic programming', 'Amortized analysis', 'Network flow basics'],
  },
  cv: {
    orgUnitId: 'kpi', completionType: 'Exam', guarantorId: 't2',
    gradingScheme: scheme(['Labs', 30], ['Project', 30], ['Exam', 40]),
    topics: ['Image formation and filtering', 'Edges and keypoints', 'Convolutional networks', 'Object detection', 'Camera calibration'],
  },
  ddb: {
    orgUnitId: 'kpi', completionType: 'Exam', guarantorId: 't3',
    gradingScheme: scheme(['Quizzes', 20], ['Cluster project', 40], ['Exam', 40]),
    topics: ['Replication models', 'Partitioning and sharding', 'Consensus protocols', 'Transactions and consistency', 'Failure handling'],
  },
  swa: {
    orgUnitId: 'kpi', completionType: 'Exam', guarantorId: 't1',
    gradingScheme: scheme(['Essay', 20], ['Design project', 30], ['Exam', 50]),
    topics: ['Quality attributes', 'Modular monoliths and services', 'Architecture decision records', 'Observability', 'Evolution and refactoring'],
  },
  aml: {
    orgUnitId: 'kpi', completionType: 'Exam', guarantorId: 't1',
    gradingScheme: scheme(['Assignments', 30], ['Final project', 30], ['Exam', 40]),
    topics: ['Baselines and validation', 'Feature engineering', 'Model selection', 'Deployment and monitoring'],
  },
  een: {
    orgUnitId: 'lang', completionType: 'Classified credit', guarantorId: 't5',
    gradingScheme: scheme(['Presentation', 40], ['Written test', 30], ['Oral test', 30]),
    topics: ['Technical writing', 'Presenting a design', 'Meeting language', 'Reading specifications'],
  },
  sig: {
    orgUnitId: 'kemt', completionType: 'Exam', guarantorId: 't4',
    gradingScheme: scheme(['Labs', 30], ['Midterm test', 20], ['Exam', 50]),
    topics: ['Signal classification', 'Fourier series and transform', 'Z transform', 'Filter design', 'Sampling'],
  },
  emb: {
    orgUnitId: 'kemt', completionType: 'Exam', guarantorId: 't6',
    gradingScheme: scheme(['Lab tasks', 40], ['Project', 30], ['Exam', 30]),
    topics: ['Microcontroller architecture', 'Interrupts and timers', 'Real-time operating systems', 'Debugging tools', 'Low-power design'],
  },
  oop: {
    orgUnitId: 'kpi', completionType: 'Exam', guarantorId: 't6',
    gradingScheme: scheme(['Assignments', 20], ['Test', 20], ['Exam', 60]),
    topics: ['Classes and interfaces', 'Inheritance and composition', 'Design patterns', 'Unit testing'],
  },
  dm: {
    orgUnitId: 'kmat', completionType: 'Exam', guarantorId: 't7',
    gradingScheme: scheme(['Homework', 20], ['Test', 20], ['Exam', 60]),
    topics: ['Propositional logic', 'Combinatorics', 'Graph theory', 'Number theory'],
  },
  ads1: {
    orgUnitId: 'kpi', completionType: 'Exam', guarantorId: 't1',
    gradingScheme: scheme(['Assignments', 20], ['Test', 20], ['Exam', 60]),
    topics: ['Complexity analysis', 'Sorting', 'Trees', 'Hash tables'],
  },
  os: {
    orgUnitId: 'kpi', completionType: 'Exam', guarantorId: 't3',
    gradingScheme: scheme(['Labs', 20], ['Test', 20], ['Exam', 60]),
    topics: ['Processes and threads', 'Scheduling', 'Memory management', 'File systems'],
  },
  net: {
    orgUnitId: 'kpi', completionType: 'Exam', guarantorId: 't6',
    gradingScheme: scheme(['Labs', 20], ['Test', 20], ['Exam', 60]),
    topics: ['Protocol layers', 'Routing', 'Transport protocols', 'Network security basics'],
  },
  ps: {
    orgUnitId: 'kmat', completionType: 'Exam', guarantorId: 't7',
    gradingScheme: scheme(['Homework', 20], ['Test', 20], ['Exam', 60]),
    topics: ['Random variables', 'Estimation', 'Hypothesis testing', 'Regression basics'],
  },
}

const baseCourses: BaseCourse[] = [
  {
    id: 'ads2',
    code: 'KPI/ADS2',
    name: 'Algorithms and Data Structures II',
    description:
      'Advanced graph algorithms, amortized analysis and dynamic programming, with weekly practical sessions in Python and C++.',
    academicYear: '2026/27',
    semester: 'Winter',
    credits: 6,
    studentLimit: 120,
    enrolled: 112,
    teacherIds: ['t1'],
    archived: false,
  },
  {
    id: 'cv',
    code: 'KPI/CV',
    name: 'Computer Vision',
    description:
      'Image formation, feature detection and convolutional models. Labs use OpenCV and PyTorch on footage from campus cameras.',
    academicYear: '2026/27',
    semester: 'Winter',
    credits: 5,
    studentLimit: 40,
    enrolled: 38,
    teacherIds: ['t2'],
    archived: false,
  },
  {
    id: 'ddb',
    code: 'KPI/DDB',
    name: 'Distributed Databases',
    description:
      'Replication, partitioning, consensus and consistency trade-offs, taught through a semester-long cluster project.',
    academicYear: '2026/27',
    semester: 'Winter',
    credits: 5,
    studentLimit: 60,
    enrolled: 54,
    teacherIds: ['t3'],
    archived: false,
  },
  {
    id: 'swa',
    code: 'KPI/SWA',
    name: 'Software Architecture',
    description:
      'Designing maintainable systems: modularity, service boundaries, observability and architecture decision records.',
    academicYear: '2026/27',
    semester: 'Winter',
    credits: 6,
    studentLimit: 80,
    enrolled: 71,
    teacherIds: ['t1'],
    archived: false,
  },
  {
    id: 'aml',
    code: 'KPI/AML',
    name: 'Applied Machine Learning',
    description:
      'Model selection, evaluation and deployment practice on tabular and image data. Seats are limited by lab capacity.',
    academicYear: '2026/27',
    semester: 'Winter',
    credits: 5,
    studentLimit: 50,
    enrolled: 50,
    teacherIds: ['t1', 't2'],
    archived: false,
  },
  {
    id: 'een',
    code: 'LJ/EEN',
    name: 'English for Engineers',
    description:
      'Technical writing, presentations and meeting English for engineering teams. Level B2.',
    academicYear: '2026/27',
    semester: 'Winter',
    credits: 3,
    studentLimit: 25,
    enrolled: 22,
    teacherIds: ['t5'],
    archived: false,
  },
  {
    id: 'sig',
    code: 'KEMT/SIG',
    name: 'Signals and Systems',
    description:
      'Continuous and discrete signals, Fourier and Z transforms, and filter design with MATLAB.',
    academicYear: '2026/27',
    semester: 'Winter',
    credits: 5,
    studentLimit: 90,
    enrolled: 77,
    teacherIds: ['t4'],
    archived: false,
  },
  {
    id: 'emb',
    code: 'KEMT/EMB',
    name: 'Embedded Systems Design',
    description:
      'Microcontroller programming, real-time constraints and hardware debugging on ARM Cortex-M boards.',
    academicYear: '2026/27',
    semester: 'Winter',
    credits: 5,
    studentLimit: 30,
    enrolled: 30,
    teacherIds: ['t6'],
    archived: false,
  },
  // Archived courses from the previous academic year
  {
    id: 'oop',
    code: 'KPI/OOP',
    name: 'Object-Oriented Programming',
    description: 'Classes, interfaces, patterns and testing in Java.',
    academicYear: '2025/26',
    semester: 'Winter',
    credits: 6,
    studentLimit: 150,
    enrolled: 141,
    teacherIds: ['t6'],
    archived: true,
  },
  {
    id: 'dm',
    code: 'KMAT/DM',
    name: 'Discrete Mathematics',
    description: 'Logic, combinatorics, graph theory and number theory.',
    academicYear: '2025/26',
    semester: 'Winter',
    credits: 5,
    studentLimit: 140,
    enrolled: 128,
    teacherIds: ['t7'],
    archived: true,
  },
  {
    id: 'ads1',
    code: 'KPI/ADS1',
    name: 'Algorithms and Data Structures I',
    description: 'Complexity, sorting, trees and hash tables.',
    academicYear: '2025/26',
    semester: 'Winter',
    credits: 6,
    studentLimit: 130,
    enrolled: 119,
    teacherIds: ['t1'],
    archived: true,
  },
  {
    id: 'os',
    code: 'KPI/OS',
    name: 'Operating Systems',
    description: 'Processes, scheduling, memory management and file systems.',
    academicYear: '2025/26',
    semester: 'Summer',
    credits: 6,
    studentLimit: 110,
    enrolled: 104,
    teacherIds: ['t3'],
    archived: true,
  },
  {
    id: 'net',
    code: 'KPI/NET',
    name: 'Computer Networks',
    description: 'Protocol layers, routing, transport and network security basics.',
    academicYear: '2025/26',
    semester: 'Summer',
    credits: 5,
    studentLimit: 100,
    enrolled: 93,
    teacherIds: ['t6'],
    archived: true,
  },
  {
    id: 'ps',
    code: 'KMAT/PS',
    name: 'Probability and Statistics',
    description: 'Random variables, estimation and hypothesis testing.',
    academicYear: '2025/26',
    semester: 'Summer',
    credits: 5,
    studentLimit: 120,
    enrolled: 108,
    teacherIds: ['t7'],
    archived: true,
  },
]

const prerequisites: Record<string, string[]> = {
  ads2: ['ads1'], cv: ['dm'], ddb: ['os'], swa: ['oop'], aml: ['ps'], sig: ['dm'], os: ['oop'], ps: ['dm'],
}

export const courses: Course[] = baseCourses.map((c) => ({ ...c, ...courseMeta[c.id], prerequisiteIds: prerequisites[c.id] ?? [] }))

/** Courses the demo student is enrolled in at load time. */
export const studentEnrolledIds = ['ads2', 'cv', 'ddb', 'swa', 'aml', 'een']

const baseSessions: Omit<ClassSession, 'teacherId'>[] = [
  { id: 's1', courseId: 'ads2', day: 'Mon', start: '08:00', end: '09:40', type: 'Lecture', room: 'A-112' },
  { id: 's2', courseId: 'swa', day: 'Mon', start: '10:00', end: '11:40', type: 'Lecture', room: 'B-129' },
  { id: 's3', courseId: 'cv', day: 'Mon', start: '13:00', end: '14:40', type: 'Lab', room: 'L-04' },
  { id: 's4', courseId: 'ddb', day: 'Tue', start: '09:00', end: '10:40', type: 'Lecture', room: 'A-112' },
  { id: 's5', courseId: 'aml', day: 'Tue', start: '11:00', end: '12:40', type: 'Lecture', room: 'B-129' },
  { id: 's6', courseId: 'een', day: 'Tue', start: '14:00', end: '15:40', type: 'Seminar', room: 'C-017' },
  { id: 's7', courseId: 'cv', day: 'Wed', start: '08:00', end: '09:40', type: 'Lecture', room: 'A-112' },
  { id: 's8', courseId: 'ads2', day: 'Wed', start: '10:00', end: '11:40', type: 'Practical', room: 'L-02' },
  { id: 's9', courseId: 'sig', day: 'Wed', start: '13:00', end: '14:40', type: 'Lecture', room: 'B-203' },
  { id: 's10', courseId: 'swa', day: 'Thu', start: '09:00', end: '10:40', type: 'Practical', room: 'L-06' },
  { id: 's11', courseId: 'ddb', day: 'Thu', start: '11:00', end: '12:40', type: 'Lab', room: 'L-04' },
  { id: 's12', courseId: 'aml', day: 'Thu', start: '14:00', end: '15:40', type: 'Lab', room: 'L-02' },
  { id: 's13', courseId: 'emb', day: 'Fri', start: '09:00', end: '10:40', type: 'Lab', room: 'L-08' },
]

/** Sessions are run by the course guarantor unless listed here. */
const sessionTeacher: Record<string, string> = { s12: 't2' }

export const sessions: ClassSession[] = baseSessions.map((x) => ({
  ...x,
  teacherId: sessionTeacher[x.id] ?? courses.find((c) => c.id === x.courseId)!.guarantorId,
}))

export const exams: Exam[] = [
  { id: 'e1', courseId: 'ads2', date: '2027-01-13', start: '09:00', room: 'A-112', format: 'Written', term: 'Term 1', capacity: 120, registered: 64, registration: 'open' },
  { id: 'e2', courseId: 'een', date: '2027-01-14', start: '14:00', room: 'C-017', format: 'Oral', term: 'Term 1', capacity: 25, registered: 9, registration: 'open' },
  { id: 'e3', courseId: 'cv', date: '2027-01-15', start: '10:00', room: 'L-04', format: 'Practical', term: 'Term 1', capacity: 40, registered: 21, registration: 'open' },
  { id: 'e4', courseId: 'ddb', date: '2027-01-19', start: '13:00', room: 'B-129', format: 'Written', term: 'Term 1', capacity: 60, registered: 33, registration: 'open' },
  { id: 'e5', courseId: 'swa', date: '2027-01-21', start: '09:00', room: 'B-129', format: 'Oral', term: 'Term 1', capacity: 80, registered: 18, registration: 'open' },
  { id: 'e6', courseId: 'aml', date: '2027-01-26', start: '11:00', room: 'L-02', format: 'Practical', term: 'Term 1', capacity: 50, registered: 12, registration: 'closed' },
  { id: 'e7', courseId: 'ads2', date: '2027-02-03', start: '09:00', room: 'A-112', format: 'Written', term: 'Term 2', capacity: 120, registered: 0, registration: 'closed' },
]

/** Exams the demo student has already registered for. */
export const initialRegisteredExamIds = ['e1', 'e2']

/** The demo student's Grade records: one per course, entries aligned with the course grading scheme. */
export const studentGrades: StudentGrade[] = [
  { courseId: 'ads2', entries: [{ points: 17, date: '2026-10-02' }, { points: 17, date: '2026-10-06' }, { points: null }] },
  { courseId: 'cv', entries: [{ points: 24, date: '2026-10-07' }, { points: null }, { points: null }] },
  { courseId: 'ddb', entries: [{ points: 16, date: '2026-10-01' }, { points: null }, { points: null }] },
  { courseId: 'swa', entries: [{ points: 17, date: '2026-10-05' }, { points: null }, { points: null }] },
  { courseId: 'aml', entries: [{ points: 24, date: '2026-10-08' }, { points: null }, { points: null }] },
  { courseId: 'een', entries: [{ points: 36, date: '2026-10-09' }, { points: null }, { points: null }] },
  { courseId: 'oop', finalizedAt: '2026-01-20', entries: [{ points: 19 }, { points: 19 }, { points: 57 }] },
  { courseId: 'dm', finalizedAt: '2026-01-28', entries: [{ points: 17 }, { points: 16 }, { points: 55 }] },
  { courseId: 'ads1', finalizedAt: '2026-02-04', entries: [{ points: 20 }, { points: 19 }, { points: 58 }] },
  { courseId: 'os', finalizedAt: '2026-06-10', entries: [{ points: 16 }, { points: 17 }, { points: 53 }] },
  { courseId: 'net', finalizedAt: '2026-06-16', entries: [{ points: 15 }, { points: 15 }, { points: 50 }] },
  { courseId: 'ps', finalizedAt: '2026-06-23', entries: [{ points: 14 }, { points: 16 }, { points: 48 }] },
]

export const studyPlan: StudyPlanItem[] = [
  { courseId: 'oop', yearOfStudy: 2, term: 'Winter', mandatory: true },
  { courseId: 'dm', yearOfStudy: 2, term: 'Winter', mandatory: true },
  { courseId: 'ads1', yearOfStudy: 2, term: 'Winter', mandatory: true },
  { courseId: 'os', yearOfStudy: 2, term: 'Summer', mandatory: true },
  { courseId: 'net', yearOfStudy: 2, term: 'Summer', mandatory: true },
  { courseId: 'ps', yearOfStudy: 2, term: 'Summer', mandatory: true },
  { courseId: 'ads2', yearOfStudy: 3, term: 'Winter', mandatory: true },
  { courseId: 'swa', yearOfStudy: 3, term: 'Winter', mandatory: true },
  { courseId: 'een', yearOfStudy: 3, term: 'Winter', mandatory: true },
  { courseId: 'ddb', yearOfStudy: 3, term: 'Winter', mandatory: false },
  { courseId: 'cv', yearOfStudy: 3, term: 'Winter', mandatory: false },
  { courseId: 'aml', yearOfStudy: 3, term: 'Winter', mandatory: false },
  { courseId: 'sig', yearOfStudy: 3, term: 'Winter', mandatory: false },
  { courseId: 'emb', yearOfStudy: 3, term: 'Winter', mandatory: false },
]

export const semesters: Semester[] = [
  {
    id: 'w2627', academicYear: '2026/27', term: 'Winter',
    enrollmentStart: '2026-08-24', enrollmentEnd: '2026-09-27', start: '2026-09-14',
    teachingEnd: '2026-12-18', examStart: '2027-01-04', examEnd: '2027-02-12',
  },
  {
    id: 's2627', academicYear: '2026/27', term: 'Summer',
    enrollmentStart: '2027-01-25', enrollmentEnd: '2027-02-28', start: '2027-02-15',
    teachingEnd: '2027-05-14', examStart: '2027-05-24', examEnd: '2027-06-30',
  },
]

/** Semester used for the calendar export and key dates. */
export const CURRENT_SEMESTER_ID = 'w2627'

export const holidays: Holiday[] = [
  { date: '2026-11-01', title: 'All Saints’ Day' },
  { date: '2026-11-17', title: 'Struggle for Freedom and Democracy Day' },
  { date: '2026-12-24', title: 'Christmas Eve' },
  { date: '2026-12-25', title: 'Christmas Day' },
  { date: '2026-12-26', title: 'St Stephen’s Day' },
  { date: '2027-01-01', title: 'New Year’s Day' },
  { date: '2027-01-06', title: 'Epiphany' },
]

export const notices: Notice[] = [
  { id: 'n1', title: 'Exam registration is open', body: 'Register for first-term exams in the Exams section. Registration closes five days before each exam.', date: '2026-10-07', author: 'Study office', audience: 'all', scope: 'institution' },
  { id: 'n2', title: 'Lab L-04 closed on Tuesday', body: 'Network maintenance. Tuesday labs move to L-02 for this week only.', date: '2026-10-08', author: 'Faculty IT', audience: 'all', scope: 'institution' },
  { id: 'n3', title: 'Library opens until 22:00', body: 'Weekday opening hours are extended through the end of the winter exam period.', date: '2026-10-05', author: 'University library', audience: 'student', scope: 'institution' },
  { id: 'n4', title: 'Grade entry closes on 18 January', body: 'Final marks for the winter semester must be entered by the department deadline.', date: '2026-10-06', author: 'Study office', audience: 'instructor', scope: 'institution' },
  { id: 'n5', title: 'Winter enrollment report is ready', body: 'Course occupancy for the winter semester is on your dashboard and can be exported as CSV.', date: '2026-10-08', author: 'Study office', audience: 'admin', scope: 'institution' },
  { id: 'n6', title: 'Midterm results published', body: 'Midterm results are in your grades. A review session runs during Wednesday’s practical.', date: '2026-10-07', author: 'Assoc. Prof. Peter Horváth', audience: 'all', scope: 'course', courseId: 'ads2' },
  { id: 'n7', title: 'KPI project day on 3 November', body: 'Final-year students present their projects in the main lecture hall. Everyone is welcome.', date: '2026-10-06', author: 'Department of Computers and Informatics', audience: 'all', scope: 'department' },
  { id: 'n8', title: 'Lab 2 feedback is available', body: 'Written feedback on the edge detection lab is attached to each submission.', date: '2026-10-08', author: 'Dr. Lucia Bartošová', audience: 'all', scope: 'course', courseId: 'cv' },
]

export const gradingQueue: GradingTask[] = [
  { id: 'g1', courseId: 'ads2', title: 'Problem set 4', submissions: 86, due: '2026-10-14' },
  { id: 'g2', courseId: 'swa', title: 'Architecture essay (draft)', submissions: 71, due: '2026-10-16' },
  { id: 'g3', courseId: 'aml', title: 'Assignment 1: Baselines', submissions: 50, due: '2026-10-13' },
]

export const roster: RosterStudent[] = [
  { id: 'S-24011', name: 'Adam Kováč' },
  { id: 'S-24027', name: 'Bianka Šimková' },
  { id: 'S-24033', name: 'Dávid Molnár' },
  { id: 'S-24048', name: 'Eliška Tóthová' },
  { id: 'S-24052', name: 'Filip Lukáč' },
  { id: 'S-24066', name: 'Gabriela Hudáková' },
  { id: 'S-24071', name: 'Henrich Varga' },
  { id: 'S-24085', name: 'Ivana Poláková' },
  { id: 'S-24093', name: 'Jakub Baláž' },
  { id: 'S-24104', name: 'Katarína Mrázová' },
  { id: 'S-24112', name: 'Lukáš Sedlák' },
  { id: 'S-24129', name: 'Michaela Oravcová' },
]

/**
 * Points per student in roster order, for the first N components of the course scheme
 * (a full row means the course is complete).
 */
export const rosterGrades: Record<string, number[][]> = {
  ads2: [[19, 18], [16, 15], [12, 11], [18, 17], [9, 8], [17, 16], [14, 13], [8, 6], [19, 20], [13, 12], [11, 9], [17, 15]],
  swa: [[18], [16], [11], [19], [9], [17], [14], [7], [18], [15], [12], [16]],
  aml: [[27], [22], [17], [25], [12], [24], [19], [11], [28], [21], [16], [23]],
  ads1: [[20, 19, 58], [17, 16, 54], [13, 12, 44], [19, 18, 56], [11, 10, 36], [18, 17, 55], [15, 14, 47], [12, 10, 40], [20, 20, 59], [15, 13, 45], [12, 11, 38], [18, 16, 52]],
}

const emailOf = (name: string) =>
  `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.')}@educore.example`

const unitCode = (id: string) => orgUnits.find((u) => u.id === id)?.code ?? ''

/** Directory shown on the admin Users page. */
export const directory: DirectoryUser[] = [
  { id: 'u-admin', name: users.admin.name, email: emailOf(users.admin.name), role: 'admin', unit: 'Study office', active: true },
  ...teachers.map((t) => ({
    id: `u-${t.id}`, name: `${t.title} ${t.name}`, email: emailOf(t.name), role: 'instructor' as const, unit: unitCode(t.orgUnitId), active: true, teacherId: t.id,
  })),
  { id: 'u-eva', name: users.student.name, email: emailOf(users.student.name), role: 'student', unit: 'Applied Informatics', active: true },
  ...roster.map((s, i) => ({
    id: `u-${s.id}`, name: s.name, email: emailOf(s.name), role: 'student' as const, unit: i % 4 === 3 ? 'Informatics' : 'Applied Informatics', active: i !== 7,
  })),
]

export const documents: CourseDocument[] = [
  { id: 'd1', courseId: 'ads2', name: 'ADS2-syllabus.pdf', kind: 'Syllabus', sizeKb: 184, uploadedAt: '2026-09-08' },
  { id: 'd2', courseId: 'ads2', name: 'Lecture-1-graph-basics.pdf', kind: 'Material', sizeKb: 920, uploadedAt: '2026-09-15' },
  { id: 'd3', courseId: 'cv', name: 'CV-syllabus.pdf', kind: 'Syllabus', sizeKb: 152, uploadedAt: '2026-09-09' },
  { id: 'd4', courseId: 'ddb', name: 'DDB-syllabus.pdf', kind: 'Syllabus', sizeKb: 167, uploadedAt: '2026-09-09' },
  { id: 'd5', courseId: 'swa', name: 'SWA-syllabus.pdf', kind: 'Syllabus', sizeKb: 141, uploadedAt: '2026-09-10' },
  { id: 'd6', courseId: 'aml', name: 'AML-syllabus.pdf', kind: 'Syllabus', sizeKb: 175, uploadedAt: '2026-09-10' },
  { id: 'd7', courseId: 'oop', name: 'OOP-syllabus.pdf', kind: 'Syllabus', sizeKb: 133, uploadedAt: '2025-09-12' },
]

export const platform: PlatformSettings = {
  userLimit: 5000,
  usersUsed: 4312,
  storageLimitGb: 250,
  storageUsedGb: 118.4,
}
