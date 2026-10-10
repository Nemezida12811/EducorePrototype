import { BookOpen, CalendarDays, ClipboardCheck, GraduationCap, LayoutDashboard, Presentation } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from './data/types'
import type { RouteId } from './lib/router'

export interface NavItem {
  id: RouteId
  label: string
  icon: LucideIcon
  roles: Role[]
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['student', 'instructor'] },
  { id: 'courses', label: 'Courses', icon: BookOpen, roles: ['student', 'instructor'] },
  { id: 'grades', label: 'Grades', icon: GraduationCap, roles: ['student'] },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays, roles: ['student', 'instructor'] },
  { id: 'exams', label: 'Exams', icon: ClipboardCheck, roles: ['student', 'instructor'] },
  { id: 'instructor', label: 'Instructor panel', icon: Presentation, roles: ['instructor'] },
]

export const isAllowed = (route: RouteId, role: Role) =>
  NAV_ITEMS.some((item) => item.id === route && item.roles.includes(role))
