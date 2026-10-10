import { useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { initialRegisteredExamIds } from '../data/demo'
import { getCourse } from '../data/selectors'
import { useMine } from '../state/useMine'
import { CourseLink } from '../components/ui/CourseLink'
import type { Exam } from '../data/types'
import { formatWeekdayDate } from '../lib/format'
import { useDemo } from '../state/DemoContext'

const courseCell = (e: Exam) => {
  const c = getCourse(e.courseId)
  return (
    <>
      <CourseLink courseId={c.id} />
      <span className="block text-sm font-normal text-ink-soft">{c.code}</span>
    </>
  )
}

export function ExamsPage() {
  const { role, registeredExamIds, toggleExamRegistration } = useDemo()
  const [message, setMessage] = useState('')
  const { exams } = useMine()
  const student = role === 'student'

  const onToggle = (exam: Exam) => {
    const name = getCourse(exam.courseId).name
    setMessage(registeredExamIds.has(exam.id) ? `Registration cancelled for ${name}.` : `Registered for ${name}.`)
    toggleExamRegistration(exam.id)
  }

  /** Static seat count, adjusted by the demo student's own change since load. */
  const seatsTaken = (exam: Exam) => {
    const now = registeredExamIds.has(exam.id)
    const before = initialRegisteredExamIds.includes(exam.id)
    return exam.registered + (now ? 1 : 0) - (before ? 1 : 0)
  }

  const common: Column<Exam>[] = [
    { header: 'Date', rowHeader: true, cell: (e) => formatWeekdayDate(e.date) },
    { header: 'Time', cell: (e) => e.start },
    { header: 'Course', cell: courseCell },
    {
      header: 'Format',
      cell: (e) => (
        <>
          {e.format}
          <span className="block text-sm whitespace-nowrap text-ink-soft">
            {e.term}, room {e.room}
          </span>
        </>
      ),
    },
  ]

  const studentColumns: Column<Exam>[] = [
    ...common,
    { header: 'Seats taken', cell: (e) => `${seatsTaken(e)} of ${e.capacity}` },
    {
      header: 'Registration',
      align: 'right',
      cell: (e) => {
        const registered = registeredExamIds.has(e.id)
        if (e.registration === 'closed' && !registered) return <Badge tone="outline">Closed</Badge>
        return (
          <Button
            variant={registered ? 'secondary' : 'primary'}
            onClick={() => onToggle(e)}
            aria-label={`${registered ? 'Cancel registration for' : 'Register for'} ${getCourse(e.courseId).name}, ${e.term}`}
          >
            {registered ? 'Cancel' : 'Register'}
          </Button>
        )
      },
    },
    {
      header: 'Status',
      align: 'right',
      cell: (e) =>
        registeredExamIds.has(e.id) ? <Badge tone="solid">Registered</Badge> : <Badge tone="soft">Not registered</Badge>,
    },
  ]

  const instructorColumns: Column<Exam>[] = [
    ...common,
    {
      header: 'Registered',
      cell: (e) => (
        <div className="flex items-center gap-3">
          <div className="w-20">
            <ProgressBar value={e.registered} max={e.capacity} label={`${getCourse(e.courseId).name} registrations`} />
          </div>
          <span className="whitespace-nowrap">
            {e.registered} of {e.capacity}
          </span>
        </div>
      ),
    },
    {
      header: 'Registration',
      align: 'right',
      cell: (e) => <Badge tone={e.registration === 'open' ? 'solid' : 'outline'}>{e.registration === 'open' ? 'Open' : 'Closed'}</Badge>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Exams"
        description={
          student
            ? 'Register for exam terms in the winter exam period. You can cancel while registration is open.'
            : role === 'instructor'
              ? 'Exam terms for your courses and how many students have registered.'
              : 'All exam terms of the institution and how many students have registered.'
        }
      />
      <Panel title="Winter exam period" flush>
        <DataTable
          caption="Exam terms"
          columns={student ? studentColumns : instructorColumns}
          rows={exams}
          getKey={(e) => e.id}
        />
      </Panel>
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
    </>
  )
}
