import { CURRENT_SEMESTER_ID, DEMO_TODAY, holidays, semesters } from '../data/demo'
import type { ClassSession, Day } from '../data/types'
import { getCourse } from '../data/selectors'

export interface KeyDate {
  id: string
  label: string
  start: string
  end?: string
  semester: string
}

export function keyDates(): KeyDate[] {
  return semesters.flatMap((s) => {
    const name = `${s.term} ${s.academicYear}`
    return [
      { id: `${s.id}-enroll`, label: 'Enrollment period', start: s.enrollmentStart, end: s.enrollmentEnd, semester: name },
      { id: `${s.id}-start`, label: 'Teaching starts', start: s.start, semester: name },
      { id: `${s.id}-end`, label: 'Teaching ends', start: s.teachingEnd, semester: name },
      { id: `${s.id}-exams`, label: 'Exam period', start: s.examStart, end: s.examEnd, semester: name },
    ]
  })
}

export type DateStatus = 'Past' | 'In progress' | 'Upcoming'

export function statusOf(start: string, end?: string): DateStatus {
  const last = end ?? start
  if (last < DEMO_TODAY) return 'Past'
  if (start > DEMO_TODAY) return 'Upcoming'
  return end ? 'In progress' : 'Upcoming'
}

export const upcomingKeyDates = (n: number): KeyDate[] =>
  [...keyDates(), ...holidays.map((h): KeyDate => ({ id: h.date, label: h.title, start: h.date, semester: 'Holiday' }))]
    .filter((d) => (d.end ?? d.start) >= DEMO_TODAY)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, n)

const DAY_OFFSET: Record<Day, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4 }
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const hm = (t: string) => t.replace(':', '') + '00'
const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`)

/** Weekly repeating events from the first teaching Monday until teaching ends. Times are floating (local). */
export function scheduleToIcs(sessions: ClassSession[]): string {
  const sem = semesters.find((s) => s.id === CURRENT_SEMESTER_ID)!
  const monday = new Date(`${sem.start}T00:00:00`)
  const until = `${sem.teachingEnd.replace(/-/g, '')}T235959`
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EduCore//Schedule//EN', 'CALSCALE:GREGORIAN']
  for (const s of sessions) {
    const d = new Date(monday)
    d.setDate(d.getDate() + DAY_OFFSET[s.day])
    const course = getCourse(s.courseId)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}@educore.example`,
      `DTSTAMP:${ymd(new Date(`${DEMO_TODAY}T00:00:00`))}T000000`,
      `DTSTART:${ymd(d)}T${hm(s.start)}`,
      `DTEND:${ymd(d)}T${hm(s.end)}`,
      `RRULE:FREQ=WEEKLY;UNTIL=${until}`,
      `SUMMARY:${esc(`${course.name} (${s.type})`)}`,
      `LOCATION:${esc(`Room ${s.room}`)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
