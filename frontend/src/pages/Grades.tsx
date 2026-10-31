import { useState } from 'react'
import { Award, BookCheck, Download, GraduationCap, Percent } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CourseLink } from '../components/ui/CourseLink'
import { DataTable, type Column } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { errorMessage } from '../data/actions'
import { useCourses, useGrades, usePlan } from '../data/stores'
import type { Course, Mark, StudentGrade } from '../data/types'
import { download } from '../lib/api'
import { formatDate, percent, weightedAverage } from '../lib/format'
import { SCALE, summaryOf } from '../lib/grades'

interface Row {
  grade: StudentGrade
  course: Course
  total: number
  graded: number
  mark: Mark | null
}

const courseCell = (r: Row) => (
  <>
    <CourseLink courseId={r.course.id} />
    <span className="block text-sm font-normal text-ink-soft">{r.course.code}</span>
  </>
)

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
          <ProgressBar value={r.total} max={r.graded} label={`${r.course.name} score`} />
        </div>
        <span className="w-10 text-right font-semibold">{percent(r.total, r.graded)}%</span>
      </div>
    ),
  },
  { header: 'Final mark', align: 'right', cell: () => <Badge tone="outline">Pending</Badge> },
]

const finishedColumns: Column<Row>[] = [
  { header: 'Course', rowHeader: true, cell: courseCell },
  { header: 'Year', cell: (r) => r.course.academicYear },
  { header: 'Credits', cell: (r) => r.course.credits },
  { header: 'Date', cell: (r) => formatDate(r.grade.updatedAt) },
  { header: 'Score', cell: (r) => `${r.total} / 100` },
  {
    header: 'Mark',
    align: 'right',
    cell: (r) => (r.mark ? <Badge tone={r.mark === 'FX' ? 'outline' : 'solid'}>{r.mark}</Badge> : null),
  },
]

export function GradesPage() {
  const courses = useCourses()
  const grades = useGrades()
  const plan = usePlan()
  const [message, setMessage] = useState('')

  const rows: Row[] = grades.flatMap((grade) => {
    const course = courses.find((c) => c.id === grade.courseId)
    if (!course) return []
    const s = summaryOf(course.gradingScheme, grade)
    return [{ grade, course, total: s.total, graded: s.graded, mark: s.mark }]
  })
  const finished = rows.filter((r) => r.mark !== null).sort((a, b) => b.grade.updatedAt.localeCompare(a.grade.updatedAt))
  const current = rows.filter((r) => r.mark === null)

  const withCredits = finished.map((r) => ({ mark: r.mark!, credits: r.course.credits }))
  const average = weightedAverage(withCredits)
  const earned = withCredits.filter((m) => m.mark !== 'FX').reduce((s, m) => s + m.credits, 0)
  const points = current.reduce((s, r) => s + r.total, 0)
  const max = current.reduce((s, r) => s + r.graded, 0)

  const fetchPdf = async (path: string, init: RequestInit, name: string) => {
    setMessage('')
    try {
      await download(path, init, name)
    } catch (e) {
      setMessage(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Grades"
        description="Final marks from completed courses and your results so far this semester. Open a course for the full breakdown."
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" className="bg-blush" onClick={() => void fetchPdf('/grades/me/transcript', {}, 'transcript.pdf')}>
              <Download aria-hidden="true" className="mr-2 size-4" />
              Transcript (PDF)
            </Button>
            <Button variant="secondary" className="bg-blush" onClick={() => void fetchPdf('/documents/transcript-request', { method: 'POST' }, 'certificate-of-study.pdf')}>
              <Download aria-hidden="true" className="mr-2 size-4" />
              Certificate of study (PDF)
            </Button>
          </div>
        }
      />
      <p role="alert" className="mb-6 font-semibold empty:hidden">{message}</p>
      <StatGrid>
        <StatCard label="Weighted average" value={finished.length ? average.toFixed(2) : '-'} hint="Weighted by credits, 1.00 is best" icon={Award} />
        <StatCard
          label="Credits earned"
          value={String(earned)}
          hint={plan?.creditsRequired ? `Of ${plan.creditsRequired} for the degree` : 'From courses passed'}
          icon={GraduationCap}
        />
        <StatCard label="Completed courses" value={String(finished.length)} hint="With a final mark" icon={BookCheck} />
        <StatCard label="This semester" value={max === 0 ? '-' : `${percent(points, max)}%`} hint="Of points available so far" icon={Percent} />
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
