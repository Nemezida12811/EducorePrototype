import type { ReactNode } from 'react'
import { findCourse } from '../../data/selectors'
import { courseHref } from '../../lib/router'

/** Link to the course detail page; defaults to the course name. */
export function CourseLink({ courseId, children }: { courseId: string; children?: ReactNode }) {
  const course = findCourse(courseId)
  return (
    <a
      href={courseHref(courseId)}
      className="underline decoration-mauve decoration-2 underline-offset-4 hover:decoration-wine"
    >
      {children ?? course?.name ?? courseId}
    </a>
  )
}
