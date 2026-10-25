import type { Role } from '../../data/types'
import { useDemo } from '../../state/DemoContext'

const OPTIONS: { value: Role; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Super admin' },
]

export function RoleToggle() {
  const { role, setRole } = useDemo()
  return (
    <>
      {/* Small screens: a native select saves space. */}
      <label className="sm:hidden">
        <span className="sr-only">Demo role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="min-h-10 rounded-md border-2 border-wine bg-rose px-2 text-sm font-semibold text-wine"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <div role="group" aria-label="Demo role" className="hidden rounded-md border-2 border-wine p-0.5 sm:flex">
        {OPTIONS.map((opt) => {
          const active = opt.value === role
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => setRole(opt.value)}
              className={`min-h-9 rounded px-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                active ? 'bg-wine text-blush' : 'text-wine hover:bg-blush'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
