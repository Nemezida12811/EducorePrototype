import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { loadAll } from '../data/load'
import { fullName, initialsOf, uiRole } from '../data/mappers'
import { resetStores, useEnrollments } from '../data/stores'
import type { EnrollmentItem, Role } from '../data/types'
import type { AuthUser } from '../lib/api'

interface AppState {
  user: AuthUser
  role: Role
  name: string
  initials: string
  enrolledIds: ReadonlySet<string>
  waitlistIds: ReadonlySet<string>
  enrollmentFor: (courseId: string) => EnrollmentItem | undefined
  signOut: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

type Status = 'loading' | 'ready' | 'error'

/** Loads the signed-in user's data once, then renders the app. Wrap it around everything that needs the stores. */
export function AppProvider({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth()
  const [status, setStatus] = useState<Status>('loading')
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const enrollments = useEnrollments()
  const userId = user?.id
  const role = user ? uiRole(user.role) : null

  useEffect(() => {
    if (!userId || !role) return
    let alive = true
    setStatus('loading')
    loadAll(role)
      .then(() => alive && setStatus('ready'))
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : 'The data could not be loaded.')
        setStatus('error')
      })
    return () => {
      alive = false
      // The next user must never see this user's data.
      resetStores()
    }
  }, [userId, role, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  const value = useMemo<AppState | null>(() => {
    if (!user || !role) return null
    const name = fullName(user.firstName, user.lastName) || user.email
    return {
      user,
      role,
      name,
      initials: initialsOf(name),
      enrolledIds: new Set(enrollments.filter((e) => e.status === 'enrolled').map((e) => e.courseId)),
      waitlistIds: new Set(enrollments.filter((e) => e.status === 'waitlisted').map((e) => e.courseId)),
      enrollmentFor: (courseId) => enrollments.find((e) => e.courseId === courseId),
      signOut,
    }
  }, [user, role, enrollments, signOut])

  if (!value) return null
  if (status !== 'ready') {
    return (
      <main className="grid min-h-dvh place-items-center px-4 text-center">
        {status === 'loading' ? (
          <p role="status" className="text-lg">Loading your data…</p>
        ) : (
          <div role="alert" className="flex max-w-md flex-col items-center gap-4">
            <p className="text-lg font-semibold">The data could not be loaded.</p>
            <p className="text-rose">{error}</p>
            <div className="flex gap-3">
              <Button className="bg-blush" variant="secondary" onClick={retry}>Try again</Button>
              <Button className="bg-blush" variant="secondary" onClick={() => void signOut()}>Sign out</Button>
            </div>
          </div>
        )}
      </main>
    )
  }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider> (after sign-in)')
  return ctx
}
