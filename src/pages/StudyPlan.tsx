import { BookCheck, Hourglass, ListChecks } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { CourseLink } from '../components/ui/CourseLink'
import { DataTable, type Column } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { STUDENT_PROGRAM_ID, studyPlan } from '../data/demo'
import { useOrgUnits, usePrograms } from '../data/stores'
import { getCourse } from '../data/selectors'
import type { StudyPlanItem, Term } from '../data/types'
import { gradeFor, summaryFor } from '../lib/grades'
import { useDemo } from '../state/DemoContext'

export function StudyPlanPage() {
  const { enrolledIds, waitlistIds } = useDemo()
  const orgUnits = useOrgUnits()
  const studyPrograms = usePrograms()
  const program = studyPrograms.find((p) => p.id === STUDENT_PROGRAM_ID)!
  const unit = orgUnits.find((u) => u.id === program.orgUnitId)

  const statusOf = (item: StudyPlanItem) => {
    const c = getCourse(item.courseId)
    const s = summaryFor(c, gradeFor(c.id))
    if (s.complete) return { label: `Completed, ${s.mark}`, kind: 'done' as const }
    if (enrolledIds.has(c.id)) return { label: 'In progress', kind: 'active' as const }
    if (waitlistIds.has(c.id)) return { label: 'Waitlisted', kind: 'active' as const }
    return { label: 'Not enrolled', kind: 'open' as const }
  }

  const credits = (kind: 'done' | 'active' | 'open' | 'all') =>
    studyPlan
      .filter((i) => kind === 'all' || statusOf(i).kind === kind)
      .reduce((sum, i) => sum + getCourse(i.courseId).credits, 0)

  const columns: Column<StudyPlanItem>[] = [
    {
      header: 'Course',
      rowHeader: true,
      cell: (i) => (
        <>
          <CourseLink courseId={i.courseId} />
          <span className="block text-sm font-normal text-ink-soft">{getCourse(i.courseId).code}</span>
        </>
      ),
    },
    { header: 'Type', cell: (i) => (i.mandatory ? 'Mandatory' : 'Elective') },
    { header: 'Credits', cell: (i) => getCourse(i.courseId).credits },
    {
      header: 'Status',
      align: 'right',
      cell: (i) => {
        const s = statusOf(i)
        return <Badge tone={s.kind === 'done' ? 'solid' : s.kind === 'active' ? 'soft' : 'outline'}>{s.label}</Badge>
      },
    },
  ]

  const groups: { year: number; term: Term }[] = []
  for (const i of studyPlan) {
    if (!groups.some((g) => g.year === i.yearOfStudy && g.term === i.term)) groups.push({ year: i.yearOfStudy, term: i.term })
  }

  return (
    <>
      <PageHeader
        title="Study plan"
        description={`${program.name}, ${program.degreeLevel.toLowerCase()} program of ${program.durationYears} years at ${unit?.code}. Years 2 and 3 are shown.`}
      />
      <StatGrid>
        <StatCard label="Planned credits" value={String(credits('all'))} hint="In years 2 and 3" icon={ListChecks} />
        <StatCard label="Completed" value={String(credits('done'))} hint="Credits with a final mark" icon={BookCheck} />
        <StatCard label="In progress" value={String(credits('active'))} hint="Enrolled this semester" icon={Hourglass} />
        <StatCard label="Not enrolled" value={String(credits('open'))} hint="Electives still open" icon={ListChecks} />
      </StatGrid>
      <div className="flex flex-col gap-10">
        {groups.map((g) => (
          <Panel key={`${g.year}-${g.term}`} title={`Year ${g.year}, ${g.term.toLowerCase()} semester`} flush>
            <DataTable
              caption={`Study plan, year ${g.year}, ${g.term.toLowerCase()} semester`}
              columns={columns}
              rows={studyPlan.filter((i) => i.yearOfStudy === g.year && i.term === g.term)}
              getKey={(i) => i.courseId}
            />
          </Panel>
        ))}
      </div>
    </>
  )
}
