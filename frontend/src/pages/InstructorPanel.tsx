import { useId, useState } from 'react'
import { ArrowRight, Gauge, GraduationCap, Layers, Users } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { CourseLink } from '../components/ui/CourseLink'
import { DataTable, type Column } from '../components/ui/DataTable'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { teacherNames } from '../data/selectors'
import type { Course, RosterRow } from '../data/types'
import { percent } from '../lib/format'
import { summaryOf } from '../lib/grades'
import { courseHref } from '../lib/router'
import { useMine } from '../state/useMine'
import { useCourseRosters } from '../state/useRosters'

type Row = RosterRow & { total: number; graded: number }

export function InstructorPanelPage() {
  const taught = useMine().courses
  const rosters = useCourseRosters(taught.map((c) => c.id))
  const [chosen, setChosen] = useState('')
  const selectId = useId()
  const course: Course | undefined = taught.find((c) => c.id === chosen) ?? taught[0]

  if (!course) {
    return (
      <>
        <PageHeader title="Instructor panel" description="Roster, course details and grading work for the courses you teach." />
        <EmptyState title="You do not teach any active course">Courses you are a teacher of appear here.</EmptyState>
      </>
    )
  }

  const rowsFor = (c: Course): Row[] =>
    (rosters[c.id] ?? []).map((r) => {
      const sum = summaryOf(c.gradingScheme, r)
      return { ...r, total: sum.total, graded: sum.graded }
    })

  const rows = rowsFor(course)
  const students = taught.reduce((sum, c) => sum + c.enrolled, 0)
  const queue = taught
    .map((c) => ({ course: c, waiting: (rosters[c.id] ?? []).filter((r) => r.finalScore === null).length }))
    .filter((q) => q.waiting > 0)
  const waiting = queue.reduce((sum, q) => sum + q.waiting, 0)
  const all = taught.flatMap((c) => rowsFor(c).filter((r) => r.graded > 0).map((r) => percent(r.total, r.graded)))
  const classAverage = all.length === 0 ? 0 : Math.round(all.reduce((a, b) => a + b, 0) / all.length)

  const columns: Column<Row>[] = [
    {
      header: 'Student',
      rowHeader: true,
      cell: (s) => (
        <>
          {s.name}
          <span className="block text-sm font-normal text-ink-soft">{s.email}</span>
        </>
      ),
    },
    { header: 'Points', cell: (s) => <span className="whitespace-nowrap">{s.total} / {s.graded}</span> },
    {
      header: 'Progress',
      cell: (s) => (
        <div className="w-28">
          <ProgressBar value={s.total} max={s.graded} label={`${s.name} progress`} />
        </div>
      ),
    },
    {
      header: 'Status',
      align: 'right',
      cell: (s) => (s.graded === 0 || s.total / s.graded >= 0.5 ? <Badge tone="soft">On track</Badge> : <Badge tone="solid">Needs attention</Badge>),
    },
  ]

  return (
    <>
      <PageHeader title="Instructor panel" description="Roster, course details and grading work for the courses you teach." />
      <StatGrid>
        <StatCard label="Courses taught" value={String(taught.length)} hint="Active this semester" icon={Layers} />
        <StatCard label="Students" value={String(students)} hint="Enrolled across your courses" icon={Users} />
        <StatCard label="Awaiting grading" value={String(waiting)} hint={`Students without a final grade in ${queue.length} courses`} icon={GraduationCap} />
        <StatCard label="Class average" value={`${classAverage}%`} hint="Of points available so far" icon={Gauge} />
      </StatGrid>

      <div className="mb-8">
        <label htmlFor={selectId} className="mb-2 block font-medium">
          Course
        </label>
        <select
          id={selectId}
          value={course.id}
          onChange={(e) => setChosen(e.target.value)}
          className="min-h-11 w-full max-w-md rounded-md border-2 border-wine bg-blush px-3 font-semibold text-wine"
        >
          {taught.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Panel title="Roster" flush>
            <DataTable caption={`Roster for ${course.name}`} columns={columns} rows={rows} getKey={(s) => s.id} />
            <p className="px-6 pt-3 pb-3 text-sm text-ink-soft">
              Showing {rows.length} of {course.enrolled} enrolled students.
            </p>
          </Panel>
        </div>

        <div className="flex flex-col gap-10 lg:col-span-2">
          <Panel title="Course details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
              <dt className="text-ink-soft">Name</dt>
              <dd className="font-semibold">{course.name}</dd>
              <dt className="text-ink-soft">Code</dt>
              <dd>{course.code}</dd>
              <dt className="text-ink-soft">Year</dt>
              <dd>
                {course.academicYear}, {course.semester.toLowerCase()}
              </dd>
              <dt className="text-ink-soft">Teachers</dt>
              <dd>{teacherNames(course).join(', ')}</dd>
              <dt className="text-ink-soft">Student limit</dt>
              <dd>
                {course.enrolled} of {course.studentLimit}
              </dd>
            </dl>
            <p className="mt-4 border-t border-rose pt-4 text-sm">{course.description}</p>
            <a href={courseHref(course.id)} className="mt-4 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
              Open course page <ArrowRight aria-hidden="true" className="size-4" />
            </a>
          </Panel>

          <Panel title="Grading queue">
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
        </div>
      </div>
    </>
  )
}
