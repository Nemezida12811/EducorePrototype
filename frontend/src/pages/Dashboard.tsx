import { Award, BookOpen, CalendarClock, ClipboardCheck, Download, FileCheck2, GraduationCap, HardDrive, Percent, Users } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { NextClassCard } from '../components/ui/NextClassCard'
import { Button } from '../components/ui/Button'
import { CourseLink } from '../components/ui/CourseLink'
import { DataTable, type Column } from '../components/ui/DataTable'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { useCourses, useEvents, useGrades, useOrgUnits, usePlan, usePlatform, usePrograms, useTeachers } from '../data/stores'
import { findCourse, teacherNames } from '../data/selectors'
import type { Course } from '../data/types'
import { upcomingEvents } from '../lib/calendar'
import { download } from '../lib/api'
import { DAY_LONG, dayOf } from '../lib/clock'
import { errorMessage } from '../data/actions'
import { formatDate, formatMb, formatShortDate, formatWeekdayDate, percent, weightedAverage } from '../lib/format'
import { summaryOf } from '../lib/grades'
import { hrefFor, type RouteId } from '../lib/router'
import { useApp } from '../state/AppContext'
import { useMine } from '../state/useMine'
import { useCourseRosters } from '../state/useRosters'
import { useState } from 'react'

export function DashboardPage() {
  const { role } = useApp()
  if (role === 'student') return <StudentDashboard />
  if (role === 'instructor') return <InstructorDashboard />
  if (role === 'admin') return <AdminDashboard />
  return <SuperAdminDashboard />
}

function PanelLink({ to, children }: { to: RouteId; children: string }) {
  return (
    <a href={hrefFor(to)} className="text-sm font-semibold underline underline-offset-4 hover:text-ink-soft">
      {children}
    </a>
  )
}

function Columns({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
      <div className="flex flex-col gap-10 lg:col-span-3">{left}</div>
      <div className="flex flex-col gap-10 lg:col-span-2">{right}</div>
    </div>
  )
}

function StudentDashboard() {
  const { name } = useApp()
  const mine = useMine()
  const courses = useCourses()
  const grades = useGrades()
  const plan = usePlan()
  const semesterCredits = mine.courses.reduce((sum, c) => sum + c.credits, 0)
  const today = dayOf(new Date())

  const rows = grades.flatMap((g) => {
    const course = courses.find((c) => c.id === g.courseId)
    return course ? [{ course, grade: g, s: summaryOf(course.gradingScheme, g) }] : []
  })
  const finished = rows.filter((x) => x.s.complete)
  const earned = plan?.creditsEarned ?? finished.filter((x) => x.s.mark !== 'FX').reduce((sum, x) => sum + x.course.credits, 0)
  const average = weightedAverage(finished.map((x) => ({ mark: x.s.mark!, credits: x.course.credits })))
  const upcoming = mine.exams.filter((e) => e.date >= new Date().toISOString().slice(0, 10))
  const nextExam = upcoming.find((e) => e.registeredByMe) ?? upcoming[0]
  const todayCount = mine.sessions.filter((s) => s.day === today).length
  const registered = mine.exams.filter((e) => e.registeredByMe).length
  const recent = [...rows].sort((a, b) => b.grade.updatedAt.localeCompare(a.grade.updatedAt)).slice(0, 4)

  return (
    <>
      <PageHeader
        title={`Welcome back, ${name.split(' ')[0]}`}
        description={`You have ${todayCount} classes on ${DAY_LONG[today]} and ${registered} exams registered.`}
      />
      <NextClassCard sessions={mine.sessions} />
      <StatGrid>
        <StatCard label="This semester" value={`${semesterCredits} credits`} hint={`${mine.courses.length} courses enrolled`} icon={BookOpen} />
        <StatCard label="Weighted average" value={finished.length ? average.toFixed(2) : '-'} hint="Across completed courses, 1.00 is best" icon={Award} />
        <StatCard
          label="Credits earned"
          value={String(earned)}
          hint={plan?.creditsRequired ? `${Math.max(0, plan.creditsRequired - earned)} left to finish the degree` : 'From courses passed'}
          icon={GraduationCap}
        />
        <StatCard
          label="Next exam"
          value={nextExam ? formatShortDate(nextExam.date) : 'None'}
          hint={nextExam ? `${findCourse(nextExam.courseId)?.name ?? 'Course'}, ${nextExam.format.toLowerCase()}` : 'No exams scheduled'}
          icon={ClipboardCheck}
        />
      </StatGrid>
      <Columns
        left={
          <>
            <TodayPanel />
            <Panel title="Recent results" action={<PanelLink to="grades">All grades</PanelLink>}>
              {recent.length === 0 ? (
                <EmptyState title="No results yet" />
              ) : (
                <ul className="divide-y divide-rose">
                  {recent.map((r) => (
                    <li key={r.course.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-semibold">
                          <CourseLink courseId={r.course.id} />
                        </p>
                        <p className="text-sm text-ink-soft">
                          {r.s.complete ? `Final mark ${r.s.mark}` : 'In progress'}, {formatDate(r.grade.updatedAt)}
                        </p>
                      </div>
                      <p className="font-display text-xl font-semibold whitespace-nowrap">
                        {r.s.total}
                        <span className="text-base font-normal text-ink-soft"> / {r.s.complete ? 100 : r.s.graded}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        }
        right={
          <>
            <UpcomingExamsPanel />
            <KeyDatesPanel />
            <NoticesPanel />
          </>
        }
      />
    </>
  )
}

function InstructorDashboard() {
  const { name } = useApp()
  const mine = useMine()
  const rosters = useCourseRosters(mine.courses.map((c) => c.id))
  const students = mine.courses.reduce((sum, c) => sum + c.enrolled, 0)
  const atCapacity = mine.courses.filter((c) => c.enrolled >= c.studentLimit).length
  const queue = mine.courses
    .map((c) => ({ course: c, waiting: (rosters[c.id] ?? []).filter((r) => r.finalScore === null).length }))
    .filter((q) => q.waiting > 0)
  const waiting = queue.reduce((sum, q) => sum + q.waiting, 0)
  const nextExam = mine.exams.find((e) => e.date >= new Date().toISOString().slice(0, 10))

  return (
    <>
      <PageHeader
        title={`Good to see you, ${name.split(' ')[0]}`}
        description={`You teach ${mine.courses.length} courses this semester. ${waiting} students are still waiting for a final grade.`}
      />
      <NextClassCard sessions={mine.sessions} />
      <StatGrid>
        <StatCard label="Courses taught" value={String(mine.courses.length)} hint={`${atCapacity} at full capacity`} icon={BookOpen} />
        <StatCard label="Students" value={String(students)} hint="Enrolled across your courses" icon={Users} />
        <StatCard label="Awaiting grading" value={String(waiting)} hint={`Students without a final grade in ${queue.length} courses`} icon={FileCheck2} />
        <StatCard
          label="Next exam"
          value={nextExam ? formatShortDate(nextExam.date) : 'None'}
          hint={nextExam ? `${findCourse(nextExam.courseId)?.name ?? 'Course'}, ${nextExam.format.toLowerCase()}` : 'No exams scheduled'}
          icon={CalendarClock}
        />
      </StatGrid>
      <Columns
        left={
          <>
            <TodayPanel />
            <Panel title="Grading queue" action={<PanelLink to="instructor">Instructor panel</PanelLink>}>
              {queue.length === 0 ? (
                <EmptyState title="Everyone is graded" />
              ) : (
                <ul className="divide-y divide-rose">
                  {queue.map((q) => (
                    <li key={q.course.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <p className="font-semibold">
                        <CourseLink courseId={q.course.id} />
                      </p>
                      <Badge tone="soft">{q.waiting} to grade</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        }
        right={
          <>
            <UpcomingExamsPanel />
            <KeyDatesPanel />
            <NoticesPanel />
          </>
        }
      />
    </>
  )
}

function AdminDashboard() {
  const { name } = useApp()
  const [error, setError] = useState('')
  const courses = useCourses()
  const teachers = useTeachers()
  const orgUnits = useOrgUnits()
  const studyPrograms = usePrograms()
  const active = courses.filter((c) => !c.archived)
  const taken = active.reduce((s, c) => s + c.enrolled, 0)
  const limit = active.reduce((s, c) => s + c.studentLimit, 0)
  const studentsTotal = studyPrograms.reduce((s, p) => s + p.students, 0)
  const departments = orgUnits.length

  const columns: Column<Course>[] = [
    {
      header: 'Course',
      rowHeader: true,
      cell: (c) => (
        <>
          <CourseLink courseId={c.id} />
          <span className="block text-sm font-normal text-ink-soft">{c.code}, {teacherNames(c).join(', ')}</span>
        </>
      ),
    },
    { header: 'Seats', cell: (c) => <span className="whitespace-nowrap">{c.enrolled} of {c.studentLimit}</span> },
    {
      header: 'Occupancy',
      align: 'right',
      cell: (c) => (
        <div className="ml-auto flex items-center gap-3">
          <div className="w-24">
            <ProgressBar value={c.enrolled} max={c.studentLimit} label={`${c.name} occupancy`} />
          </div>
          <span className="w-10 text-right font-semibold">{percent(c.enrolled, c.studentLimit)}%</span>
        </div>
      ),
    },
  ]

  const exportCsv = () => download('/reports/export?report=occupancy&format=csv', {}, 'course-occupancy.csv').catch((e) => setError(errorMessage(e)))

  return (
    <>
      <PageHeader
        title={`Hello, ${name.split(' ')[0]}`}
        description="Institution overview: occupancy, key dates and notices."
      />
      <p role="alert" className="mb-4 font-semibold empty:hidden">{error}</p>
      <StatGrid>
        <StatCard label="Active courses" value={String(active.length)} hint={`${courses.length - active.length} in the archive`} icon={BookOpen} />
        <StatCard label="Seats filled" value={`${percent(taken, limit)}%`} hint={`${taken} of ${limit} seats`} icon={Percent} />
        <StatCard label="Teachers" value={String(teachers.length)} hint={`Across ${departments} departments`} icon={Users} />
        <StatCard label="Students" value={String(studentsTotal)} hint={`In ${studyPrograms.length} study programs`} icon={GraduationCap} />
      </StatGrid>
      <Columns
        left={
          <Panel
            title="Course occupancy"
            flush
            action={
              <Button variant="secondary" onClick={exportCsv}>
                <Download aria-hidden="true" className="mr-2 size-4" />
                Export CSV
              </Button>
            }
          >
            <DataTable caption="Seat occupancy of active courses" columns={columns} rows={active} getKey={(c) => c.id} />
          </Panel>
        }
        right={
          <>
            <KeyDatesPanel />
            <NoticesPanel />
          </>
        }
      />
    </>
  )
}

function SuperAdminDashboard() {
  const { name } = useApp()
  const platform = usePlatform()
  const courses = useCourses()
  const teachers = useTeachers()
  const active = courses.filter((c) => !c.archived).length
  if (!platform) return <PageHeader title="Platform" description="Platform data is not available." />

  return (
    <>
      <PageHeader
        title={`Hello, ${name.split(' ')[0]}`}
        description="Platform overview: users, storage and limits."
      />
      <StatGrid>
        <StatCard label="Users" value={platform.usersUsed.toLocaleString('en-GB')} hint={`Limit ${platform.userLimit.toLocaleString('en-GB')}`} icon={Users} />
        <StatCard label="Storage used" value={formatMb(platform.storageUsedMb)} hint={`Limit ${formatMb(platform.storageLimitMb)}`} icon={HardDrive} />
        <StatCard label="Active courses" value={String(active)} hint={`${courses.length - active} archived`} icon={BookOpen} />
        <StatCard label="Teachers" value={String(teachers.length)} hint="With a teaching account" icon={GraduationCap} />
      </StatGrid>
      <Panel title="Limits" action={<PanelLink to="platform">Edit limits</PanelLink>}>
        <ul className="flex flex-col gap-5">
          <li>
            <div className="mb-2 flex justify-between gap-3">
              <span className="font-semibold">Users</span>
              <span>{platform.usersUsed.toLocaleString('en-GB')} of {platform.userLimit.toLocaleString('en-GB')}</span>
            </div>
            <ProgressBar value={platform.usersUsed} max={platform.userLimit} label="User usage" />
          </li>
          <li>
            <div className="mb-2 flex justify-between gap-3">
              <span className="font-semibold">Storage</span>
              <span>{formatMb(platform.storageUsedMb)} of {formatMb(platform.storageLimitMb)}</span>
            </div>
            <ProgressBar value={platform.storageUsedMb} max={platform.storageLimitMb} label="Storage usage" />
          </li>
        </ul>
      </Panel>
    </>
  )
}

function TodayPanel() {
  const mine = useMine()
  const today = dayOf(new Date())
  const todays = mine.sessions.filter((s) => s.day === today).sort((a, b) => a.start.localeCompare(b.start))
  return (
    <Panel title={`${DAY_LONG[today]}'s classes`} action={<PanelLink to="schedule">Full schedule</PanelLink>}>
      {todays.length === 0 ? (
        <EmptyState title={`No classes on ${DAY_LONG[today]}`} />
      ) : (
        <ol className="divide-y divide-rose">
          {todays.map((s) => (
            <li key={s.id} className="grid grid-cols-[6.5rem_1fr] gap-4 py-3 first:pt-0 last:pb-0">
              <p className="font-display text-lg font-semibold">
                {s.start}
                <span className="text-base font-normal text-ink-soft">-{s.end}</span>
              </p>
              <div>
                <p className="font-semibold">
                  <CourseLink courseId={s.courseId} />
                </p>
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

function UpcomingExamsPanel() {
  const upcoming = useMine().exams.filter((e) => e.date >= new Date().toISOString().slice(0, 10)).slice(0, 3)
  return (
    <Panel title="Upcoming exams" action={<PanelLink to="exams">All exams</PanelLink>}>
      {upcoming.length === 0 && <EmptyState title="No upcoming exams" />}
      <ul className="divide-y divide-rose">
        {upcoming.map((e) => (
          <li key={e.id} className="py-3 first:pt-0 last:pb-0">
            <p className="font-semibold">
              <CourseLink courseId={e.courseId} />
            </p>
            <p className="text-sm text-ink-soft">
              {formatWeekdayDate(e.date)} at {e.start}, {e.format.toLowerCase()}, room {e.room}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function KeyDatesPanel() {
  const dates = upcomingEvents(useEvents(), 3)
  return (
    <Panel title="Key dates" action={<PanelLink to="calendar">Calendar</PanelLink>}>
      {dates.length === 0 && <EmptyState title="No upcoming dates" />}
      <ul className="divide-y divide-rose">
        {dates.map((d) => (
          <li key={d.id} className="py-3 first:pt-0 last:pb-0">
            <p className="font-semibold">{d.title}</p>
            <p className="text-sm text-ink-soft">
              {formatDate(d.start)}
              {d.end ? ` to ${formatDate(d.end)}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function NoticesPanel() {
  const { notices, unread } = useMine()
  return (
    <Panel
      title={unread > 0 ? `Notices (${unread} unread)` : 'Notices'}
      action={<PanelLink to="notices">All notices</PanelLink>}
    >
      {notices.length === 0 && <EmptyState title="No notices" />}
      <ul className="divide-y divide-rose">
        {notices.slice(0, 3).map((n) => (
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
