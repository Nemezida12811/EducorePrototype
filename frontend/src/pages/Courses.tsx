import { useState } from 'react'
import { CourseCard } from '../components/ui/CourseCard'
import { EmptyState } from '../components/ui/EmptyState'
import { FilterTabs } from '../components/ui/FilterTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { Copy, Plus } from 'lucide-react'
import { CourseForm } from '../components/forms/CourseForm'
import { Button } from '../components/ui/Button'
import { SelectField } from '../components/ui/Field'
import { Panel } from '../components/ui/Panel'
import { errorMessage } from '../data/actions'
import { mapCourseDetail } from '../data/mappers'
import type { CourseDetailData } from '../data/types'
import { api } from '../lib/api'
import { useCourses } from '../data/stores'
import { courseHref } from '../lib/router'
import { useApp } from '../state/AppContext'
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
  superadmin: [
    { value: 'open', label: 'Active' },
    { value: 'archived', label: 'Archived' },
  ],
} as const

const DESCRIPTIONS = {
  student: 'Courses you are enrolled in, what else is on offer this year, and the ones you have completed. Open any course for details and grades.',
  instructor: 'Courses you teach, the full active catalog, and the archive. Open a course to see its students and grades.',
  admin: 'Every course offered by the institution, active or archived. Open a course to manage it.',
  superadmin: 'Every course offered by the institution.',
}

export function CoursesPage() {
  const { role, user, enrolledIds, waitlistIds } = useApp()
  const { ids: mine } = useMine()
  const courses = useCourses()
  const [creating, setCreating] = useState(false)
  const [picking, setPicking] = useState(false)
  const [template, setTemplate] = useState<CourseDetailData | undefined>()
  const canCreate = role === 'instructor' || role === 'admin'
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
        action={
          <div className="flex flex-wrap items-center gap-3">
            <FilterTabs label="Filter courses" options={[...options]} value={filter} onChange={setChosen} />
            {canCreate && !creating && !picking && (
              <>
                <Button className="bg-blush" variant="secondary" onClick={() => setCreating(true)}>
                  <Plus aria-hidden="true" className="mr-2 size-4" />
                  New course
                </Button>
                <Button className="bg-blush" variant="secondary" onClick={() => setPicking(true)}>
                  <Copy aria-hidden="true" className="mr-2 size-4" />
                  Create based on…
                </Button>
              </>
            )}
          </div>
        }
      />
      {picking && (
        <div className="mb-10">
          <TemplatePicker
            courses={courses.filter((c) => role !== 'instructor' || c.teacherIds.includes(user.id) || !c.archived)}
            onCancel={() => setPicking(false)}
            onPicked={(detail) => {
              setPicking(false)
              setTemplate(detail)
              setCreating(true)
            }}
          />
        </div>
      )}
      {creating && (
        <div className="mb-10">
          <CourseForm
            key={template?.id ?? 'blank'}
            template={template}
            onDone={(createdId) => {
              setCreating(false)
              setTemplate(undefined)
              if (createdId) window.location.hash = courseHref(createdId).slice(1)
            }}
          />
        </div>
      )}
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

function TemplatePicker({ courses, onPicked, onCancel }: { courses: { id: string; code: string; name: string; academicYear: string }[]; onPicked: (c: CourseDetailData) => void; onCancel: () => void }) {
  const sorted = [...courses].sort((a, b) => b.academicYear.localeCompare(a.academicYear) || a.code.localeCompare(b.code))
  const [id, setId] = useState(sorted[0]?.id ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    try {
      onPicked(mapCourseDetail(await api<Record<string, unknown>>(`/courses/${id}`)))
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <Panel title="Create a course based on an existing one">
      <p className="mb-4 text-ink-soft">Syllabus, grading scheme, prerequisites, teachers and timetable are copied into a new form. Nothing is saved until you save it.</p>
      <div className="max-w-xl">
        <SelectField label="Course to copy" value={id} onChange={setId} options={sorted.map((c) => ({ value: c.id, label: `${c.code} ${c.name} (${c.academicYear})` }))} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={!id || busy} onClick={() => void go()}>Continue</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <p role="alert" className="font-semibold">{error}</p>
      </div>
    </Panel>
  )
}
