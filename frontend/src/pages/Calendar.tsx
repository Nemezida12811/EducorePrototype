import { Badge } from '../components/ui/Badge'
import { DataTable, type Column } from '../components/ui/DataTable'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { DEMO_TODAY, holidays, semesters } from '../data/demo'
import type { Holiday } from '../data/types'
import { keyDates, statusOf, type KeyDate } from '../lib/calendar'
import { formatDate, formatWeekdayDate } from '../lib/format'

const columns: Column<KeyDate>[] = [
  { header: 'Event', rowHeader: true, cell: (d) => d.label },
  { header: 'Dates', cell: (d) => (d.end ? `${formatDate(d.start)} to ${formatDate(d.end)}` : formatDate(d.start)) },
  {
    header: 'Status',
    align: 'right',
    cell: (d) => {
      const s = statusOf(d.start, d.end)
      return <Badge tone={s === 'In progress' ? 'solid' : s === 'Upcoming' ? 'soft' : 'outline'}>{s}</Badge>
    },
  },
]

const holidayColumns: Column<Holiday>[] = [
  { header: 'Holiday', rowHeader: true, cell: (h) => h.title },
  { header: 'Date', align: 'right', cell: (h) => formatWeekdayDate(h.date) },
]

export function CalendarPage() {
  const all = keyDates()
  return (
    <>
      <PageHeader
        title="Academic calendar"
        description={`Semesters, enrollment and exam periods. The demo treats ${formatDate(DEMO_TODAY)} as today.`}
      />
      <div className="flex flex-col gap-10">
        {semesters.map((s) => (
          <Panel key={s.id} title={`${s.term} semester ${s.academicYear}`} flush>
            <DataTable
              caption={`Key dates of the ${s.term.toLowerCase()} semester ${s.academicYear}`}
              columns={columns}
              rows={all.filter((d) => d.id.startsWith(s.id))}
              getKey={(d) => d.id}
            />
          </Panel>
        ))}
        <Panel title="Public holidays" flush>
          <DataTable caption="Public holidays during the academic year" columns={holidayColumns} rows={holidays} getKey={(h) => h.date} />
        </Panel>
      </div>
    </>
  )
}
