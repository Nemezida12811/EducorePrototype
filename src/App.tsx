import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useRoute, type RouteId } from './lib/router'
import { isAllowed, NAV_ITEMS } from './nav'
import { CalendarPage } from './pages/Calendar'
import { CourseDetailPage } from './pages/CourseDetail'
import { CoursesPage } from './pages/Courses'
import { DashboardPage } from './pages/Dashboard'
import { ExamsPage } from './pages/Exams'
import { GradesPage } from './pages/Grades'
import { InstructorPanelPage } from './pages/InstructorPanel'
import { NoticesPage } from './pages/Notices'
import { OrganizationPage } from './pages/Organization'
import { ProfilePage } from './pages/Profile'
import { SchedulePage } from './pages/Schedule'
import { StudyPlanPage } from './pages/StudyPlan'
import { UsersPage } from './pages/Users'
import { useDemo } from './state/DemoContext'

const PAGES: Record<RouteId, () => React.JSX.Element> = {
  dashboard: DashboardPage,
  courses: CoursesPage,
  grades: GradesPage,
  plan: StudyPlanPage,
  schedule: SchedulePage,
  exams: ExamsPage,
  calendar: CalendarPage,
  notices: NoticesPage,
  instructor: InstructorPanelPage,
  users: UsersPage,
  organization: OrganizationPage,
  profile: ProfilePage,
}

export default function App() {
  const requested = useRoute()
  const { role } = useDemo()
  // A route the current role cannot see (e.g. Users as a student) falls back to the dashboard.
  const id: RouteId = isAllowed(requested.id, role) ? requested.id : 'dashboard'
  const Page = PAGES[id]

  useEffect(() => {
    if (id !== requested.id) window.location.hash = '/dashboard'
  }, [id, requested.id])

  useEffect(() => {
    const label = NAV_ITEMS.find((i) => i.id === id)?.label ?? 'Dashboard'
    document.title = `${label} · EduCore`
  }, [id])

  const detail = id === 'courses' && requested.param ? requested.param : undefined
  const routeKey = detail ? `courses/${detail}` : id

  return (
    <AppShell route={id} routeKey={routeKey}>
      {detail ? <CourseDetailPage key={detail} courseId={detail} /> : <Page />}
    </AppShell>
  )
}
