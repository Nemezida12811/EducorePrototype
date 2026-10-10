import type { ReactNode } from 'react'

type Tone = 'solid' | 'soft' | 'outline'

const TONES: Record<Tone, string> = {
  solid: 'bg-wine text-blush',
  soft: 'bg-rose text-wine',
  outline: 'border border-wine text-wine',
}

export function Badge({ tone = 'soft', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-sm font-medium whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  )
}
