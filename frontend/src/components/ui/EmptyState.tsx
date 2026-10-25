export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border-2 border-dashed border-rose px-5 py-8 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-sm text-ink-soft">{children}</p>}
    </div>
  )
}
