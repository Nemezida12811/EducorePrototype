import { useId } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { fieldClass } from '../ui/Field'
import { ProgressBar } from '../ui/ProgressBar'
import type { GradingComponent } from '../../data/types'
import { scoreToMark } from '../../lib/grades'

/** One line of the builder: "Labs, 5 works, 4 points each, at least 2 points on each". It expands into `count` scheme components. */
export interface SchemeRow {
  id: string
  name: string
  count: string
  max: string
  min: string
}

export const TEMPLATES: Record<string, { label: string; rows: Omit<SchemeRow, 'id'>[] }> = {
  standard: {
    label: 'Assignments, test, exam',
    rows: [{ name: 'Assignments', count: '1', max: '20', min: '8' }, { name: 'Test', count: '1', max: '20', min: '0' }, { name: 'Exam', count: '1', max: '60', min: '25' }],
  },
  labs: {
    label: 'Five labs, midterm, exam',
    rows: [{ name: 'Lab', count: '5', max: '4', min: '2' }, { name: 'Midterm test', count: '1', max: '20', min: '8' }, { name: 'Exam', count: '1', max: '60', min: '25' }],
  },
  project: {
    label: 'Project and exam',
    rows: [{ name: 'Project', count: '1', max: '40', min: '16' }, { name: 'Exam', count: '1', max: '60', min: '25' }],
  },
  continuous: {
    label: 'Continuous assessment (no exam)',
    rows: [{ name: 'Assignments', count: '1', max: '40', min: '15' }, { name: 'Midterm test', count: '1', max: '30', min: '10' }, { name: 'Final test', count: '1', max: '30', min: '10' }],
  },
}

const SUGGESTIONS = ['Assignment', 'Lab', 'Project', 'Midterm test', 'Final test', 'Test', 'Presentation', 'Essay', 'Attendance', 'Exam']
const MAX_COMPONENTS = 30
let counter = 0
export const newRowId = () => `row-${(counter += 1)}`
export const rowsFromTemplate = (key: string): SchemeRow[] => TEMPLATES[key]!.rows.map((r) => ({ ...r, id: newRowId() }))

/** Rebuilds builder rows from a stored scheme: consecutive "Lab 1", "Lab 2" ... with equal points become one row of several works. */
export function rowsFromScheme(scheme: GradingComponent[]): SchemeRow[] {
  const rows: SchemeRow[] = []
  for (let i = 0; i < scheme.length; ) {
    const c = scheme[i]!
    const m = /^(.+) 1$/.exec(c.name)
    let n = 1
    if (m) {
      while (scheme[i + n] && scheme[i + n]!.name === `${m[1]} ${n + 1}` && scheme[i + n]!.max === c.max && scheme[i + n]!.min === c.min) n += 1
    }
    if (m && n >= 2) {
      rows.push({ id: newRowId(), name: m[1]!, count: String(n), max: String(c.max), min: String(c.min) })
      i += n
    } else {
      rows.push({ id: newRowId(), name: c.name, count: '1', max: String(c.max), min: String(c.min) })
      i += 1
    }
  }
  return rows
}

export interface BuiltScheme {
  scheme: GradingComponent[]
  total: number
  /** The first thing that stops the scheme from being saved (empty when it is valid). */
  error: string
}

export function buildScheme(rows: SchemeRow[]): BuiltScheme {
  const scheme: GradingComponent[] = []
  let total = 0
  let error = ''
  const fail = (msg: string) => {
    if (!error) error = msg
  }
  rows.forEach((r, i) => {
    const label = r.name.trim() || `Component ${i + 1}`
    const count = Number(r.count)
    const max = Number(r.max)
    const min = Number(r.min)
    if (!r.name.trim()) fail(`Component ${i + 1}: enter a name.`)
    if (!Number.isInteger(count) || count < 1 || count > 20) return fail(`${label}: the number of works must be a whole number from 1 to 20.`)
    if (!Number.isInteger(max) || max < 1) return fail(`${label}: points per work must be a whole number of at least 1.`)
    if (!Number.isInteger(min) || min < 0 || min > max) return fail(`${label}: the minimum must be a whole number from 0 to ${max}.`)
    total += count * max
    for (let k = 1; k <= count; k += 1) scheme.push({ name: count === 1 ? r.name.trim() : `${r.name.trim()} ${k}`, max, min })
  })
  if (rows.length === 0) fail('Add at least one component.')
  if (scheme.length > MAX_COMPONENTS) fail(`A course can have at most ${MAX_COMPONENTS} graded works in total.`)
  const names = scheme.map((c) => c.name.toLowerCase())
  const dup = names.find((n, i) => names.indexOf(n) !== i)
  if (dup) fail(`Two works are called "${dup}". Give the components different names.`)
  if (!error && total !== 100) fail(total < 100 ? `The points add up to ${total}. Add ${100 - total} more to reach 100.` : `The points add up to ${total}. Remove ${total - 100} to reach 100.`)
  return { scheme, total, error }
}

const small = `${fieldClass} min-h-10 px-2`

interface Props {
  rows: SchemeRow[]
  onChange: (rows: SchemeRow[]) => void
  built: BuiltScheme
  /** Editing a course: the API refuses scheme changes once grades have been entered. */
  editing?: boolean
}

export function GradingBuilder({ rows, onChange, built, editing }: Props) {
  const listId = useId()
  const set = (id: string, patch: Partial<SchemeRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const minimums = rows.filter((r) => Number(r.min) > 0)
  const remaining = 100 - built.total

  return (
    <fieldset className="rounded-md border-2 border-rose p-4">
      <legend className="px-1 font-semibold">Grading scheme</legend>
      <p className="mb-4 text-ink-soft">
        Choose what the final score of 100 points is made of. A component can be several works, for example five labs of 4 points each.
        {editing && ' The scheme cannot be changed once the first grade has been entered.'}
      </p>

      <div className="mb-4 max-w-sm">
        <label htmlFor={`${listId}-tpl`} className="mb-1 block font-medium">Start from a template</label>
        <select
          id={`${listId}-tpl`}
          className={fieldClass}
          value=""
          onChange={(e) => e.target.value && onChange(rowsFromTemplate(e.target.value))}
        >
          <option value="">Choose a template…</option>
          {Object.entries(TEMPLATES).map(([key, t]) => (
            <option key={key} value={key}>{t.label}</option>
          ))}
        </select>
      </div>

      <datalist id={listId}>
        {SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const count = Number(r.count)
          const max = Number(r.max)
          const subtotal = Number.isFinite(count * max) ? count * max : 0
          return (
            <li key={r.id} className="grid items-end gap-3 rounded-md bg-fog p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <div>
                <label htmlFor={`${r.id}-n`} className="mb-1 block text-sm font-medium">Component {i + 1}</label>
                <input id={`${r.id}-n`} list={listId} className={small} value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} placeholder="For example Lab" />
              </div>
              <div>
                <label htmlFor={`${r.id}-c`} className="mb-1 block text-sm font-medium">Works</label>
                <input id={`${r.id}-c`} type="number" min={1} max={20} className={small} value={r.count} onChange={(e) => set(r.id, { count: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${r.id}-m`} className="mb-1 block text-sm font-medium">Points each</label>
                <input id={`${r.id}-m`} type="number" min={1} max={100} className={small} value={r.max} onChange={(e) => set(r.id, { max: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${r.id}-l`} className="mb-1 block text-sm font-medium">Minimum to pass</label>
                <input id={`${r.id}-l`} type="number" min={0} max={100} className={small} value={r.min} onChange={(e) => set(r.id, { min: e.target.value })} />
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <span className="text-sm whitespace-nowrap" aria-label={`Component ${i + 1} is worth ${subtotal} points`}>{subtotal} pts</span>
                <Button variant="secondary" className="min-h-10 px-2" onClick={() => onChange(rows.filter((x) => x.id !== r.id))} aria-label={`Remove component ${i + 1}`}>
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => onChange([...rows, { id: newRowId(), name: '', count: '1', max: String(Math.max(1, remaining)), min: '0' }])}>
          <Plus aria-hidden="true" className="mr-2 size-4" />
          Add component
        </Button>
      </div>

      <div className="mt-5" role="status" aria-live="polite">
        <div className="mb-2 flex justify-between gap-3 font-semibold">
          <span>Total</span>
          <span>{built.total} of 100 points</span>
        </div>
        <ProgressBar value={Math.min(built.total, 100)} max={100} label="Points assigned" />
        <p className="mt-2 text-sm">{built.error || 'The scheme adds up to 100 points.'}</p>
      </div>

      <p className="mt-3 text-sm text-ink-soft">
        To pass, a student needs at least 61 points in total (mark {scoreToMark(61)} or better)
        {minimums.length > 0 ? `, and at least ${minimums.map((r) => `${r.min} on ${Number(r.count) > 1 ? 'each ' : ''}${r.name.trim() || 'a component'}`).join(', ')}` : ''}.
        Missing a minimum gives FX even when the total is higher.
      </p>
    </fieldset>
  )
}
