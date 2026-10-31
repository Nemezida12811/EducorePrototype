import { BookCheck, Hourglass, ListChecks } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { CourseLink } from '../components/ui/CourseLink'
import { DataTable, type Column } from '../components/ui/DataTable'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { useCourses, usePlan } from '../data/stores'
import type { StudyPlanItem } from '../data/types'
import { useApp } from '../state/AppContext'

type Kind = 'done' | 'active' | 'open'

/** Study plan semesters count from 1: odd ones are winter, even ones summer. */
const yearOf = (semesterNo: number) => Math.ceil(semesterNo / 2)
const termOf = (semesterNo: number) => (semesterNo % 2 === 1 ? 'winter' : 'summer')

export function StudyPlanPage() {
  const { waitlistIds } = useApp()
  const plan = usePlan()
  const courses = useCourses()

  if (!plan || !plan.programName) {
    return (
      <>
        <PageHeader title="Study plan" description="The courses your study program asks for, and how far along you are." />
        <EmptyState title="No study plan yet">You are not assigned to a study program. Ask the study office.</EmptyState>
      </>
    )
  }

  const credits = (c: string) => courses.find((x) => x.id === c)?.credits ?? 0
  const code = (c: string) => courses.find((x) => x.id === c)?.code ?? ''

  const statusOf = (item: StudyPlanItem): { label: string; kind: Kind } => {
    if (item.status === 'passed') return { label: `Completed, ${item.mark ?? 'passed'}`, kind: 'done' }
    if (item.status === 'failed') return { label: `Failed, ${item.mark ?? 'FX'}`, kind: 'open' }
    if (item.status === 'enrolled') return { label: 'In progress', kind: 'active' }
    if (waitlistIds.has(item.courseId)) return { label: 'Waitlisted', kind: 'active' }
    return { label: 'Not enrolled', kind: 'open' }
  }

  const total = (kind: Kind | 'all') =>
    plan.items.filter((i) => kind === 'all' || statusOf(i).kind === kind).reduce((sum, i) => sum + credits(i.courseId), 0)

  const columns: Column<StudyPlanItem>[] = [
    {
      header: 'Course',
      rowHeader: true,
      cell: (i) => (
        <>
          <CourseLink courseId={i.courseId} />
          <span className="block text-sm font-normal text-ink-soft">{code(i.courseId)}</span>
        </>
      ),
    },
    { header: 'Type', cell: (i) => (i.mandatory ? 'Mandatory' : 'Elective') },
    { header: 'Credits', cell: (i) => credits(i.courseId) },
    {
      header: 'Status',
      align: 'right',
      cell: (i) => {
        const s = statusOf(i)
        return <Badge tone={s.kind === 'done' ? 'solid' : s.kind === 'active' ? 'soft' : 'outline'}>{s.label}</Badge>
      },
    },
  ]

  const semesters = [...new Set(plan.items.map((i) => i.semesterNo))].sort((a, b) => a - b)

  return (
    <>
      <PageHeader
        title="Study plan"
        description={`${plan.programName}${plan.creditsRequired ? `, ${plan.creditsRequired} credits required` : ''}. ${plan.creditsEarned} credits earned so far.`}
      />
      <StatGrid>
        <StatCard label="Planned credits" value={String(total('all'))} hint="In your study plan" icon={ListChecks} />
        <StatCard label="Completed" value={String(total('done'))} hint="Credits with a passing mark" icon={BookCheck} />
        <StatCard label="In progress" value={String(total('active'))} hint="Enrolled or waitlisted" icon={Hourglass} />
        <StatCard label="Not enrolled" value={String(total('open'))} hint="Still open" icon={ListChecks} />
      </StatGrid>
      {semesters.length === 0 ? (
        <EmptyState title="The plan has no courses yet">The study office has not added courses to your program.</EmptyState>
      ) : (
        <div className="flex flex-col gap-10">
          {semesters.map((n) => (
            <Panel key={n} title={`Year ${yearOf(n)}, ${termOf(n)} semester`} flush>
              <DataTable
                caption={`Study plan, year ${yearOf(n)}, ${termOf(n)} semester`}
                columns={columns}
                rows={plan.items.filter((i) => i.semesterNo === n)}
                getKey={(i) => i.courseId}
              />
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}
