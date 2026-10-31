import type { CalendarEvent } from '../data/types'

export type DateStatus = 'Past' | 'In progress' | 'Upcoming'

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Status of an academic calendar entry relative to now. A single-day entry stays "Upcoming" until the day is over. */
export function statusOf(e: Pick<CalendarEvent, 'start' | 'end'>, now: Date = new Date()): DateStatus {
  const start = new Date(e.start)
  if (e.end) {
    const end = new Date(e.end)
    if (end < now) return 'Past'
    return start > now ? 'Upcoming' : 'In progress'
  }
  return start < startOfToday() ? 'Past' : 'Upcoming'
}

export const upcomingEvents = (events: CalendarEvent[], n: number): CalendarEvent[] =>
  events
    .filter((e) => statusOf(e) !== 'Past')
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, n)
