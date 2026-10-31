import { LogOut, Menu } from 'lucide-react'
import { currentTerm } from '../../lib/clock'
import { hrefFor } from '../../lib/router'
import { useApp } from '../../state/AppContext'
import { Button } from '../ui/Button'

const ROLE_LABEL = { student: 'Student', instructor: 'Instructor', admin: 'Administrator', superadmin: 'Super administrator' } as const

export function TopBar({ onOpenNav, navOpen }: { onOpenNav: () => void; navOpen: boolean }) {
  const { role, name, initials, user, signOut } = useApp()
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

      <p className="hidden font-medium sm:block">{currentTerm().label}</p>

      <div className="ml-auto flex items-center gap-4">
        <a href={hrefFor('profile')} aria-label={`Profile of ${name}`} className="flex items-center gap-3 rounded-md">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-full bg-wine font-display text-sm font-semibold text-blush"
          >
            {initials}
          </span>
          <div className="hidden leading-tight md:block">
            <p className="font-semibold">{name}</p>
            <p className="text-sm">{ROLE_LABEL[role]}, {user.email}</p>
          </div>
        </a>
        <Button variant="secondary" onClick={() => void signOut()} aria-label="Sign out">
          <LogOut aria-hidden="true" className="mr-2 size-4" />
          Sign out
        </Button>
      </div>
    </header>
  )
}
