import { useEffect, useState } from 'react'
import { DEMO_TODAY } from '../data/demo'
import type { ClassSession, Day } from '../data/types'

/** The demo clock starts on the demo Monday at this time, then runs in real time. */
export const DEMO_START_TIME = '07:45:00'

const startedAt = Date.now()
const base = new Date(`${DEMO_TODAY}T${DEMO_START_TIME}`).getTime()
const read = () => new Date(base + (Date.now() - startedAt))

/** Simulated "now", ticking once a second. The clock keeps running while you move between pages. */
export function useDemoNow(): Date {
  const [now, setNow] = useState(read)
  useEffect(() => {
    const id = setInterval(() => setNow(read()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

const DAY_NUMBER: Record<Day, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 }

function at(date: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
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

const pad = (n: number) => String(n).padStart(2, '0')

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
