import { Clock } from 'lucide-react'
import { getCourse, teacherName } from '../../data/selectors'
import type { ClassSession } from '../../data/types'
import { currentSession, formatCountdown, nextSession, spokenRemaining, useDemoNow } from '../../lib/clock'
import { CourseLink } from './CourseLink'

const clockFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })

const describe = (s: ClassSession) => `${s.type}${s.group ? `, group ${s.group}` : ''}, room ${s.room}`

/** Live countdown to the next class on the demo clock. */
export function NextClassCard({ sessions }: { sessions: ClassSession[] }) {
  const now = useDemoNow()
  const next = nextSession(sessions, now)
  const running = currentSession(sessions, now)
  const ms = next ? next.startsAt.getTime() - now.getTime() : 0

  return (
    <section aria-labelledby="next-class-title" className="layer-panel mr-2 mb-10 rounded-md bg-blush p-5 text-wine sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <h2 id="next-class-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Clock aria-hidden="true" className="size-5" />
            Next class
          </h2>
          {next ? (
            <>
              <p className="mt-2 text-xl font-semibold">
                <CourseLink courseId={next.session.courseId} />
              </p>
              <p className="text-ink-soft">
                {describe(next.session)}, {teacherName(next.session.teacherId)}
              </p>
              <p className="mt-1 font-semibold">
                {next.session.day} {next.session.start}-{next.session.end}
              </p>
            </>
          ) : (
            <p className="mt-2 text-ink-soft">No classes in the coming week.</p>
          )}
          {running && (
            <p className="mt-3 text-sm">
              In progress now: <span className="font-semibold">{getCourse(running.session.courseId).name}</span>, until {running.session.end}.
            </p>
          )}
        </div>
        {next && (
          <div className="text-right">
            <p
              role="timer"
              aria-label={`Time until next class: ${spokenRemaining(ms)}`}
              className="font-display text-5xl leading-none font-semibold tracking-tight tabular-nums sm:text-6xl"
            >
              <span aria-hidden="true">{formatCountdown(ms)}</span>
            </p>
          </div>
        )}
      </div>
      <p className="mt-4 border-t border-rose pt-3 text-sm text-ink-soft">
        Demo clock: {clockFormat.format(now)}. It starts on the demo Monday and runs in real time.
      </p>
    </section>
  )
}
