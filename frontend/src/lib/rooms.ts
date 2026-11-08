import type { ClassSession, Day, Room, SessionType, Term } from '../data/types'

export const KIND_LABEL = { lecture_hall: 'Lecture hall', classroom: 'Classroom', lab: 'Lab', online: 'Online' } as const

export type RoomFit = 'ok' | 'small' | 'busy'

export interface RoomOption {
  room: Room
  fit: RoomFit
  /** The room is the right kind for the session (a lab for lab work, a classroom or hall otherwise, never an online room). */
  suitable: boolean
  /** When busy: who has the room at that time. */
  busyWith?: string
}

interface Slot {
  day: Day
  start: string
  end: string
}

const overlaps = (a: Slot, b: Slot) => a.day === b.day && a.start < b.end && b.start < a.end

/**
 * Rooms a course may use for one timetable entry, best first. Automatic choice prefers the smallest suitable room that still has at least
 * `needed` seats (the students enrolled, or the planned limit while nobody has enrolled yet), so big rooms stay free for big courses.
 * Order: free + suitable + big enough (fewest seats first), free + big enough but another kind, too small (largest first), occupied.
 */
export function roomOptions(args: {
  rooms: Room[]
  departmentId: string | null
  /** Sessions of other courses plus the other rows of the form. */
  taken: (ClassSession & { label: string })[]
  slot: Slot
  semester: Term
  type: SessionType
  /** Seats the session needs. */
  needed: number
}): RoomOption[] {
  const { rooms, departmentId, taken, slot, semester, type, needed } = args
  const usable = rooms.filter((r) => r.active && (!departmentId || r.departmentIds.includes(departmentId)))
  const sameTerm = taken.filter((t) => !t.semester || t.semester === semester)
  const options = usable.map<RoomOption>((room) => {
    const suitable = room.kind !== 'online' && (room.kind === 'lab') === (type === 'Lab')
    const clash = sameTerm.find((t) => t.room.toLowerCase() === room.code.toLowerCase() && overlaps(t, slot))
    if (clash) return { room, fit: 'busy', suitable, busyWith: clash.label }
    return { room, fit: room.capacity >= needed ? 'ok' : 'small', suitable }
  })
  const rank = (o: RoomOption) => (o.fit === 'busy' ? 3 : o.fit === 'small' ? 2 : o.suitable ? 0 : 1)
  return options.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.fit === 'small' ? b.room.capacity - a.room.capacity : a.room.capacity - b.room.capacity) ||
      a.room.code.localeCompare(b.room.code),
  )
}

/** The automatic pick: the first free suitable room that is big enough; otherwise any free real room that is big enough; otherwise the largest free one. */
export const bestRoom = (options: RoomOption[]): RoomOption | undefined =>
  options.find((o) => o.fit === 'ok' && o.suitable) ??
  options.find((o) => o.fit === 'ok' && o.room.kind !== 'online') ??
  options.find((o) => o.fit === 'small' && o.room.kind !== 'online')
