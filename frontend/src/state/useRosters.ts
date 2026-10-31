import { useEffect } from 'react'
import { loadRoster } from '../data/load'
import { useRosters } from '../data/stores'

/** Loads the rosters (students with grades) of the given courses and returns all rosters loaded so far. */
export function useCourseRosters(courseIds: string[]) {
  const rosters = useRosters()
  const key = courseIds.join(',')
  useEffect(() => {
    courseIds.forEach((id) => void loadRoster(id).catch(() => undefined))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return rosters
}
