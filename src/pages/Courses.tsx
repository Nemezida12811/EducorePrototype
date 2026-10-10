import { useState } from 'react'
import { CourseCard } from '../components/ui/CourseCard'
import { EmptyState } from '../components/ui/EmptyState'
import { FilterTabs } from '../components/ui/FilterTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { courses } from '../data/demo'
import { useDemo } from '../state/DemoContext'
import { useMine } from '../state/useMine'

type Filter = 'mine' | 'open' | 'archived'

const OPTIONS = {
  student: [
    { value: 'mine', label: 'Enrolled' },
    { value: 'open', label: 'Catalog' },
    { value: 'archived', label: 'Archived' },
  ],
  instructor: [
    { value: 'mine', label: 'Teaching' },
    { value: 'open', label: 'All active' },
    { value: 'archived', label: 'Archived' },
  ],
  admin: [
    { value: 'open', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ],
} as const

const DESCRIPTIONS = {
  student: 'Courses you are enrolled in, what else is on offer this year, and the ones you have completed. Open any course for details and grades.',
  instructor: 'Courses you teach, the full active catalog, and the archive. Open a course to see its students and grades.',
  admin: 'Every course offered by the institution, active or archived. Open a course for details.',
}

export function CoursesPage() {
  const { role, enrolledIds, waitlistIds } = useDemo()
  const { ids: mine } = useMine()
  const [chosen, setChosen] = useState<Filter>('mine')
  const options = OPTIONS[role] as readonly { value: Filter; label: string }[]
  const filter: Filter = options.some((o) => o.value === chosen) ? chosen : options[0].value

  const visible = courses.filter((c) => {
    if (filter === 'archived') return c.archived
    if (c.archived) return false
    if (filter === 'mine') return mine.has(c.id)
    return role === 'student' ? !mine.has(c.id) : true
  })

  const statusOf = (id: string, archived: boolean) => {
    if (archived) return undefined
    if (role === 'student') return enrolledIds.has(id) ? 'Enrolled' : waitlistIds.has(id) ? 'Waitlisted' : undefined
    if (role === 'instructor') return mine.has(id) ? 'You teach this' : undefined
    return undefined
  }

  return (
    <>
      <PageHeader
        title="Courses"
        description={DESCRIPTIONS[role]}
        action={<FilterTabs label="Filter courses" options={[...options]} value={filter} onChange={setChosen} />}
      />
      <p className="mb-5 text-rose" role="status">
        {visible.length} {visible.length === 1 ? 'course' : 'courses'}
      </p>
      {visible.length === 0 ? (
        <EmptyState title="Nothing here yet">Try a different filter.</EmptyState>
      ) : (
        <ul className="grid gap-x-8 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((course) => (
            <li key={course.id} className="flex">
              <div className="flex w-full flex-col [&>article]:flex-1">
                <CourseCard course={course} status={statusOf(course.id, course.archived)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
