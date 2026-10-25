import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { RouteId } from '../../lib/router'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell({ route, routeKey, children }: { route: RouteId; routeKey: string; children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // Close the drawer after navigating, and move focus to the new page (skipped on first load).
  useEffect(() => {
    setNavOpen(false)
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [routeKey])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <button
        type="button"
        onClick={() => mainRef.current?.focus()}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-blush focus:px-4 focus:py-2 focus:font-semibold focus:text-wine"
      >
        Skip to content
      </button>
      <Sidebar route={route} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="min-w-0">
        <TopBar navOpen={navOpen} onOpenNav={() => setNavOpen(true)} />
        <main ref={mainRef} tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none focus-visible:shadow-none focus-visible:outline-none sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  )
}
