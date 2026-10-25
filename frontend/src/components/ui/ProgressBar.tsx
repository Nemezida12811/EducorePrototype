interface ProgressBarProps {
  value: number
  max: number
  label: string
}

/** Wine fill on a rose track keeps >= 3:1 non-text contrast; the numbers are always shown beside it. */
export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2.5 w-full min-w-16 overflow-hidden rounded-full bg-rose"
    >
      <div className="h-full rounded-full bg-wine" style={{ width: `${pct}%` }} />
    </div>
  )
}
