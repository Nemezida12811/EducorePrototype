import type { ClassSession, Exam } from '../data/types'

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

type Slot = Pick<ClassSession, 'day' | 'start' | 'end'>

/** Same day and the time ranges intersect (back-to-back sessions do not clash). */
export const sessionsOverlap = (a: Slot, b: Slot) =>
  a.day === b.day && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end)

export const sameRoom = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase()

export const slotLabel = (s: Slot) => `${s.day} ${s.start}-${s.end}`

/** Exams are assumed to last two hours. */
export const EXAM_MINUTES = 120

export const examsOverlap = (a: Pick<Exam, 'date' | 'start'>, b: Pick<Exam, 'date' | 'start'>) =>
  a.date === b.date && Math.abs(minutes(a.start) - minutes(b.start)) < EXAM_MINUTES

export interface Clash {
  a: ClassSession
  b: ClassSession
  why: string
}

/**
 * Pairs of sessions that overlap in time.
 * 'any': every overlap (a person cannot attend two things at once).
 * 'resources': only overlaps that share a room or a teacher (institution-wide check).
 */
export function internalClashes(sessions: ClassSession[], mode: 'any' | 'resources'): Clash[] {
  const out: Clash[] = []
  for (let i = 0; i < sessions.length; i += 1) {
    for (let j = i + 1; j < sessions.length; j += 1) {
      const a = sessions[i]
      const b = sessions[j]
      if (!sessionsOverlap(a, b)) continue
      const room = sameRoom(a.room, b.room)
      const teacher = a.teacherId === b.teacherId
      if (mode === 'any') out.push({ a, b, why: 'Overlapping times' })
      else if (room || teacher) out.push({ a, b, why: room && teacher ? `Same room (${a.room}) and same teacher` : room ? `Same room (${a.room})` : 'Same teacher' })
    }
  }
  return out
}
