import { useSyncExternalStore } from 'react'

export type RouteId = 'dashboard' | 'courses' | 'grades' | 'schedule' | 'exams' | 'instructor'

const ROUTES: readonly RouteId[] = ['dashboard', 'courses', 'grades', 'schedule', 'exams', 'instructor']

function currentRoute(): RouteId {
  const id = window.location.hash.replace(/^#\/?/, '')
  return (ROUTES as readonly string[]).includes(id) ? (id as RouteId) : 'dashboard'
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Tiny hash router: no dependency, works from any static host or file. */
export function useRoute(): RouteId {
  return useSyncExternalStore(subscribe, currentRoute, () => 'dashboard')
}

export const hrefFor = (id: RouteId) => `#/${id}`

export function goTo(id: RouteId) {
  window.location.hash = `/${id}`
}
