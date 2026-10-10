import { useId, useState } from 'react'
import { ArrowRight, Gauge, GraduationCap, Layers, Users } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { DataTable, type Column } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { gradingQueue, roster, rosterGrades } from '../data/demo'
import { getCourse, teacherNames } from '../data/selectors'
import type { RosterStudent } from '../data/types'
import { formatDate, percent } from '../lib/format'
import { padRow, summarize } from '../lib/grades'
import { courseHref } from '../lib/router'
import { useMine } from '../state/useMine'

type Row = RosterStudent & { total: number; graded: number }

export function InstructorPanelPage() {
  const taught = useMine().courses
  const [courseId, setCourseId] = useState(taught[0].id)
  const selectId = useId()
  const course = getCourse(courseId)

  const rowsFor = (id: string): Row[] => {
    const c = getCourse(id)
    return roster.map((s, i) => {
      const sum = summarize(c.gradingScheme, padRow(rosterGrades[id][i], c.gradingScheme.length))
      return { ...s, total: sum.total, graded: sum.graded }
    })
  }

  const rows = rowsFor(courseId)
  const students = taught.reduce((sum, c) => sum + c.enrolled, 0)
  const submissions = gradingQueue.reduce((sum, g) => sum + g.submissions, 0)
  const all = taught.flatMap((c) => rowsFor(c.id).map((r) => percent(r.total, r.graded)))
  const classAverage = Math.round(all.reduce((a, b) => a + b, 0) / all.length)

  const columns: Column<Row>[] = [
    {
      header: 'Student',
      rowHeader: true,
      cell: (s) => (
        <>
          {s.name}
          <span className="block text-sm font-normal text-ink-soft">{s.id}</span>
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
      cell: (s) => (s.total / s.graded >= 0.5 ? <Badge tone="soft">On track</Badge> : <Badge tone="solid">Needs attention</Badge>),
    },
  ]

  return (
    <>
      <PageHeader title="Instructor panel" description="Roster, course details and grading work for the courses you teach." />
      <StatGrid>
        <StatCard label="Courses taught" value={String(taught.length)} hint="Active this semester" icon={Layers} />
        <StatCard label="Students" value={String(students)} hint="Enrolled across your courses" icon={Users} />
        <StatCard label="Awaiting grading" value={String(submissions)} hint={`Submissions in ${gradingQueue.length} tasks`} icon={GraduationCap} />
        <StatCard label="Class average" value={`${classAverage}%`} hint="Of points available so far" icon={Gauge} />
      </StatGrid>

      <div className="mb-8">
        <label htmlFor={selectId} className="mb-2 block font-medium">
          Course
        </label>
        <select
          id={selectId}
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
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
            <ul className="divide-y divide-rose">
              {[...gradingQueue]
                .sort((a, b) => a.due.localeCompare(b.due))
                .map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="font-semibold">{g.title}</p>
                      <p className="text-sm text-ink-soft">
                        {getCourse(g.courseId).code}, due {formatDate(g.due)}
                      </p>
                    </div>
                    <Badge tone="soft">{g.submissions} to grade</Badge>
                  </li>
                ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}
