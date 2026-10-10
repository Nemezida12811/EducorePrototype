import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { initialRegisteredExamIds } from '../data/demo'
import type { Role } from '../data/types'

interface DemoState {
  role: Role
  setRole: (role: Role) => void
  registeredExamIds: ReadonlySet<string>
  toggleExamRegistration: (examId: string) => void
}

const DemoContext = createContext<DemoState | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('student')
  const [registered, setRegistered] = useState<ReadonlySet<string>>(() => new Set(initialRegisteredExamIds))

  const toggleExamRegistration = useCallback((examId: string) => {
    setRegistered((prev) => {
      const next = new Set(prev)
      if (next.has(examId)) next.delete(examId)
      else next.add(examId)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ role, setRole, registeredExamIds: registered, toggleExamRegistration }),
    [role, registered, toggleExamRegistration],
  )
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

export function useDemo(): DemoState {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo must be used inside <DemoProvider>')
  return ctx
}
