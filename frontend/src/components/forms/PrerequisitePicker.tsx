import { useId } from 'react'
import { X } from 'lucide-react'
import { fieldClass } from '../ui/Field'

export interface PrerequisiteOption {
  id: string
  code: string
  name: string
  academicYear?: string
}

/** Prerequisites as a drop-down: pick a course to add it, remove it with the button on its chip. */
export function PrerequisitePicker({ options, selected, onChange }: { options: PrerequisiteOption[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const id = useId()
  const chosen = selected.map((s) => options.find((o) => o.id === s)).filter((o): o is PrerequisiteOption => !!o)
  const available = options.filter((o) => !selected.includes(o.id)).sort((a, b) => a.code.localeCompare(b.code))

  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-medium">Prerequisites</label>
      <select
        id={id}
        className={`${fieldClass} max-w-xl`}
        value=""
        onChange={(e) => e.target.value && onChange([...selected, e.target.value])}
        disabled={available.length === 0}
      >
        <option value="">{available.length === 0 ? 'No more courses to add' : 'Add a prerequisite…'}</option>
        {available.map((o) => (
          <option key={o.id} value={o.id}>{o.code} {o.name}{o.academicYear ? ` (${o.academicYear})` : ''}</option>
        ))}
      </select>
      <p className="mt-1 text-sm text-ink-soft">Students must have passed these courses before they can enroll.</p>
      {chosen.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Chosen prerequisites">
          {chosen.map((o) => (
            <li key={o.id} className="inline-flex items-center gap-2 rounded-full bg-blush py-1 pr-1 pl-3 text-wine">
              <span>{o.code} {o.name}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x !== o.id))}
                aria-label={`Remove prerequisite ${o.code}`}
                className="grid size-7 place-items-center rounded-full hover:bg-rose"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-ink-soft">No prerequisites.</p>
      )}
    </div>
  )
}
