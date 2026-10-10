import { Award, BookOpen, CalendarClock, ClipboardCheck, FileCheck2, GraduationCap, Users } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import {
  assessments,
  DEMO_DAY,
  DEMO_DAY_LONG,
  degree,
  finalMarks,
  gradingQueue,
  notices,
  users,
} from '../data/demo'
import { getCourse, myCourses, myExams, mySessions } from '../data/selectors'
import type { Role } from '../data/types'
import { formatDate, formatShortDate, formatWeekdayDate, weightedAverage } from '../lib/format'
import { hrefFor, type RouteId } from '../lib/router'
import { useDemo } from '../state/DemoContext'

export function DashboardPage() {
  const { role } = useDemo()
  return role === 'student' ? <StudentDashboard /> : <InstructorDashboard />
}

function PanelLink({ to, children }: { to: RouteId; children: string }) {
  return (
    <a href={hrefFor(to)} className="text-sm font-semibold underline underline-offset-4 hover:text-ink-soft">
      {children}
    </a>
  )
}

function StudentDashboard() {
  const { registeredExamIds } = useDemo()
  const courses = myCourses('student')
  const semesterCredits = courses.reduce((sum, c) => sum + c.credits, 0)
  const passed = finalMarks.filter((m) => m.mark !== 'FX')
  const earned = degree.creditsBeforeArchive + passed.reduce((sum, m) => sum + getCourse(m.courseId).credits, 0)
  const average = weightedAverage(finalMarks.map((m) => ({ mark: m.mark, credits: getCourse(m.courseId).credits })))
  const nextExam = myExams('student')[0]
  const todayCount = mySessions('student').filter((s) => s.day === DEMO_DAY).length
  const firstName = users.student.name.split(' ')[0]

  const recent = [...assessments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`You have ${todayCount} classes on ${DEMO_DAY_LONG} and ${registeredExamIds.size} exams registered.`}
      />
      <StatGrid>
        <StatCard label="This semester" value={`${semesterCredits} credits`} hint={`${courses.length} courses enrolled`} icon={BookOpen} />
        <StatCard label="Weighted average" value={average.toFixed(2)} hint="Across completed courses, 1.00 is best" icon={Award} />
        <StatCard
          label="Credits earned"
          value={String(earned)}
          hint={`${degree.requiredCredits - earned} left to finish the degree`}
          icon={GraduationCap}
        />
        <StatCard
          label="Next exam"
          value={nextExam ? formatShortDate(nextExam.date) : 'None'}
          hint={nextExam ? `${getCourse(nextExam.courseId).name}, ${nextExam.format.toLowerCase()}` : 'No exams scheduled'}
          icon={ClipboardCheck}
        />
      </StatGrid>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className="flex flex-col gap-10 lg:col-span-3">
          <TodayPanel role="student" />
          <Panel title="Recent results" action={<PanelLink to="grades">All grades</PanelLink>}>
            <ul className="divide-y divide-rose">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-sm text-ink-soft">
                      {getCourse(a.courseId).name}, {formatDate(a.date)}
                    </p>
                  </div>
                  <p className="font-display text-xl font-semibold whitespace-nowrap">
                    {a.points}
                    <span className="text-base font-normal text-ink-soft"> / {a.maxPoints}</span>
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="flex flex-col gap-10 lg:col-span-2">
          <UpcomingExamsPanel role="student" />
          <NoticesPanel role="student" />
        </div>
      </div>
    </>
  )
}

function InstructorDashboard() {
  const courses = myCourses('instructor')
  const students = courses.reduce((sum, c) => sum + c.enrolled, 0)
  const atCapacity = courses.filter((c) => c.enrolled >= c.studentLimit).length
  const submissions = gradingQueue.reduce((sum, g) => sum + g.submissions, 0)
  const nextExam = myExams('instructor')[0]
  const firstName = users.instructor.name.split(' ')[0]

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description={`You teach ${courses.length} courses this semester. ${submissions} submissions are waiting for grades.`}
      />
      <StatGrid>
        <StatCard label="Courses taught" value={String(courses.length)} hint={`${atCapacity} at full capacity`} icon={BookOpen} />
        <StatCard label="Students" value={String(students)} hint="Enrolled across your courses" icon={Users} />
        <StatCard label="Awaiting grading" value={String(submissions)} hint={`Submissions in ${gradingQueue.length} tasks`} icon={FileCheck2} />
        <StatCard
          label="Next exam"
          value={nextExam ? formatShortDate(nextExam.date) : 'None'}
          hint={nextExam ? `${getCourse(nextExam.courseId).name}, ${nextExam.format.toLowerCase()}` : 'No exams scheduled'}
          icon={CalendarClock}
        />
      </StatGrid>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className="flex flex-col gap-10 lg:col-span-3">
          <TodayPanel role="instructor" />
          <Panel title="Grading queue" action={<PanelLink to="instructor">Instructor panel</PanelLink>}>
            <ul className="divide-y divide-rose">
              {[...gradingQueue]
                .sort((a, b) => a.due.localeCompare(b.due))
                .map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-semibold">{g.title}</p>
                      <p className="text-sm text-ink-soft">
                        {getCourse(g.courseId).name}, due {formatDate(g.due)}
                      </p>
                    </div>
                    <Badge tone="soft">{g.submissions} to grade</Badge>
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
        <div className="flex flex-col gap-10 lg:col-span-2">
          <UpcomingExamsPanel role="instructor" />
          <NoticesPanel role="instructor" />
        </div>
      </div>
    </>
  )
}

function TodayPanel({ role }: { role: Role }) {
  const todays = mySessions(role)
    .filter((s) => s.day === DEMO_DAY)
    .sort((a, b) => a.start.localeCompare(b.start))
  return (
    <Panel title={`${DEMO_DAY_LONG}'s classes`} action={<PanelLink to="schedule">Full schedule</PanelLink>}>
      {todays.length === 0 ? (
        <EmptyState title={`No classes on ${DEMO_DAY_LONG}`} />
      ) : (
        <ol className="divide-y divide-rose">
          {todays.map((s) => (
            <li key={s.id} className="grid grid-cols-[6.5rem_1fr] gap-4 py-3 first:pt-0 last:pb-0">
              <p className="font-display text-lg font-semibold">
                {s.start}
                <span className="text-base font-normal text-ink-soft">-{s.end}</span>
              </p>
              <div>
                <p className="font-semibold">{getCourse(s.courseId).name}</p>
                <p className="text-sm text-ink-soft">
                  {s.type}, room {s.room}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function UpcomingExamsPanel({ role }: { role: Role }) {
  const upcoming = myExams(role).slice(0, 3)
  return (
    <Panel title="Upcoming exams" action={<PanelLink to="exams">All exams</PanelLink>}>
      <ul className="divide-y divide-rose">
        {upcoming.map((e) => (
          <li key={e.id} className="py-3 first:pt-0 last:pb-0">
            <p className="font-semibold">{getCourse(e.courseId).name}</p>
            <p className="text-sm text-ink-soft">
              {formatWeekdayDate(e.date)} at {e.start}, {e.format.toLowerCase()}, room {e.room}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function NoticesPanel({ role }: { role: Role }) {
  const list = notices
    .filter((n) => n.audience === 'all' || n.audience === role)
    .sort((a, b) => b.date.localeCompare(a.date))
  return (
    <Panel title="Notices">
      <ul className="divide-y divide-rose">
        {list.map((n) => (
          <li key={n.id} className="py-3 first:pt-0 last:pb-0">
            <h3 className="font-semibold">{n.title}</h3>
            <p className="mt-1 text-sm">{n.body}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {n.author}, {formatDate(n.date)}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
