import { X } from 'lucide-react'
import { university } from '../../data/demo'
import { hrefFor, type RouteId } from '../../lib/router'
import { NAV_ITEMS } from '../../nav'
import { useDemo } from '../../state/DemoContext'
import { useMine } from '../../state/useMine'

interface SidebarProps {
  route: RouteId
  open: boolean
  onClose: () => void
}

export function Sidebar({ route, open, onClose }: SidebarProps) {
  const { role } = useDemo()
  const { unread } = useMine()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-wine-deep/70 lg:hidden" aria-hidden="true" onClick={onClose} />}
      <aside
        id="sidebar"
        className={`flex flex-col bg-wine-deep text-blush max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:w-72 max-lg:transition-[transform,visibility] max-lg:duration-200 lg:sticky lg:top-0 lg:h-dvh ${
          open ? 'max-lg:translate-x-0 max-lg:visible' : 'max-lg:invisible max-lg:-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-8">
          <a href={hrefFor('dashboard')} className="flex items-center gap-3">
            <Logo />
            <span className="font-display text-2xl font-semibold tracking-tight">EduCore</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-10 place-items-center rounded-md hover:bg-wine-soft lg:hidden"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
          <ul className="flex flex-col gap-1">
            {items.map(({ id, label, icon: Icon }) => {
              const current = id === route
              return (
                <li key={id}>
                  <a
                    href={hrefFor(id)}
                    aria-current={current ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 font-medium transition-colors ${
                      current ? 'bg-blush text-wine' : 'hover:bg-wine-soft'
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0" />
                    {label}
                    {id === 'notices' && unread > 0 && (
                      <span className="ml-auto rounded-full bg-rose px-2 text-sm font-semibold text-wine">
                        {unread}
                        <span className="sr-only"> unread</span>
                      </span>
                    )}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="m-4 rounded-md bg-blush p-4 text-sm text-wine">
          <p className="font-semibold">{university.name}</p>
          <p className="mt-1">Demo build with static data. Nothing you do here is saved.</p>
        </div>
      </aside>
    </>
  )
}

/** Two offset squares: the layered-panel motif at logo size. */
function Logo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0">
      <rect x="9" y="9" width="20" height="20" rx="3" fill="#be8191" />
      <rect x="3" y="3" width="20" height="20" rx="3" fill="#f8dfd9" />
    </svg>
  )
}
