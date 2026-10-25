import { Award, BookCheck, GraduationCap, Percent } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { CourseLink } from '../components/ui/CourseLink'
import { DataTable, type Column } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { degree, studentGrades } from '../data/demo'
import { getCourse } from '../data/selectors'
import type { StudentGrade } from '../data/types'
import { formatDate, percent, weightedAverage } from '../lib/format'
import { SCALE, summaryFor } from '../lib/grades'

interface Row {
  grade: StudentGrade
  total: number
  graded: number
  mark: ReturnType<typeof summaryFor>['mark']
}

const rows: Row[] = studentGrades.map((grade) => {
  const s = summaryFor(getCourse(grade.courseId), grade)
  return { grade, total: s.total, graded: s.graded, mark: s.mark }
})

const finished = rows.filter((r) => r.mark !== null).sort((a, b) => (b.grade.finalizedAt ?? '').localeCompare(a.grade.finalizedAt ?? ''))
const current = rows.filter((r) => r.mark === null)

const courseCell = (r: Row) => {
  const c = getCourse(r.grade.courseId)
  return (
    <>
      <CourseLink courseId={c.id} />
      <span className="block text-sm font-normal text-ink-soft">{c.code}</span>
    </>
  )
}

const currentColumns: Column<Row>[] = [
  { header: 'Course', rowHeader: true, cell: courseCell },
  {
    header: 'Points so far',
    cell: (r) => (
      <span className="whitespace-nowrap">
        {r.total} / {r.graded}
      </span>
    ),
  },
  {
    header: 'Score',
    cell: (r) => (
      <div className="flex items-center gap-3">
        <div className="w-24">
          <ProgressBar value={r.total} max={r.graded} label={`${getCourse(r.grade.courseId).name} score`} />
        </div>
        <span className="w-10 text-right font-semibold">{percent(r.total, r.graded)}%</span>
      </div>
    ),
  },
  { header: 'Final mark', align: 'right', cell: () => <Badge tone="outline">Pending</Badge> },
]

const finishedColumns: Column<Row>[] = [
  { header: 'Course', rowHeader: true, cell: courseCell },
  { header: 'Year', cell: (r) => getCourse(r.grade.courseId).academicYear },
  { header: 'Credits', cell: (r) => getCourse(r.grade.courseId).credits },
  { header: 'Date', cell: (r) => (r.grade.finalizedAt ? formatDate(r.grade.finalizedAt) : '-') },
  { header: 'Score', cell: (r) => `${r.total} / 100` },
  {
    header: 'Mark',
    align: 'right',
    cell: (r) => (r.mark ? <Badge tone={r.mark === 'FX' ? 'outline' : 'solid'}>{r.mark}</Badge> : null),
  },
]

export function GradesPage() {
  const withCredits = finished.map((r) => ({ mark: r.mark!, credits: getCourse(r.grade.courseId).credits }))
  const average = weightedAverage(withCredits)
  const earned = degree.creditsBeforeArchive + withCredits.filter((m) => m.mark !== 'FX').reduce((s, m) => s + m.credits, 0)
  const points = current.reduce((s, r) => s + r.total, 0)
  const max = current.reduce((s, r) => s + r.graded, 0)

  return (
    <>
      <PageHeader title="Grades" description="Final marks from completed courses and your results so far this semester. Open a course for the full breakdown." />
      <StatGrid>
        <StatCard label="Weighted average" value={average.toFixed(2)} hint="Weighted by credits, 1.00 is best" icon={Award} />
        <StatCard label="Credits earned" value={String(earned)} hint={`Of ${degree.requiredCredits} for the degree`} icon={GraduationCap} />
        <StatCard label="Completed courses" value={String(finished.length)} hint="Final marks in the archive" icon={BookCheck} />
        <StatCard label="This semester" value={`${percent(points, max)}%`} hint="Of points available so far" icon={Percent} />
      </StatGrid>

      <div className="flex flex-col gap-10">
        <Panel title="This semester" flush>
          <DataTable caption="Results so far in current courses" columns={currentColumns} rows={current} getKey={(r) => r.grade.courseId} />
        </Panel>
        <Panel title="Final marks" flush>
          <DataTable caption="Final marks from completed courses" columns={finishedColumns} rows={finished} getKey={(r) => r.grade.courseId} />
        </Panel>
        <Panel title="Mark scale">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {SCALE.map((s) => (
              <div key={s.mark} className="flex items-center gap-3">
                <dt>
                  <Badge tone={s.mark === 'FX' ? 'outline' : 'solid'}>{s.mark}</Badge>
                </dt>
                <dd>
                  <span className="font-semibold">{s.name}</span>
                  <span className="block text-sm text-ink-soft">{s.range} points</span>
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  )
}
