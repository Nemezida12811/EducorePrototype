import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  hint: string
  icon: LucideIcon
}

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md bg-rose p-5 text-wine">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{label}</p>
        <Icon aria-hidden="true" className="size-5 shrink-0" />
      </div>
      <p className="font-display text-4xl leading-none font-semibold tracking-tight">{value}</p>
      <p className="text-sm">{hint}</p>
    </div>
  )
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}
