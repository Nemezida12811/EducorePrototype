import { useId, type ReactNode } from 'react'

interface PanelProps {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Flush content (tables) removes inner padding. */
  flush?: boolean
}

/** Primary content surface. The offset mauve block is the portal's signature. */
export function Panel({ title, action, children, className = '', flush = false }: PanelProps) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className={`layer-panel mr-2 mb-2 rounded-md bg-blush text-wine ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3 sm:px-6">
        <h2 id={headingId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      <div className={flush ? 'pb-2' : 'px-5 pb-5 sm:px-6 sm:pb-6'}>{children}</div>
    </section>
  )
}
