import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { SelectField, TextField } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { createEvent, deleteEvent, errorMessage } from '../data/actions'
import { useEvents } from '../data/stores'
import type { CalendarEvent } from '../data/types'
import { statusOf } from '../lib/calendar'
import { formatDate, formatDateTime } from '../lib/format'
import { useApp } from '../state/AppContext'

const KINDS = ['deadline', 'semester', 'exam period', 'holiday', 'other']
const when = (iso: string) => (iso.includes('T00:00:00') ? formatDate(iso) : formatDateTime(iso))

export function CalendarPage() {
  const { role } = useApp()
  const events = [...useEvents()].sort((a, b) => a.start.localeCompare(b.start))
  const canEdit = role === 'admin' || role === 'superadmin'
  const [error, setError] = useState('')

  const columns: Column<CalendarEvent>[] = [
    { header: 'Event', rowHeader: true, cell: (e) => <>{e.title}<span className="block text-sm font-normal text-ink-soft">{e.kind}</span></> },
    { header: 'Dates', cell: (e) => (e.end ? `${when(e.start)} to ${when(e.end)}` : when(e.start)) },
    {
      header: 'Status',
      align: canEdit ? undefined : 'right',
      cell: (e) => {
        const s = statusOf(e)
        return <Badge tone={s === 'In progress' ? 'solid' : s === 'Upcoming' ? 'soft' : 'outline'}>{s}</Badge>
      },
    },
    ...(canEdit
      ? [{
          header: 'Actions',
          align: 'right' as const,
          cell: (e: CalendarEvent) => (
            <Button
              variant="secondary"
              className="min-h-9 px-2"
              aria-label={`Remove ${e.title}`}
              onClick={() => deleteEvent(e.id).catch((err) => setError(errorMessage(err)))}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          ),
        }]
      : []),
  ]

  return (
    <>
      <PageHeader title="Academic calendar" description="Deadlines, semesters, exam periods and holidays published by the study office." />
      <div className="flex flex-col gap-10">
        {canEdit && <EventForm />}
        <Panel title="Key dates" flush>
          <DataTable caption="Academic calendar" columns={columns} rows={events} getKey={(e) => e.id} />
        </Panel>
        <p role="alert" className="font-semibold empty:hidden">{error}</p>
      </div>
    </>
  )
}

function EventForm() {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState(KINDS[0]!)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !start) return setError('Title and start date are required.')
    if (end && end < start) return setError('The end date cannot be before the start date.')
    try {
      await createEvent({ title: title.trim(), kind, startsAt: new Date(`${start}T00:00:00`).toISOString(), endsAt: end ? new Date(`${end}T23:59:00`).toISOString() : undefined })
      setTitle(''); setStart(''); setEnd(''); setError('')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Panel title="Add a date">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <TextField label="Title" value={title} onChange={setTitle} required />
        <SelectField label="Type" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: k }))} />
        <TextField label="Starts" type="date" value={start} onChange={setStart} required />
        <TextField label="Ends (optional)" type="date" value={end} onChange={setEnd} />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit">Add</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}
