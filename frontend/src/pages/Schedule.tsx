import { CheckCircle2, Download, TriangleAlert } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CourseLink } from '../components/ui/CourseLink'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import type { ClassSession, Day, SessionType } from '../data/types'
import { download } from '../lib/api'
import { currentTerm, dayOf } from '../lib/clock'
import { errorMessage } from '../data/actions'
import { useAllSessions } from '../data/stores'
import { findCourse, teacherName } from '../data/selectors'
import { internalClashes, slotLabel } from '../lib/conflicts'
import { useApp } from '../state/AppContext'
import { useState } from 'react'
import { useMine } from '../state/useMine'

const DAYS: { key: Day; label: string }[] = [
  { key: 'Mon', label: 'Monday' },
  { key: 'Tue', label: 'Tuesday' },
  { key: 'Wed', label: 'Wednesday' },
  { key: 'Thu', label: 'Thursday' },
  { key: 'Fri', label: 'Friday' },
  { key: 'Sat', label: 'Saturday' },
  { key: 'Sun', label: 'Sunday' },
]

// The type is always written out; the border colour is only a secondary cue.
const TYPE_BORDER: Record<SessionType, string> = {
  Lecture: 'border-wine',
  Practical: 'border-mauve',
  Lab: 'border-rose',
  Seminar: 'border-wine-soft',
}

export function SchedulePage() {
  const { role } = useApp()
  const { sessions } = useMine()
  const allSessions = useAllSessions()
  const [error, setError] = useState('')
  const today = dayOf(new Date())
  // Weekend days only appear when something is scheduled on them.
  const days = DAYS.filter((d) => (d.key !== 'Sat' && d.key !== 'Sun') || sessions.some((s) => s.day === d.key))

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`${role === 'student' ? 'Your weekly timetable' : role === 'instructor' ? 'Your weekly teaching timetable' : 'The institution timetable'} for the ${currentTerm().label.toLowerCase()}.`}
        action={
          role === 'student' || role === 'instructor' ? (
            <Button
              variant="secondary"
              className="bg-blush"
              onClick={() => download('/schedule/me/export', {}, 'schedule.ics').catch((e) => setError(errorMessage(e)))}
            >
              <Download aria-hidden="true" className="mr-2 size-4" />
              Export to calendar (.ics)
            </Button>
          ) : undefined
        }
      />
      <p role="alert" className="mb-6 font-semibold empty:hidden">{error}</p>
      <ScheduleCheck sessions={role === 'admin' || role === 'superadmin' ? allSessions : sessions} mode={role === 'admin' || role === 'superadmin' ? 'resources' : 'any'} />
      <Panel title="Week">
        <ol className="divide-y divide-rose">
          {days.map((day) => {
            const items = sessions.filter((s) => s.day === day.key).sort((a, b) => a.start.localeCompare(b.start))
            return (
              <li key={day.key} className="grid gap-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[8rem_1fr] md:gap-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold md:block">
                  {day.label}
                  {day.key === today && (
                    <span className="md:mt-1 md:block">
                      <Badge tone="solid">Today</Badge>
                    </span>
                  )}
                </h3>
                {items.length === 0 ? (
                  <p className="self-center text-ink-soft">No classes</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((s) => (
                      <li key={s.id} className={`rounded-sm border-l-4 bg-fog px-4 py-3 ${TYPE_BORDER[s.type]}`}>
                        <p className="font-display text-lg font-semibold">
                          {s.start}-{s.end}
                        </p>
                        <p className="font-semibold">
                          <CourseLink courseId={s.courseId} />
                        </p>
                        <p className="text-sm text-ink-soft">
                          {s.type}, room {s.room}
                        </p>
                        {role !== 'instructor' && <p className="text-sm text-ink-soft">{teacherName(s.teacherId)}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </Panel>
    </>
  )
}

function ScheduleCheck({ sessions, mode }: { sessions: ClassSession[]; mode: 'any' | 'resources' }) {
  const clashes = internalClashes(sessions, mode)
  const line = (s: ClassSession) => `${findCourse(s.courseId)?.name ?? 'Course'}, ${slotLabel(s)}, room ${s.room}, ${teacherName(s.teacherId)}`
  return (
    <div className="mb-10">
      <Panel title="Schedule check">
        {clashes.length === 0 ? (
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
            {mode === 'resources' ? 'No room or teacher is double-booked.' : 'No overlapping sessions.'}
          </p>
        ) : (
          <>
            <p className="mb-3 flex items-center gap-2 font-semibold" role="alert">
              <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
              {clashes.length} {clashes.length === 1 ? 'clash' : 'clashes'} found
            </p>
            <ul className="divide-y divide-rose">
              {clashes.map((c) => (
                <li key={`${c.a.id}-${c.b.id}`} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-semibold">{c.why}</p>
                  <p className="text-sm text-ink-soft">{line(c.a)}</p>
                  <p className="text-sm text-ink-soft">{line(c.b)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  )
}
