
/** Every session that is not a lecture is a practical group a student chooses between. */
export const isGroup = (s: Pick<ClassSession, 'type'>) => s.type !== 'Lecture'

export const groupName = (s: ClassSession) => `Group ${s.group ?? '?'}`

/**
 * The sessions a student actually attends: all lectures of enrolled courses
 * plus the one practical group chosen per course.
 */
export function studentSessions(
  sessions: ClassSession[],
  enrolledIds: ReadonlySet<string>,
  groupChoice: Readonly<Record<string, string>>,
): ClassSession[] {
  return sessions.filter((s) => enrolledIds.has(s.courseId) && (!isGroup(s) || groupChoice[s.courseId] === s.id))
}
