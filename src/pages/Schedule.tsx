import { Download } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CourseLink } from '../components/ui/CourseLink'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { DEMO_DAY, semesterLabel } from '../data/demo'
import type { Day, SessionType } from '../data/types'
import { scheduleToIcs } from '../lib/calendar'
import { downloadFile } from '../lib/download'
import { useDemo } from '../state/DemoContext'
import { useMine } from '../state/useMine'

const DAYS: { key: Day; label: string }[] = [
  { key: 'Mon', label: 'Monday' },
  { key: 'Tue', label: 'Tuesday' },
  { key: 'Wed', label: 'Wednesday' },
  { key: 'Thu', label: 'Thursday' },
  { key: 'Fri', label: 'Friday' },
]

// The type is always written out; the border colour is only a secondary cue.
const TYPE_BORDER: Record<SessionType, string> = {
  Lecture: 'border-wine',
  Practical: 'border-mauve',
  Lab: 'border-rose',
  Seminar: 'border-wine-soft',
}

export function SchedulePage() {
  const { role } = useDemo()
  const { sessions } = useMine()

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`${role === 'student' ? 'Your weekly timetable' : role === 'instructor' ? 'Your weekly teaching timetable' : 'The institution timetable'} for the ${semesterLabel.toLowerCase()}.`}
        action={
          <Button
            variant="secondary"
            className="bg-blush"
            onClick={() => downloadFile('educore-schedule.ics', 'text/calendar', scheduleToIcs(sessions))}
          >
            <Download aria-hidden="true" className="mr-2 size-4" />
            Export to calendar (.ics)
          </Button>
        }
      />
      <Panel title="Week">
        <ol className="divide-y divide-rose">
          {DAYS.map((day) => {
            const items = sessions.filter((s) => s.day === day.key).sort((a, b) => a.start.localeCompare(b.start))
            return (
              <li key={day.key} className="grid gap-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[8rem_1fr] md:gap-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold md:block">
                  {day.label}
                  {day.key === DEMO_DAY && (
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
