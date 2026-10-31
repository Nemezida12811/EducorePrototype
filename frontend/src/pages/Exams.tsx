import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ExamForm } from '../components/forms/ExamForm'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CourseLink } from '../components/ui/CourseLink'
import { DataTable, type Column } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { cancelExamRegistration, deleteExam, errorMessage, registerForExam } from '../data/actions'
import { findCourse } from '../data/selectors'
import type { Exam } from '../data/types'
import { formatWeekdayDate } from '../lib/format'
import { useApp } from '../state/AppContext'
import { useMine } from '../state/useMine'

const courseCell = (e: Exam) => (
  <>
    <CourseLink courseId={e.courseId} />
    <span className="block text-sm font-normal text-ink-soft">{findCourse(e.courseId)?.code}</span>
  </>
)

export function ExamsPage() {
  const { role } = useApp()
  const [message, setMessage] = useState('')
  const { exams, courses } = useMine()
  const [adding, setAdding] = useState(false)
  const student = role === 'student'
  const nameOf = (e: Exam) => findCourse(e.courseId)?.name ?? 'the course'

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action()
      setMessage(ok)
    } catch (e) {
      setMessage(errorMessage(e))
    }
  }

  const onToggle = (exam: Exam) =>
    exam.registeredByMe
      ? run(() => cancelExamRegistration(exam.id), `Registration cancelled for ${nameOf(exam)}.`)
      : run(() => registerForExam(exam.id), `Registered for ${nameOf(exam)}.`)

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
            Term {e.term}, room {e.room}
          </span>
        </>
      ),
    },
  ]

  const studentColumns: Column<Exam>[] = [
    ...common,
    { header: 'Seats taken', cell: (e) => `${e.registered} of ${e.capacity}` },
    {
      header: 'Registration',
      align: 'right',
      cell: (e) => {
        if (e.registration === 'closed' && !e.registeredByMe) return <Badge tone="outline">Closed</Badge>
        return (
          <Button
            variant={e.registeredByMe ? 'secondary' : 'primary'}
            onClick={() => void onToggle(e)}
            aria-label={`${e.registeredByMe ? 'Cancel registration for' : 'Register for'} ${nameOf(e)}, term ${e.term}`}
          >
            {e.registeredByMe ? 'Cancel' : 'Register'}
          </Button>
        )
      },
    },
    {
      header: 'Status',
      align: 'right',
      cell: (e) => (e.registeredByMe ? <Badge tone="solid">Registered</Badge> : <Badge tone="soft">Not registered</Badge>),
    },
  ]

  const staffColumns: Column<Exam>[] = [
    ...common,
    {
      header: 'Registered',
      cell: (e) => (
        <div className="flex items-center gap-3">
          <div className="w-20">
            <ProgressBar value={e.registered} max={e.capacity} label={`${nameOf(e)} registrations`} />
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
    {
      header: 'Actions',
      align: 'right',
      cell: (e) => (
        <Button
          variant="secondary"
          className="min-h-9 px-2"
          onClick={() => void run(() => deleteExam(e.id), 'Exam term removed.')}
          aria-label={`Remove ${nameOf(e)}, term ${e.term}, ${formatWeekdayDate(e.date)}`}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Exams"
        description={
          student
            ? 'Register for exam terms of your courses. You can cancel while registration is open.'
            : role === 'instructor'
              ? 'Exam terms for your courses and how many students have registered.'
              : 'All exam terms of the institution and how many students have registered.'
        }
      />
      {!student && adding && (
        <div className="mb-10">
          <Panel title="New exam term">
            <ExamForm courses={courses} onDone={() => setAdding(false)} />
          </Panel>
        </div>
      )}
      <Panel
        title="Exam terms"
        flush
        action={
          !student && !adding ? (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              New exam term
            </Button>
          ) : undefined
        }
      >
        <DataTable caption="Exam terms" columns={student ? studentColumns : staffColumns} rows={exams} getKey={(e) => e.id} />
      </Panel>
      <p className="mt-4 text-rose empty:hidden" role="status" aria-live="polite">
        {message}
      </p>
    </>
  )
}
