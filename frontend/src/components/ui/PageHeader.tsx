import type { ReactNode } from 'react'

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-rose">{description}</p>
      </div>
      {action}
    </header>
  )
}
