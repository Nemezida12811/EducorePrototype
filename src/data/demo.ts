import type {
  Assessment,
  ClassSession,
  Course,
  DemoUser,
  Day,
  Exam,
  FinalMark,
  GradingTask,
  Notice,
  RosterStudent,
  Role,
  Teacher,
} from './types'

export const university = {
  name: 'Technical University of Košice',
  faculty: 'Faculty of Electrical Engineering and Informatics',
}

export const semesterLabel = 'Winter semester 2026/27'

/** The demo has no clock logic: the dashboard always shows this day. */
export const DEMO_DAY: Day = 'Mon'
export const DEMO_DAY_LONG = 'Monday'

export const degree = { requiredCredits: 180, creditsBeforeArchive: 90 }

export const users: Record<Role, DemoUser> = {
  student: { name: 'Eva Nováková', initials: 'EN', detail: 'Applied Informatics, year 3' },
  instructor: { name: 'Peter Horváth', initials: 'PH', detail: 'Associate professor, Informatics' },
}

export const INSTRUCTOR_ID = 't1'

export const teachers: Teacher[] = [
  { id: 't1', name: 'Peter Horváth', title: 'Assoc. Prof.' },
  { id: 't2', name: 'Lucia Bartošová', title: 'Dr.' },
  { id: 't3', name: 'Martin Kolesár', title: 'Prof.' },
  { id: 't4', name: 'Zuzana Mihalová', title: 'Dr.' },
  { id: 't5', name: 'Katarína Ondrejová', title: 'Mgr.' },
  { id: 't6', name: 'Tomáš Gregor', title: 'Dr.' },
  { id: 't7', name: 'Jana Petrášová', title: 'Prof.' },
]

export const courses: Course[] = [
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

/** Courses the demo student is enrolled in this semester. */
export const studentEnrolledIds = ['ads2', 'cv', 'ddb', 'swa', 'aml', 'een']

export const sessions: ClassSession[] = [
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

export const assessments: Assessment[] = [
  { id: 'a1', courseId: 'ads2', title: 'Midterm test', date: '2026-10-06', points: 34, maxPoints: 40 },
  { id: 'a2', courseId: 'ads2', title: 'Problem set 3', date: '2026-10-02', points: 8, maxPoints: 10 },
  { id: 'a3', courseId: 'cv', title: 'Lab 1: Image filtering', date: '2026-09-30', points: 9, maxPoints: 10 },
  { id: 'a4', courseId: 'cv', title: 'Lab 2: Edge detection', date: '2026-10-07', points: 7, maxPoints: 10 },
  { id: 'a5', courseId: 'ddb', title: 'Quiz: Replication', date: '2026-10-01', points: 4, maxPoints: 5 },
  { id: 'a6', courseId: 'swa', title: 'Architecture essay (draft)', date: '2026-10-05', points: 17, maxPoints: 20 },
  { id: 'a7', courseId: 'aml', title: 'Assignment 1: Baselines', date: '2026-10-08', points: 12, maxPoints: 15 },
  { id: 'a8', courseId: 'een', title: 'Technical presentation', date: '2026-10-09', points: 18, maxPoints: 20 },
]

export const finalMarks: FinalMark[] = [
  { courseId: 'oop', mark: 'A', date: '2026-01-20' },
  { courseId: 'dm', mark: 'B', date: '2026-01-28' },
  { courseId: 'ads1', mark: 'A', date: '2026-02-04' },
  { courseId: 'os', mark: 'B', date: '2026-06-10' },
  { courseId: 'net', mark: 'C', date: '2026-06-16' },
  { courseId: 'ps', mark: 'C', date: '2026-06-23' },
]

export const notices: Notice[] = [
  {
    id: 'n1',
    title: 'Exam registration is open',
    body: 'Register for first-term exams in the Exams section. Registration closes five days before each exam.',
    date: '2026-10-07',
    author: 'Study office',
    audience: 'all',
  },
  {
    id: 'n2',
    title: 'Lab L-04 closed on Tuesday',
    body: 'Network maintenance. Tuesday labs move to L-02 for this week only.',
    date: '2026-10-08',
    author: 'Faculty IT',
    audience: 'all',
  },
  {
    id: 'n3',
    title: 'Library opens until 22:00',
    body: 'Weekday opening hours are extended through the end of the winter exam period.',
    date: '2026-10-05',
    author: 'University library',
    audience: 'student',
  },
  {
    id: 'n4',
    title: 'Grade entry closes on 18 January',
    body: 'Final marks for the winter semester must be entered by the department deadline.',
    date: '2026-10-06',
    author: 'Study office',
    audience: 'instructor',
  },
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

/** Points collected so far, in roster order, and the maximum available so far. */
export const rosterScores: Record<string, { max: number; points: number[] }> = {
  ads2: { max: 50, points: [46, 38, 29, 44, 21, 41, 35, 18, 47, 33, 26, 40] },
  swa: { max: 40, points: [34, 31, 22, 37, 19, 35, 28, 15, 36, 30, 24, 33] },
  aml: { max: 30, points: [27, 22, 17, 25, 12, 24, 19, 11, 28, 21, 16, 23] },
}
