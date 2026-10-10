import { useState } from 'react'
import { CourseCard } from '../components/ui/CourseCard'
import { EmptyState } from '../components/ui/EmptyState'
import { FilterTabs } from '../components/ui/FilterTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { courses } from '../data/demo'
import { myCourseIds } from '../data/selectors'
import { useDemo } from '../state/DemoContext'

type Filter = 'mine' | 'open' | 'archived'

export function CoursesPage() {
  const { role } = useDemo()
  const [filter, setFilter] = useState<Filter>('mine')
  const mine = myCourseIds(role)
  const student = role === 'student'

  const options: { value: Filter; label: string }[] = student
    ? [
        { value: 'mine', label: 'Enrolled' },
        { value: 'open', label: 'Catalog' },
        { value: 'archived', label: 'Archived' },
      ]
    : [
        { value: 'mine', label: 'Teaching' },
        { value: 'open', label: 'All active' },
        { value: 'archived', label: 'Archived' },
      ]

  const visible = courses.filter((c) => {
    if (filter === 'archived') return c.archived
    if (c.archived) return false
    if (filter === 'mine') return mine.has(c.id)
    return student ? !mine.has(c.id) : true
  })

  return (
    <>
      <PageHeader
        title="Courses"
        description={
          student
            ? 'Courses you are enrolled in, what else is on offer this year, and the ones you have completed.'
            : 'Courses you teach, the full active catalog, and last year’s archive.'
        }
        action={<FilterTabs label="Filter courses" options={options} value={filter} onChange={setFilter} />}
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
                <CourseCard
                  course={course}
                  status={!course.archived && mine.has(course.id) ? (student ? 'Enrolled' : 'You teach this') : undefined}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
