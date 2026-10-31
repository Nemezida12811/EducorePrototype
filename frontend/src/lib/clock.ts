import { useEffect, useState } from 'react'
import type { ClassSession, Day, Term } from '../data/types'

/** The current time, ticking once a second. The clock keeps running while you move between pages. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as yyyy-mm-dd (not UTC: a class at 00:30 must not count as yesterday). */
export const todayIso = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const DAY_BY_JS_INDEX: Day[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const dayOf = (d: Date): Day => DAY_BY_JS_INDEX[d.getDay()]!
export const DAY_LONG: Record<Day, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
}

/** September to January is the winter semester, February to August the summer one. */
export function currentTerm(d: Date = new Date()): { term: Term; academicYear: string; label: string } {
  const month = d.getMonth() + 1
  const year = d.getFullYear()
  const start = month >= 9 ? year : year - 1
  const term: Term = month >= 9 || month === 1 ? 'Winter' : 'Summer'
  const academicYear = `${start}/${start + 1}`
  return { term, academicYear, label: `${term} semester ${academicYear}` }
}

const DAY_NUMBER: Record<Day, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 }

function at(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h!, m!, 0, 0)
  return d
}

export interface UpcomingSession {
  session: ClassSession
  startsAt: Date
}

/** The earliest session that starts after `now`, looking up to a week ahead (the timetable repeats weekly). */
export function nextSession(sessions: ClassSession[], now: Date): UpcomingSession | null {
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(now)
    day.setDate(day.getDate() + offset)
    let best: UpcomingSession | null = null
    for (const session of sessions) {
      if (DAY_NUMBER[session.day] !== day.getDay()) continue
      const startsAt = at(day, session.start)
      if (startsAt <= now) continue
      if (!best || startsAt < best.startsAt) best = { session, startsAt }
    }
    if (best) return best
  }
  return null
}

/** The session running right now, if any. */
export function currentSession(sessions: ClassSession[], now: Date): { session: ClassSession; endsAt: Date } | null {
  for (const session of sessions) {
    if (DAY_NUMBER[session.day] !== now.getDay()) continue
    const endsAt = at(now, session.end)
    if (at(now, session.start) <= now && now < endsAt) return { session, endsAt }
  }
  return null
}

export function splitRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

export function formatCountdown(ms: number): string {
  const { days, hours, minutes, seconds } = splitRemaining(ms)
  return `${days > 0 ? `${days} d ` : ''}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** Plain-language version for screen readers, for example "1 hour 5 minutes". */
export function spokenRemaining(ms: number): string {
  const { days, hours, minutes } = splitRemaining(ms)
  const parts = [
    days ? `${days} ${days === 1 ? 'day' : 'days'}` : '',
    hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
    `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
  ].filter(Boolean)
  return parts.join(' ')
}
