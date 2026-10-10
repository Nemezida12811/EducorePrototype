import type { Mark } from '../data/types'

const parse = (iso: string) => new Date(`${iso}T00:00:00`)

const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const weekdayDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const formatDate = (iso: string) => longDate.format(parse(iso))
export const formatShortDate = (iso: string) => shortDate.format(parse(iso))
export const formatWeekdayDate = (iso: string) => weekdayDate.format(parse(iso))

/** Slovak grading scale: A is best, FX is a fail. */
export const MARK_VALUE: Record<Mark, number> = { A: 1, B: 1.5, C: 2, D: 2.5, E: 3, FX: 4 }

export function weightedAverage(items: { credits: number; mark: Mark }[]): number {
  const credits = items.reduce((sum, i) => sum + i.credits, 0)
  if (credits === 0) return 0
  return items.reduce((sum, i) => sum + MARK_VALUE[i.mark] * i.credits, 0) / credits
}

export const percent = (value: number, max: number) => (max === 0 ? 0 : Math.round((value / max) * 100))
