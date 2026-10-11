import { useId } from 'react'

export const fieldClass = 'min-h-11 w-full rounded-md border-2 border-wine bg-fog px-3 text-wine disabled:opacity-60'

interface BaseProps {
  label: string
  hint?: string
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  min,
  max,
  disabled,
  required,
}: BaseProps & {
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number' | 'email' | 'time' | 'date'
  min?: number
  max?: number
  disabled?: boolean
  required?: boolean
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-medium">{label}</label>
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      />
      {hint && <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}

export function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
  disabled,
}: BaseProps & {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-medium">{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}

export function TextAreaField({
  label,
  hint,
  value,
  onChange,
  rows = 4,
}: BaseProps & { value: string; onChange: (v: string) => void; rows?: number }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-medium">{label}</label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldClass} py-2`}
      />
      {hint && <p id={`${id}-hint`} className="mt-1 text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}

export function CheckboxGroup({
  legend,
  options,
  selected,
  onChange,
}: {
  legend: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <fieldset>
      <legend className="mb-1 font-medium">{legend}</legend>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-9 items-center gap-2">
            <input
              type="checkbox"
              className="size-5 accent-wine"
              checked={selected.includes(o.value)}
              onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
