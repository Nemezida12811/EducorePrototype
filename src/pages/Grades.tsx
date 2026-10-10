import { Award, BookCheck, GraduationCap, Percent } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { DataTable, type Column } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { assessments, degree, finalMarks } from '../data/demo'
import { getCourse } from '../data/selectors'
import type { Assessment, FinalMark } from '../data/types'
import { formatDate, percent, weightedAverage } from '../lib/format'

const SCALE = [
  { mark: 'A', range: '93 to 100%', name: 'Excellent' },
  { mark: 'B', range: '85 to 92%', name: 'Very good' },
  { mark: 'C', range: '77 to 84%', name: 'Good' },
  { mark: 'D', range: '69 to 76%', name: 'Satisfactory' },
  { mark: 'E', range: '61 to 68%', name: 'Sufficient' },
  { mark: 'FX', range: 'Below 61%', name: 'Fail' },
]

const finalColumns: Column<FinalMark>[] = [
  {
    header: 'Course',
    rowHeader: true,
    cell: (m) => {
      const c = getCourse(m.courseId)
      return (
        <>
          {c.name}
          <span className="block text-sm font-normal text-ink-soft">{c.code}</span>
        </>
      )
    },
  },
  { header: 'Year', cell: (m) => getCourse(m.courseId).academicYear },
  { header: 'Credits', cell: (m) => getCourse(m.courseId).credits },
  { header: 'Date', cell: (m) => formatDate(m.date) },
  { header: 'Mark', align: 'right', cell: (m) => <Badge tone={m.mark === 'FX' ? 'outline' : 'solid'}>{m.mark}</Badge> },
]

const assessmentColumns: Column<Assessment>[] = [
  {
    header: 'Assessment',
    rowHeader: true,
    cell: (a) => (
      <>
        {a.title}
        <span className="block text-sm font-normal text-ink-soft">{getCourse(a.courseId).name}</span>
      </>
    ),
  },
  { header: 'Date', cell: (a) => formatDate(a.date) },
  { header: 'Points', cell: (a) => <span className="whitespace-nowrap">{a.points} / {a.maxPoints}</span> },
  {
    header: 'Score',
    align: 'right',
    cell: (a) => (
      <div className="ml-auto flex items-center gap-3">
        <div className="w-24">
          <ProgressBar value={a.points} max={a.maxPoints} label={`${a.title} score`} />
        </div>
        <span className="w-10 text-right font-semibold">{percent(a.points, a.maxPoints)}%</span>
      </div>
    ),
  },
]

export function GradesPage() {
  const withCredits = finalMarks.map((m) => ({ mark: m.mark, credits: getCourse(m.courseId).credits }))
  const average = weightedAverage(withCredits)
  const earned =
    degree.creditsBeforeArchive + withCredits.filter((m) => m.mark !== 'FX').reduce((s, m) => s + m.credits, 0)
  const points = assessments.reduce((s, a) => s + a.points, 0)
  const max = assessments.reduce((s, a) => s + a.maxPoints, 0)

  return (
    <>
      <PageHeader title="Grades" description="Final marks from completed courses and your results so far this semester." />
      <StatGrid>
        <StatCard label="Weighted average" value={average.toFixed(2)} hint="Weighted by credits, 1.00 is best" icon={Award} />
        <StatCard label="Credits earned" value={String(earned)} hint={`Of ${degree.requiredCredits} for the degree`} icon={GraduationCap} />
        <StatCard label="Completed courses" value={String(finalMarks.length)} hint="Final marks in the archive" icon={BookCheck} />
        <StatCard label="This semester" value={`${percent(points, max)}%`} hint="Of points available so far" icon={Percent} />
      </StatGrid>

      <div className="flex flex-col gap-10">
        <Panel title="This semester" flush>
          <DataTable
            caption="Assessment results for the current semester"
            columns={assessmentColumns}
            rows={[...assessments].sort((a, b) => b.date.localeCompare(a.date))}
            getKey={(a) => a.id}
          />
        </Panel>
        <Panel title="Final marks" flush>
          <DataTable
            caption="Final marks from completed courses"
            columns={finalColumns}
            rows={[...finalMarks].sort((a, b) => b.date.localeCompare(a.date))}
            getKey={(m) => m.courseId}
          />
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
                  <span className="block text-sm text-ink-soft">{s.range}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </>
  )
}
