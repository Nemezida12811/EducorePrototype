interface FilterTabsProps<T extends string> {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** Segmented filter built from toggle buttons (aria-pressed). */
export function FilterTabs<T extends string>({ label, options, value, onChange }: FilterTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-md bg-wine-deep p-1">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-10 rounded px-4 text-sm font-semibold transition-colors ${
              active ? 'bg-blush text-wine' : 'text-blush hover:bg-wine-soft'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
