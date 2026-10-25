import {
  BookOpen,
  Bell,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Network,
  Presentation,
  SlidersHorizontal,
  UserCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from './data/types'
import type { RouteId } from './lib/router'

export interface NavItem {
  id: RouteId
  label: string
  icon: LucideIcon
  roles: Role[]
}

const INSTITUTION: Role[] = ['student', 'instructor', 'admin']
const ALL: Role[] = ['student', 'instructor', 'admin', 'superadmin']

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
  { id: 'platform', label: 'Platform', icon: SlidersHorizontal, roles: ['superadmin'] },
  { id: 'courses', label: 'Courses', icon: BookOpen, roles: INSTITUTION },
  { id: 'plan', label: 'Study plan', icon: ListChecks, roles: ['student'] },
  { id: 'grades', label: 'Grades', icon: GraduationCap, roles: ['student'] },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays, roles: INSTITUTION },
  { id: 'exams', label: 'Exams', icon: ClipboardCheck, roles: INSTITUTION },
  { id: 'calendar', label: 'Calendar', icon: CalendarRange, roles: INSTITUTION },
  { id: 'notices', label: 'Notices', icon: Bell, roles: INSTITUTION },
  { id: 'instructor', label: 'Instructor panel', icon: Presentation, roles: ['instructor'] },
  { id: 'users', label: 'Users', icon: Users, roles: ['admin'] },
  { id: 'organization', label: 'Organization', icon: Network, roles: ['admin'] },
  { id: 'profile', label: 'Profile', icon: UserCog, roles: ALL },
]

export const isAllowed = (route: RouteId, role: Role) =>
  NAV_ITEMS.some((item) => item.id === route && item.roles.includes(role))
