import type { Role } from '../../data/types'
import { useDemo } from '../../state/DemoContext'

const OPTIONS: { value: Role; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'admin', label: 'Admin' },
]

export function RoleToggle() {
  const { role, setRole } = useDemo()
  return (
    <div role="group" aria-label="Demo role" className="flex rounded-md border-2 border-wine p-0.5">
      {OPTIONS.map((opt) => {
        const active = opt.value === role
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setRole(opt.value)}
            className={`min-h-9 rounded px-2.5 text-sm sm:px-3 font-semibold transition-colors ${
              active ? 'bg-wine text-blush' : 'text-wine hover:bg-blush'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
