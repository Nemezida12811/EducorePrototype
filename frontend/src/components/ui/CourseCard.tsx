import { ArrowRight, Users } from 'lucide-react'
import { teacherNames } from '../../data/selectors'
import type { Course } from '../../data/types'
import { courseHref } from '../../lib/router'
import { useDemo } from '../../state/DemoContext'
import { Badge } from './Badge'
import { ProgressBar } from './ProgressBar'

interface CourseCardProps {
  course: Course
  /** Extra status shown beside the code, e.g. "Enrolled". */
  status?: string
}

export function CourseCard({ course, status }: CourseCardProps) {
  const { seatsTaken } = useDemo()
  const taken = seatsTaken(course)
  const full = taken >= course.studentLimit
  const seatsLeft = course.studentLimit - taken
  return (
    <article className="layer-panel group relative mr-2 mb-2 flex flex-col rounded-md bg-blush p-5 text-wine transition-colors hover:bg-fog">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{course.code}</span>
        {course.archived && <Badge tone="outline">Archived</Badge>}
        {!course.archived && full && <Badge tone="solid">Full</Badge>}
        {status && <Badge tone="soft">{status}</Badge>}
      </div>
      <h3 className="text-xl leading-snug font-semibold tracking-tight">
        {/* Stretched link: the whole card is clickable, the title is the accessible name. */}
        <a href={courseHref(course.id)} className="after:absolute after:inset-0 after:rounded-md after:content-['']">
          {course.name}
        </a>
      </h3>
      <p className="mt-2 line-clamp-3 text-ink-soft">{course.description}</p>

      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-soft">Teachers</dt>
        <dd>{teacherNames(course).join(', ')}</dd>
        <dt className="text-ink-soft">Year</dt>
        <dd>
          {course.academicYear}, {course.semester.toLowerCase()} semester
        </dd>
        <dt className="text-ink-soft">Credits</dt>
        <dd>{course.credits} ECTS</dd>
      </dl>

      <div className="mt-auto pt-5">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Users aria-hidden="true" className="size-4" />
            {taken} of {course.studentLimit} students
          </span>
          {!course.archived && <span>{full ? 'No seats left' : `${seatsLeft} seats left`}</span>}
        </div>
        <ProgressBar value={taken} max={course.studentLimit} label={`${course.name} enrollment`} />
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
          Open course <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-1" />
        </p>
      </div>
    </article>
  )
}
