import { studentGrades } from '../data/demo'
import { getCourse } from '../data/selectors'
import type { Course, GradingComponent, Mark, StudentGrade } from '../data/types'

/** Slovak ECTS-style scale on the 0 to 100 final score. */
export const SCALE: { mark: Mark; min: number; range: string; name: string }[] = [
  { mark: 'A', min: 93, range: '93 to 100', name: 'Excellent' },
  { mark: 'B', min: 85, range: '85 to 92', name: 'Very good' },
  { mark: 'C', min: 77, range: '77 to 84', name: 'Good' },
  { mark: 'D', min: 69, range: '69 to 76', name: 'Satisfactory' },
  { mark: 'E', min: 61, range: '61 to 68', name: 'Sufficient' },
  { mark: 'FX', min: 0, range: 'Below 61', name: 'Fail' },
]

export const scoreToMark = (score: number): Mark => SCALE.find((s) => score >= s.min)!.mark

export interface GradeSummary {
  /** Points collected so far. */
  total: number
  /** Maximum of the components graded so far. */
  graded: number
  /** All components graded: total becomes the final score. */
  complete: boolean
  mark: Mark | null
}

export function summarize(scheme: GradingComponent[], points: (number | null)[]): GradeSummary {
  let total = 0
  let graded = 0
  let done = 0
  points.forEach((p, i) => {
    if (p !== null && scheme[i]) {
      total += p
      graded += scheme[i].max
      done += 1
    }
  })
  const complete = done === scheme.length
  return { total, graded, complete, mark: complete ? scoreToMark(total) : null }
}

/** Pads a roster row (first N components) to the full scheme length with nulls. */
export const padRow = (row: number[], length: number): (number | null)[] =>
  Array.from({ length }, (_, i) => (i < row.length ? row[i] : null))

export const gradeFor = (courseId: string): StudentGrade | undefined =>
  studentGrades.find((g) => g.courseId === courseId)

export function summaryFor(course: Course, grade: StudentGrade | undefined): GradeSummary {
  return summarize(course.gradingScheme, grade ? grade.entries.map((e) => e.points) : course.gradingScheme.map(() => null))
}

/** Courses the demo student has passed (all components graded, mark above FX). */
export function completedCourseIds(): Set<string> {
  return new Set(
    studentGrades
      .filter((g) => {
        const s = summaryFor(getCourse(g.courseId), g)
        return s.complete && s.mark !== 'FX'
      })
      .map((g) => g.courseId),
  )
}
