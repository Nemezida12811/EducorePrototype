import { gradesStore } from '../data/stores'
import type { GradingComponent, Mark, StudentGrade } from '../data/types'

/** Slovak ECTS-style scale on the 0 to 100 final score (the API uses the same one). */
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
  /** All components graded: total is the final score. */
  complete: boolean
  mark: Mark | null
  /** Graded components that are below their required minimum. */
  belowMin: string[]
}

/** Points per scheme component, in scheme order; null = not graded yet. */
export const pointsFor = (scheme: GradingComponent[], components: Record<string, number> | null | undefined): (number | null)[] =>
  scheme.map((c) => (typeof components?.[c.name] === 'number' ? components[c.name]! : null))

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
  const complete = scheme.length > 0 && done === scheme.length
  const belowMin = scheme.filter((c, i) => points[i] !== null && points[i]! < c.min).map((c) => c.name)
  // Missing a required minimum fails the course whatever the total is.
  return { total, graded, complete, mark: complete ? (belowMin.length ? 'FX' : scoreToMark(total)) : null, belowMin }
}

/** Summary of one grade as the API stores it: the API's final score and mark win when present. */
export function summaryOf(
  scheme: GradingComponent[],
  grade: { components: Record<string, number> | null; finalScore: number | null; mark: Mark | null } | null | undefined,
): GradeSummary {
  const s = summarize(scheme, pointsFor(scheme, grade?.components))
  if (grade && grade.finalScore !== null && grade.mark !== null) return { ...s, total: grade.finalScore, complete: true, mark: grade.mark }
  return s
}

export const gradeFor = (courseId: string): StudentGrade | undefined => gradesStore.get().find((g) => g.courseId === courseId)

/** Courses the signed-in student has passed (final mark above FX). */
export const completedCourseIds = (grades: StudentGrade[]): Set<string> =>
  new Set(grades.filter((g) => g.finalScore !== null && g.mark !== null && g.mark !== 'FX').map((g) => g.courseId))
