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
import {
  DEMO_DAY,
  DEMO_DAY_LONG,
  degree,
  gradingQueue,
  studentGrades,
  users,
} from '../data/demo'
import { useCourses, useOrgUnits, usePlatform, usePrograms, useTeachers } from '../data/stores'
import { getCourse, teacherNames } from '../data/selectors'
import type { Course } from '../data/types'
import { upcomingKeyDates } from '../lib/calendar'
import { downloadFile, toCsv } from '../lib/download'
import { formatDate, formatShortDate, formatWeekdayDate, percent, weightedAverage } from '../lib/format'
import { summaryFor } from '../lib/grades'
import { hrefFor, type RouteId } from '../lib/router'
import { useDemo } from '../state/DemoContext'
import { useMine } from '../state/useMine'

export function DashboardPage() {
  const { role } = useDemo()
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
  const { registeredExamIds } = useDemo()
  const mine = useMine()
  const semesterCredits = mine.courses.reduce((sum, c) => sum + c.credits, 0)

  const finished = studentGrades
    .map((g) => ({ course: getCourse(g.courseId), s: summaryFor(getCourse(g.courseId), g) }))
    .filter((x) => x.s.complete)
  const earned = degree.creditsBeforeArchive + finished.filter((x) => x.s.mark !== 'FX').reduce((sum, x) => sum + x.course.credits, 0)
  const average = weightedAverage(finished.map((x) => ({ mark: x.s.mark!, credits: x.course.credits })))
  const nextExam = mine.exams[0]
  const todayCount = mine.sessions.filter((s) => s.day === DEMO_DAY).length
  const firstName = users.student.name.split(' ')[0]

  const recent = studentGrades
    .filter((g) => !g.finalizedAt)
    .flatMap((g) => {
      const course = getCourse(g.courseId)
      return g.entries.flatMap((e, i) =>
        e.points !== null && e.date ? [{ id: `${g.courseId}-${i}`, course, name: course.gradingScheme[i].name, max: course.gradingScheme[i].max, points: e.points, date: e.date }] : [],
      )
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4)

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`You have ${todayCount} classes on ${DEMO_DAY_LONG} and ${registeredExamIds.size} exams registered.`}
      />
      <NextClassCard sessions={mine.sessions} />
      <StatGrid>
        <StatCard label="This semester" value={`${semesterCredits} credits`} hint={`${mine.courses.length} courses enrolled`} icon={BookOpen} />
        <StatCard label="Weighted average" value={average.toFixed(2)} hint="Across completed courses, 1.00 is best" icon={Award} />
        <StatCard label="Credits earned" value={String(earned)} hint={`${degree.requiredCredits - earned} left to finish the degree`} icon={GraduationCap} />
        <StatCard
          label="Next exam"
          value={nextExam ? formatShortDate(nextExam.date) : 'None'}
          hint={nextExam ? `${getCourse(nextExam.courseId).name}, ${nextExam.format.toLowerCase()}` : 'No exams scheduled'}
          icon={ClipboardCheck}
        />
      </StatGrid>
      <Columns
        left={
          <>
            <TodayPanel />
            <Panel title="Recent results" action={<PanelLink to="grades">All grades</PanelLink>}>
              <ul className="divide-y divide-rose">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-sm text-ink-soft">
                        <CourseLink courseId={r.course.id} />, {formatDate(r.date)}
                      </p>
                    </div>
                    <p className="font-display text-xl font-semibold whitespace-nowrap">
                      {r.points}
                      <span className="text-base font-normal text-ink-soft"> / {r.max}</span>
                    </p>
                  </li>
                ))}
              </ul>
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
  const mine = useMine()
  const students = mine.courses.reduce((sum, c) => sum + c.enrolled, 0)
  const atCapacity = mine.courses.filter((c) => c.enrolled >= c.studentLimit).length
  const submissions = gradingQueue.reduce((sum, g) => sum + g.submissions, 0)
  const nextExam = mine.exams[0]
  const firstName = users.instructor.name.split(' ')[0]

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description={`You teach ${mine.courses.length} courses this semester. ${submissions} submissions are waiting for grades.`}
      />
      <NextClassCard sessions={mine.sessions} />
      <StatGrid>
        <StatCard label="Courses taught" value={String(mine.courses.length)} hint={`${atCapacity} at full capacity`} icon={BookOpen} />
        <StatCard label="Students" value={String(students)} hint="Enrolled across your courses" icon={Users} />
        <StatCard label="Awaiting grading" value={String(submissions)} hint={`Submissions in ${gradingQueue.length} tasks`} icon={FileCheck2} />
        <StatCard
          label="Next exam"
          value={nextExam ? formatShortDate(nextExam.date) : 'None'}
          hint={nextExam ? `${getCourse(nextExam.courseId).name}, ${nextExam.format.toLowerCase()}` : 'No exams scheduled'}
          icon={CalendarClock}
        />
      </StatGrid>
      <Columns
        left={
          <>
            <TodayPanel />
            <Panel title="Grading queue" action={<PanelLink to="instructor">Instructor panel</PanelLink>}>
              <ul className="divide-y divide-rose">
                {[...gradingQueue]
                  .sort((a, b) => a.due.localeCompare(b.due))
                  .map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-semibold">{g.title}</p>
                        <p className="text-sm text-ink-soft">
                          <CourseLink courseId={g.courseId} />, due {formatDate(g.due)}
                        </p>
                      </div>
                      <Badge tone="soft">{g.submissions} to grade</Badge>
                    </li>
                  ))}
              </ul>
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
  const { seatsTaken } = useDemo()
  const courses = useCourses()
  const teachers = useTeachers()
  const orgUnits = useOrgUnits()
  const studyPrograms = usePrograms()
  const active = courses.filter((c) => !c.archived)
  const taken = active.reduce((s, c) => s + seatsTaken(c), 0)
  const limit = active.reduce((s, c) => s + c.studentLimit, 0)
  const studentsTotal = studyPrograms.reduce((s, p) => s + p.students, 0)
  const departments = orgUnits.filter((u) => u.parentId !== null).length

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
    { header: 'Seats', cell: (c) => <span className="whitespace-nowrap">{seatsTaken(c)} of {c.studentLimit}</span> },
    {
      header: 'Occupancy',
      align: 'right',
      cell: (c) => (
        <div className="ml-auto flex items-center gap-3">
          <div className="w-24">
            <ProgressBar value={seatsTaken(c)} max={c.studentLimit} label={`${c.name} occupancy`} />
          </div>
          <span className="w-10 text-right font-semibold">{percent(seatsTaken(c), c.studentLimit)}%</span>
        </div>
      ),
    },
  ]

  const exportCsv = () =>
    downloadFile(
      'course-occupancy.csv',
      'text/csv',
      toCsv([
        ['Code', 'Course', 'Teachers', 'Seats taken', 'Student limit', 'Occupancy %'],
        ...active.map((c) => [c.code, c.name, teacherNames(c).join('; '), seatsTaken(c), c.studentLimit, percent(seatsTaken(c), c.studentLimit)]),
      ]),
    )

  return (
    <>
      <PageHeader
        title={`Hello, ${users.admin.name.split(' ')[0]}`}
        description="Institution overview for the winter semester: occupancy, key dates and notices."
      />
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
  const platform = usePlatform()
  const courses = useCourses()
  const teachers = useTeachers()
  const active = courses.filter((c) => !c.archived).length

  return (
    <>
      <PageHeader
        title={`Hello, ${users_name()}`}
        description="Platform overview: users, storage and limits."
      />
      <StatGrid>
        <StatCard label="Users" value={platform.usersUsed.toLocaleString('en-GB')} hint={`Limit ${platform.userLimit.toLocaleString('en-GB')}`} icon={Users} />
        <StatCard label="Storage used" value={`${Math.round(platform.storageUsedGb)} GB`} hint={`Limit ${platform.storageLimitGb} GB`} icon={HardDrive} />
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
              <span>{platform.storageUsedGb} of {platform.storageLimitGb} GB</span>
            </div>
            <ProgressBar value={platform.storageUsedGb} max={platform.storageLimitGb} label="Storage usage" />
          </li>
        </ul>
      </Panel>
    </>
  )
}

const users_name = () => users.superadmin.name.split(' ')[0]

function TodayPanel() {
  const mine = useMine()
  const todays = mine.sessions.filter((s) => s.day === DEMO_DAY).sort((a, b) => a.start.localeCompare(b.start))
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
  const upcoming = useMine().exams.slice(0, 3)
  return (
    <Panel title="Upcoming exams" action={<PanelLink to="exams">All exams</PanelLink>}>
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
  const dates = upcomingKeyDates(3)
  return (
    <Panel title="Key dates" action={<PanelLink to="calendar">Calendar</PanelLink>}>
      <ul className="divide-y divide-rose">
        {dates.map((d) => (
          <li key={d.id} className="py-3 first:pt-0 last:pb-0">
            <p className="font-semibold">{d.label}</p>
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
