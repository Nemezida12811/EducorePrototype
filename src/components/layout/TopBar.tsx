import { Menu } from 'lucide-react'
import { semesterLabel, users } from '../../data/demo'
import { useDemo } from '../../state/DemoContext'
import { RoleToggle } from './RoleToggle'

export function TopBar({ onOpenNav, navOpen }: { onOpenNav: () => void; navOpen: boolean }) {
  const { role } = useDemo()
  const user = users[role]
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 bg-rose px-4 text-wine sm:px-8 lg:px-10">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        aria-expanded={navOpen}
        aria-controls="sidebar"
        className="grid size-10 place-items-center rounded-md hover:bg-blush lg:hidden"
      >
        <Menu aria-hidden="true" className="size-6" />
      </button>

      <p className="hidden font-medium sm:block">{semesterLabel}</p>

      <div className="ml-auto flex items-center gap-4">
        <RoleToggle />
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-full bg-wine font-display text-sm font-semibold text-blush"
          >
            {user.initials}
          </span>
          <div className="hidden leading-tight md:block">
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm">{user.detail}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
