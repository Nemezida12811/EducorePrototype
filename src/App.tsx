import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useRoute, type RouteId } from './lib/router'
import { isAllowed, NAV_ITEMS } from './nav'
import { CoursesPage } from './pages/Courses'
import { DashboardPage } from './pages/Dashboard'
import { ExamsPage } from './pages/Exams'
import { GradesPage } from './pages/Grades'
import { InstructorPanelPage } from './pages/InstructorPanel'
import { SchedulePage } from './pages/Schedule'
import { useDemo } from './state/DemoContext'

const PAGES: Record<RouteId, () => React.JSX.Element> = {
  dashboard: DashboardPage,
  courses: CoursesPage,
  grades: GradesPage,
  schedule: SchedulePage,
  exams: ExamsPage,
  instructor: InstructorPanelPage,
}

export default function App() {
  const requested = useRoute()
  const { role } = useDemo()
  // A route the current role cannot see (e.g. Instructor panel as a student) falls back to the dashboard.
  const route: RouteId = isAllowed(requested, role) ? requested : 'dashboard'
  const Page = PAGES[route]

  useEffect(() => {
    if (route !== requested) window.location.hash = '/dashboard'
  }, [route, requested])

  useEffect(() => {
    const label = NAV_ITEMS.find((i) => i.id === route)?.label ?? 'Dashboard'
    document.title = `${label} · EduCore`
  }, [route])

  return (
    <AppShell route={route}>
      <Page />
    </AppShell>
  )
}
