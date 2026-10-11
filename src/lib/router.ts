import { useMemo, useSyncExternalStore } from 'react'

export type RouteId =
  | 'dashboard'
  | 'courses'
  | 'grades'
  | 'plan'
  | 'schedule'
  | 'exams'
  | 'calendar'
  | 'notices'
  | 'instructor'
  | 'users'
  | 'organization'
  | 'platform'
  | 'profile'

const ROUTES: readonly RouteId[] = [
  'dashboard', 'courses', 'grades', 'plan', 'schedule', 'exams', 'calendar', 'notices',
  'instructor', 'users', 'organization', 'platform', 'profile',
]

export interface Route {
  id: RouteId
  /** Detail id, e.g. the course code in #/courses/ads2. */
  param?: string
}

function parse(hash: string): Route {
  const [id, param] = hash.replace(/^#\/?/, '').split('/')
  return (ROUTES as readonly string[]).includes(id)
    ? { id: id as RouteId, param: param || undefined }
    : { id: 'dashboard' }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** Tiny hash router: no dependency, works from any static host or file. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  return useMemo(() => parse(hash), [hash])
}

export const hrefFor = (id: RouteId, param?: string) => (param ? `#/${id}/${param}` : `#/${id}`)
export const courseHref = (courseId: string) => hrefFor('courses', courseId)
