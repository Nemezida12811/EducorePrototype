import type { ReactNode } from 'react'

type Tone = 'solid' | 'soft' | 'outline' | 'onDark'

const TONES: Record<Tone, string> = {
  solid: 'bg-wine text-blush',
  soft: 'bg-rose text-wine',
  outline: 'border border-wine text-wine',
  /** For the wine page background, where the other tones disappear. */
  onDark: 'border border-blush text-blush',
}

export function Badge({ tone = 'soft', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-sm font-medium whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  )
}
