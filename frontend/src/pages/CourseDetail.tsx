import { useCallback, useEffect, useState } from 'react'
import { Archive, ArchiveRestore, ArrowLeft, Award, BookOpen, CheckCircle2, FileText, Gauge, Hourglass, Pencil, Percent, Trash2, Users } from 'lucide-react'
import { CourseForm } from '../components/forms/CourseForm'
import { ExamForm } from '../components/forms/ExamForm'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CourseLink } from '../components/ui/CourseLink'
import { DataTable, type Column } from '../components/ui/DataTable'
import { EmptyState } from '../components/ui/EmptyState'
import { fieldClass, SelectField } from '../components/ui/Field'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import {
  deleteExam, deleteFile, enroll, errorMessage, saveGrade, setCourseArchived, uploadCourseDocument, withdraw,
  reloadRoster,
} from '../data/actions'
import { mapCourseDetail } from '../data/mappers'
import { findCourse, teacherName, teacherNames } from '../data/selectors'
import { useCourses, useExams, useOrgUnits, useSessions } from '../data/stores'
import type { ClassSession, Course, CourseDetailData, Mark, RosterRow } from '../data/types'
import { api, ApiError, download } from '../lib/api'
import { sessionsOverlap, slotLabel } from '../lib/conflicts'
import { formatWeekdayDate, percent } from '../lib/format'
import { SCALE, summarize, summaryOf, pointsFor } from '../lib/grades'
import { hrefFor } from '../lib/router'
import { useApp } from '../state/AppContext'
import { useCourseRosters } from '../state/useRosters'

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'error'; message: string } | { state: 'ready'; detail: CourseDetailData }

/** GET /courses/:id: the fields the list does not carry (prerequisites, timetable, documents, your own grade and enrollment). */
function useCourseDetail(courseId: string) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const reload = useCallback(async () => {
    try {
      const raw = await api<Record<string, unknown>>(`/courses/${courseId}`)
      setLoad({ state: 'ready', detail: mapCourseDetail(raw) })
    } catch (e) {
      setLoad(e instanceof ApiError && e.status === 404 ? { state: 'missing' } : { state: 'error', message: errorMessage(e) })
    }
  }, [courseId])
  useEffect(() => {
    setLoad({ state: 'loading' })
    void reload()
  }, [reload])
  return { load, reload }
}

export function CourseDetailPage({ courseId }: { courseId: string }) {
  const { load, reload } = useCourseDetail(courseId)
  useCourses() // the list (seat counts) changes when someone enrolls
  if (load.state === 'loading') return <p role="status">Loading course…</p>
  if (load.state !== 'ready') {
    return (
      <>
        <BackLink />
        <Panel title={load.state === 'missing' ? 'Course not found' : 'The course could not be loaded'}>
          <EmptyState title={load.state === 'missing' ? 'There is no course with this address' : load.message}>
            Go back to the course list and pick one from there.
          </EmptyState>
        </Panel>
      </>
    )
  }
  return <CourseDetail detail={load.detail} reload={reload} />
}

function BackLink() {
  return (
    <a href={hrefFor('courses')} className="mb-6 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
      <ArrowLeft aria-hidden="true" className="size-4" />
      All courses
    </a>
  )
}

function CourseDetail({ detail, reload }: { detail: CourseDetailData; reload: () => Promise<void> }) {
  const { role, enrolledIds, waitlistIds, enrollmentFor } = useApp()
  const units = useOrgUnits()
  const mySessions = useSessions()
  const exams = useExams()
  // The list entry has the live seat counts; the detail was loaded earlier.
  const course: CourseDetailData = { ...detail, ...(findCourse(detail.id) ?? {}) }
  const sessions = detail.sessions
  const [editing, setEditing] = useState(false)
  const [addingExam, setAddingExam] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const taken = course.enrolled
  const full = taken >= course.studentLimit
  const enrolled = enrolledIds.has(course.id)
  const waitlisted = waitlistIds.has(course.id)
  const canManage = course.canManage
  const teaches = role === 'instructor' && canManage
  const unit = units.find((u) => u.id === course.orgUnitId)
  const courseExams = exams.filter((e) => e.courseId === course.id).sort((a, b) => a.date.localeCompare(b.date))

  const unmet = detail.missingPrerequisites
  // Schedule check: the sessions the student already attends in other courses.
  const others = mySessions.filter((x) => x.courseId !== course.id && enrolledIds.has(x.courseId) && !findCourse(x.courseId)?.archived)
  const clash = sessions.flatMap((mine) => others.filter((other) => sessionsOverlap(mine, other)).map((other) => ({ mine, other }))).at(0)
  const blocked = role === 'student' && !enrolled && !waitlisted && (unmet.length > 0 || clash !== undefined)

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    try {
      setMessage(await action())
      await reload()
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const toggleEnrollment = () =>
    run(async () => {
      const existing = enrollmentFor(course.id)
      if (existing) {
        await withdraw(existing.id)
        return existing.status === 'waitlisted' ? 'You left the waitlist.' : 'You withdrew from the course.'
      }
      const status = await enroll(course.id)
      return status === 'enrolled' ? 'You are enrolled.' : 'The course is full, so you were added to the waitlist.'
    })

  const enrollAction = (
    <div className="flex flex-col items-start gap-2">
      <Button disabled={blocked || busy} onClick={() => void toggleEnrollment()}>
        {enrolled ? 'Withdraw from course' : waitlisted ? 'Leave waitlist' : full ? 'Join waitlist' : 'Enroll'}
      </Button>
      {!enrolled && !waitlisted && clash && (
        <p className="text-sm" role="alert">
          Schedule clash: {slotLabel(clash.mine)} ({clash.mine.type}) overlaps {findCourse(clash.other.courseId)?.name ?? 'another course'}, {slotLabel(clash.other)}.
        </p>
      )}
      {blocked && unmet.length > 0 && (
        <p className="text-sm">
          Complete first: {unmet.map((p, i) => (
            <span key={p.id}>{i > 0 && ', '}<CourseLink courseId={p.id} /></span>
          ))}
        </p>
      )}
    </div>
  )

  const setArchived = (archived: boolean) =>
    run(async () => {
      await setCourseArchived(course.id, archived)
      return archived ? 'Course archived. Grades and history are kept.' : 'Course restored to the active list.'
    })

  return (
    <>
      <BackLink />
      <header className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-rose">{course.code}</span>
            {course.archived ? <Badge tone="onDark">Archived</Badge> : <Badge tone="soft">Active</Badge>}
            {role === 'student' && enrolled && <Badge tone="soft">Enrolled</Badge>}
            {role === 'student' && waitlisted && <Badge tone="soft">On waitlist</Badge>}
            {teaches && <Badge tone="soft">You teach this</Badge>}
          </div>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{course.name}</h1>
          <p className="mt-3 text-rose">{course.description}</p>
        </div>
        {role === 'student' && !course.archived && (
          <div className="flex max-w-xs flex-col items-start gap-2 rounded-md bg-blush p-4 text-wine">
            <p className="font-semibold">
              {enrolled ? 'You are enrolled' : waitlisted ? 'You are on the waitlist' : full ? 'No seats left' : `${course.studentLimit - taken} seats left`}
            </p>
            {enrollAction}
          </div>
        )}
        {canManage && (
          <div className="flex max-w-xs flex-col items-start gap-2 rounded-md bg-blush p-4 text-wine">
            <p className="font-semibold">Manage course</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" className="mr-2 size-4" />
                Edit details
              </Button>
              {role !== 'instructor' && (
                <Button variant="secondary" disabled={busy} onClick={() => void setArchived(!course.archived)}>
                  {course.archived ? <ArchiveRestore aria-hidden="true" className="mr-2 size-4" /> : <Archive aria-hidden="true" className="mr-2 size-4" />}
                  {course.archived ? 'Restore' : 'Archive'}
                </Button>
              )}
            </div>
          </div>
        )}
      </header>
      <p role="status" aria-live="polite" className="mb-6 text-rose empty:hidden">{message}</p>

      {editing && (
        <div className="mb-10">
          <CourseForm
            initial={detail}
            onDone={(saved) => {
              setEditing(false)
              if (saved) {
                setMessage('Course details saved.')
                void reload()
              }
            }}
          />
        </div>
      )}

      <Stats course={course} detail={detail} teaches={canManage} />

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className="flex flex-col gap-10 lg:col-span-3">
          {role === 'student' && <StudentGrades course={course} detail={detail} enrolled={enrolled} />}
          {role === 'instructor' && (canManage ? <TeacherGrades course={course} /> : <NoAccess />)}
          {role === 'admin' && <TeacherGrades course={course} />}
          <Panel title="Grading scheme">
            <ul className="divide-y divide-rose">
              {course.gradingScheme.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <span>{c.name}</span>
                  <span className="text-right">
                    <span className="font-semibold">{c.max} points</span>
                    {c.min > 0 && <span className="block text-sm text-ink-soft">at least {c.min} to pass</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-soft">
              Completion: {course.completionType.toLowerCase()}. The final score is the sum of all components, 0 to 100. A component below its minimum gives FX.
            </p>
          </Panel>
          <Panel title="Topics">
            {course.topics.length === 0 ? (
              <p className="text-ink-soft">No topics added yet.</p>
            ) : (
              <ul className="grid list-disc gap-x-8 gap-y-1.5 pl-5 sm:grid-cols-2">
                {course.topics.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-10 lg:col-span-2">
          <Panel title="Course details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
              <dt className="text-ink-soft">Department</dt>
              <dd>{unit ? `${unit.name} (${unit.code})` : '-'}</dd>
              <dt className="text-ink-soft">Year</dt>
              <dd>{course.academicYear}, {course.semester.toLowerCase()} semester</dd>
              <dt className="text-ink-soft">Guarantor</dt>
              <dd className="font-semibold">{teacherName(course.guarantorId)}</dd>
              <dt className="text-ink-soft">Teachers</dt>
              <dd>{teacherNames(course).join(', ')}</dd>
              <dt className="text-ink-soft">Student limit</dt>
              <dd>{taken} of {course.studentLimit}{course.waitlisted > 0 ? `, ${course.waitlisted} waiting` : ''}</dd>
              <dt className="text-ink-soft">Status</dt>
              <dd>{course.archived ? 'Archived, history is kept' : 'Active'}</dd>
            </dl>
          </Panel>

          <Panel title="Prerequisites">
            {detail.prerequisites.length === 0 ? (
              <p className="text-ink-soft">No prerequisites.</p>
            ) : (
              <ul className="divide-y divide-rose">
                {detail.prerequisites.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="font-semibold"><CourseLink courseId={p.id} /></span>
                    {role === 'student' && (
                      <Badge tone={unmet.some((u) => u.id === p.id) ? 'outline' : 'solid'}>{unmet.some((u) => u.id === p.id) ? 'Not completed' : 'Completed'}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <TimetablePanel course={course} sessions={sessions} />

          {!course.archived && (
            <Panel
              title="Exam terms"
              action={canManage && !addingExam ? <Button variant="secondary" onClick={() => setAddingExam(true)}>Add exam term</Button> : undefined}
            >
              {courseExams.length === 0 ? (
                <p className="text-ink-soft">No exam terms published yet.</p>
              ) : (
                <ul className="divide-y divide-rose">
                  {courseExams.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-semibold">{formatWeekdayDate(e.date)} at {e.start}</p>
                        <p className="text-sm text-ink-soft">Term {e.term}, {e.format.toLowerCase()}, room {e.room}, {e.registered} of {e.capacity} registered</p>
                      </div>
                      {canManage && (
                        <Button
                          variant="secondary"
                          className="min-h-9 px-2"
                          onClick={() => void run(async () => { await deleteExam(e.id); return 'Exam term removed.' })}
                          aria-label={`Remove term ${e.term} on ${formatWeekdayDate(e.date)}`}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {addingExam && (
                <div className="mt-5 border-t border-rose pt-5">
                  <ExamForm courses={[course]} fixedCourseId={course.id} onDone={() => setAddingExam(false)} />
                </div>
              )}
            </Panel>
          )}

          <DocumentsPanel course={course} detail={detail} canUpload={canManage && !course.archived} reload={reload} />
        </div>
      </div>
    </>
  )
}

function Stats({ course, detail, teaches }: { course: Course; detail: CourseDetailData; teaches: boolean }) {
  const { role } = useApp()
  const rosters = useCourseRosters(role === 'student' || !teaches ? [] : [course.id])
  const taken = course.enrolled
  const credits = <StatCard key="cr" label="Credits" value={`${course.credits} ECTS`} hint={course.completionType} icon={BookOpen} />
  if (role === 'student') {
    const s = summaryOf(course.gradingScheme, detail.myGrade)
    return (
      <StatGrid>
        {credits}
        <StatCard key="score" label={s.complete ? 'Final score' : 'Points so far'} value={String(s.total)} hint={s.complete ? `Mark ${s.mark}, out of 100` : `Of ${s.graded} graded so far, 100 in total`} icon={Award} />
        <StatCard
          key="pct"
          label={s.complete ? 'Result' : 'Graded work'}
          value={s.graded === 0 ? 'None yet' : `${percent(s.total, s.graded)}%`}
          hint={s.graded === 0 ? 'Nothing graded yet' : s.complete ? 'Of the 100 points' : 'Of the points available so far'}
          icon={Percent}
        />
        <StatCard key="seats" label="Students" value={`${taken}`} hint={`Limit ${course.studentLimit}`} icon={Users} />
      </StatGrid>
    )
  }
  const rows = rosters[course.id]
  const shares = (rows ?? []).map((r) => summarize(course.gradingScheme, pointsFor(course.gradingScheme, r.components))).filter((s) => s.graded > 0).map((s) => percent(s.total, s.graded))
  const avg = shares.length ? Math.round(shares.reduce((a, b) => a + b, 0) / shares.length) : null
  const visible = teaches && avg !== null
  return (
    <StatGrid>
      {credits}
      <StatCard key="seats" label="Students" value={`${taken}`} hint={`Limit ${course.studentLimit}`} icon={Users} />
      <StatCard key="occ" label="Occupancy" value={`${percent(taken, course.studentLimit)}%`} hint="Of the student limit" icon={Gauge} />
      <StatCard key="avg" label="Average result" value={visible ? `${avg}%` : 'Hidden'} hint={visible ? 'Of points available so far' : 'Grades are visible to course teachers'} icon={Percent} />
    </StatGrid>
  )
}

function StudentGrades({ course, detail, enrolled }: { course: Course; detail: CourseDetailData; enrolled: boolean }) {
  const grade = detail.myGrade
  const s = summaryOf(course.gradingScheme, grade)

  if (!enrolled && !grade) {
    return (
      <Panel title="Your grades">
        <EmptyState title="You are not enrolled in this course">Enroll to see your grades here.</EmptyState>
      </Panel>
    )
  }

  type Row = { name: string; max: number; min: number; points: number | null }
  const points = pointsFor(course.gradingScheme, grade?.components)
  const rows: Row[] = course.gradingScheme.map((c, i) => ({ name: c.name, max: c.max, min: c.min, points: points[i] ?? null }))

  const columns: Column<Row>[] = [
    { header: 'Component', rowHeader: true, cell: (r) => r.name },
    { header: 'Points', cell: (r) => <span className="whitespace-nowrap">{r.points === null ? '-' : r.points} / {r.max}</span> },
    { header: 'Minimum', cell: (r) => (r.min > 0 ? r.min : '-') },
    {
      header: 'Score',
      align: 'right',
      cell: (r) =>
        r.points !== null && r.points < r.min ? (
          <Badge tone="outline">Below minimum</Badge>
        ) : r.points === null ? (
          <Badge tone="outline">Not graded</Badge>
        ) : (
          <div className="ml-auto flex items-center gap-3">
            <div className="w-24"><ProgressBar value={r.points} max={r.max} label={`${r.name} score`} /></div>
            <span className="w-10 text-right font-semibold">{percent(r.points, r.max)}%</span>
          </div>
        ),
    },
  ]

  return (
    <Panel
      title="Your grades"
      flush
      action={
        s.complete ? (
          <span className="inline-flex items-center gap-2 font-semibold">
            <CheckCircle2 aria-hidden="true" className="size-5" />
            Final: {s.total} / 100
            <Badge tone="solid">{s.mark}</Badge>
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 font-semibold">
            <Hourglass aria-hidden="true" className="size-5" />
            In progress: {s.total} points so far
          </span>
        )
      }
    >
      <DataTable caption={`Your grade components in ${course.name}`} columns={columns} rows={rows} getKey={(r) => r.name} />
    </Panel>
  )
}

function TeacherGrades({ course }: { course: Course }) {
  const rosters = useCourseRosters([course.id])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const rows = rosters[course.id]
  if (!rows) return <Panel title="Student grades"><p role="status">Loading students…</p></Panel>
  if (rows.length === 0) {
    return (
      <Panel title="Student grades">
        <EmptyState title="No students yet">Grades appear here once students are enrolled.</EmptyState>
      </Panel>
    )
  }
  const scheme = course.gradingScheme
  const canEdit = !course.archived
  const key = (studentId: string, component: string) => `${studentId}|${component}`
  const valueOf = (r: RosterRow, component: string) => draft[key(r.id, component)] ?? (r.components?.[component] !== undefined ? String(r.components[component]) : '')

  const data = rows.map((r) => ({ ...r, sum: summaryOf(scheme, r) }))
  type Row = (typeof data)[number]

  const save = async () => {
    // Collect what changed, per student. A grade that was entered can be changed but not removed.
    const changes = new Map<string, Record<string, number>>()
    for (const r of rows) {
      for (const c of scheme) {
        const raw = draft[key(r.id, c.name)]
        if (raw === undefined) continue
        const before = r.components?.[c.name]
        if (raw.trim() === '') {
          if (before !== undefined) return setMessage(`${r.name}, ${c.name}: a saved grade cannot be cleared. Enter 0 instead.`)
          continue
        }
        const n = Number(raw)
        if (!Number.isFinite(n) || n < 0 || n > c.max) return setMessage(`${r.name}, ${c.name}: enter points from 0 to ${c.max}.`)
        if (n === before) continue
        changes.set(r.id, { ...(changes.get(r.id) ?? {}), [c.name]: n })
      }
    }
    setSaving(true)
    try {
      for (const [studentId, components] of changes) await saveGrade(course.id, studentId, components)
      await reloadRoster(course.id)
      setDraft({})
      setEditing(false)
      setMessage(changes.size === 0 ? 'Nothing changed.' : `Saved grades for ${changes.size} ${changes.size === 1 ? 'student' : 'students'}.`)
    } catch (e) {
      await reloadRoster(course.id).catch(() => undefined)
      setMessage(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<Row>[] = [
    {
      header: 'Student',
      rowHeader: true,
      cell: (s) => (
        <>
          {s.name}
          <span className="block text-sm font-normal text-ink-soft">{s.email}</span>
        </>
      ),
    },
    ...scheme.map<Column<Row>>((c) => ({
      header: c.min > 0 ? `${c.name} (min ${c.min})` : c.name,
      cell: (s) =>
        editing ? (
          <input
            type="number"
            min={0}
            max={c.max}
            value={valueOf(s, c.name)}
            aria-label={`${s.name}, ${c.name}, out of ${c.max}`}
            onChange={(e) => setDraft((d) => ({ ...d, [key(s.id, c.name)]: e.target.value }))}
            className="min-h-10 w-20 rounded-md border-2 border-wine bg-fog px-2 text-wine"
          />
        ) : (
          <span className={`whitespace-nowrap ${s.components?.[c.name] !== undefined && s.components[c.name]! < c.min ? 'font-semibold underline decoration-wavy' : ''}`}>{s.components?.[c.name] ?? '-'} / {c.max}</span>
        ),
    })),
    { header: 'Total', cell: (s) => <span className="font-semibold whitespace-nowrap">{s.sum.total}{s.sum.complete ? ' / 100' : ''}</span> },
    {
      header: 'Mark',
      align: 'right',
      cell: (s) => (s.sum.mark ? <Badge tone={s.sum.mark === 'FX' ? 'outline' : 'solid'}>{s.sum.mark}</Badge> : <Badge tone="outline">In progress</Badge>),
    },
  ]

  const allComplete = data.every((d) => d.sum.complete)
  const band = (d: Row) => percent(d.sum.total, d.sum.graded)
  const dist: { label: string; count: number }[] = allComplete
    ? SCALE.map((sc) => ({ label: `${sc.mark}, ${sc.name}`, count: data.filter((d) => d.sum.mark === (sc.mark as Mark)).length }))
    : [
        { label: '90% or more', count: data.filter((d) => band(d) >= 90).length },
        { label: '75 to 89%', count: data.filter((d) => band(d) >= 75 && band(d) < 90).length },
        { label: '50 to 74%', count: data.filter((d) => band(d) >= 50 && band(d) < 75).length },
        { label: 'Below 50%', count: data.filter((d) => band(d) < 50).length },
      ]

  return (
    <>
      <Panel
        title="Student grades"
        flush
        action={
          canEdit ? (
            editing ? (
              <div className="flex gap-2">
                <Button disabled={saving} onClick={() => void save()}>Save grades</Button>
                <Button variant="secondary" disabled={saving} onClick={() => { setEditing(false); setDraft({}); setMessage('') }}>Cancel</Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit grades</Button>
            )
          ) : (
            <Badge tone="outline">Archived, read-only</Badge>
          )
        }
      >
        <DataTable caption={`Grades of students in ${course.name}`} columns={columns} rows={data} getKey={(s) => s.id} />
        <p className="px-6 pt-3 pb-3 text-sm text-ink-soft">
          Showing {data.length} of {course.enrolled} students.
          {editing && ' Leave a cell empty for work that is not graded yet. When every component has points, the total becomes the final score and the mark is set.'}
        </p>
        <p role="alert" className="px-6 pb-3 font-semibold empty:hidden">{message}</p>
      </Panel>
      <Panel title={allComplete ? 'Mark distribution' : 'Results so far'}>
        <ul className="flex flex-col gap-3">
          {dist.map((d) => (
            <li key={d.label} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3">
              <span>{d.label}</span>
              <ProgressBar value={d.count} max={data.length} label={`${d.label}: ${d.count} students`} />
              <span className="text-right font-semibold">{d.count}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

function NoAccess() {
  return (
    <Panel title="Student grades">
      <EmptyState title="Grades are hidden">Only the teachers of this course can see student grades.</EmptyState>
    </Panel>
  )
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function TimetablePanel({ course, sessions }: { course: Course; sessions: ClassSession[] }) {
  const sorted = [...sessions].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.start.localeCompare(b.start))
  return (
    <Panel title="Timetable">
      {course.archived ? (
        <p className="text-ink-soft">Archived courses no longer have a live timetable.</p>
      ) : sorted.length === 0 ? (
        <p className="text-ink-soft">No timetable entries yet.</p>
      ) : (
        <ul className="divide-y divide-rose">
          {sorted.map((s) => (
            <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
              <p className="font-semibold">{s.day} {s.start}-{s.end}</p>
              <p className="text-sm text-ink-soft">{s.type}, room {s.room}, {teacherName(s.teacherId)}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const MAX_KB = 10 * 1024

function DocumentsPanel({ course, detail, canUpload, reload }: { course: Course; detail: CourseDetailData; canUpload: boolean; reload: () => Promise<void> }) {
  const docs = detail.documents
  const [kind, setKind] = useState<'Syllabus' | 'Material'>('Material')
  const [error, setError] = useState('')

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) return setError('Only PDF files can be added.')
    if (Math.max(1, Math.round(file.size / 1024)) > MAX_KB) return setError('The file is larger than 10 MB.')
    try {
      await uploadCourseDocument(course.id, file, kind === 'Syllabus' ? 'syllabus' : 'material')
      setError('')
      await reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const remove = async (fileId: string) => {
    try {
      await deleteFile(fileId)
      setError('')
      await reload()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Panel title="Syllabus and documents">
      {docs.length === 0 ? (
        <p className="text-ink-soft">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-rose">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  <FileText aria-hidden="true" className="size-4 shrink-0" />
                  <button
                    type="button"
                    onClick={() => download(`/files/${d.fileId}`, {}, d.name).catch((err) => setError(errorMessage(err)))}
                    className="truncate underline underline-offset-4"
                  >
                    {d.name}
                  </button>
                </p>
                <p className="text-sm text-ink-soft">{d.kind}, {d.sizeKb} KB</p>
              </div>
              {canUpload && (
                <Button variant="secondary" className="min-h-9 px-2" onClick={() => void remove(d.fileId)} aria-label={`Remove ${d.name}`}>
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <div className="mt-5 flex flex-col gap-3 border-t border-rose pt-5">
          <SelectField label="Document type" value={kind} onChange={(v) => setKind(v as 'Syllabus' | 'Material')} options={[{ value: 'Syllabus', label: 'Syllabus' }, { value: 'Material', label: 'Course material' }]} />
          <div>
            <label htmlFor="doc-upload" className="mb-1 block font-medium">Add a PDF</label>
            <input
              id="doc-upload"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => void onFile(e)}
              className={`${fieldClass} py-1.5 file:mr-3 file:rounded file:border-0 file:bg-wine file:px-3 file:py-1 file:font-semibold file:text-blush`}
            />
            <p className="mt-1 text-sm text-ink-soft">PDF only, up to 10 MB.</p>
          </div>
        </div>
      )}
      <p role="alert" className="mt-3 font-semibold empty:hidden">{error}</p>
    </Panel>
  )
}
