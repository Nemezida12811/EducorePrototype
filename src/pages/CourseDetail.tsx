import { useState } from 'react'
import { Archive, ArchiveRestore, ArrowLeft, Award, BookOpen, CheckCircle2, FileText, Gauge, Hourglass, Pencil, Percent, Send, Trash2, Users } from 'lucide-react'
import { CourseForm } from '../components/forms/CourseForm'
import { ExamForm } from '../components/forms/ExamForm'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { CourseLink } from '../components/ui/CourseLink'
import { DataTable, type Column } from '../components/ui/DataTable'
import { EmptyState } from '../components/ui/EmptyState'
import { fieldClass, SelectField, TextAreaField, TextField } from '../components/ui/Field'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { DEMO_TODAY, INSTRUCTOR_ID, roster, rosterGroups } from '../data/demo'
import { findCourse, getCourse, teacherName, teacherNames } from '../data/selectors'
import {
  coursesStore,
  documentsStore,
  examsStore,
  setRosterGrade,
  useCourses,
  useDocuments,
  useExams,
  useOrgUnits,
  useRosterGrades,
  useSessions,
} from '../data/stores'
import type { ClassSession, Course, Mark } from '../data/types'
import { slotLabel, sessionsOverlap } from '../lib/conflicts'
import { formatDate, formatWeekdayDate, percent } from '../lib/format'
import { completedCourseIds, gradeFor, SCALE, summarize, summaryFor } from '../lib/grades'
import { groupName, isGroup } from '../lib/groups'
import { hrefFor } from '../lib/router'
import { useDemo } from '../state/DemoContext'

export function CourseDetailPage({ courseId }: { courseId: string }) {
  useCourses() // re-render when the course is edited or archived
  const course = findCourse(courseId)
  if (!course) {
    return (
      <>
        <BackLink />
        <Panel title="Course not found">
          <EmptyState title="There is no course with this address">Go back to the course list and pick one from there.</EmptyState>
        </Panel>
      </>
    )
  }
  return <CourseDetail course={course} />
}

function BackLink() {
  return (
    <a href={hrefFor('courses')} className="mb-6 inline-flex items-center gap-2 font-semibold underline underline-offset-4">
      <ArrowLeft aria-hidden="true" className="size-4" />
      All courses
    </a>
  )
}

function CourseDetail({ course }: { course: Course }) {
  const { role, enrolledIds, waitlistIds, seatsTaken, toggleEnrollment, groupChoice } = useDemo()
  const units = useOrgUnits()
  const allSessions = useSessions()
  const sessions = allSessions.filter((s) => s.courseId === course.id)
  const groups = sessions.filter(isGroup).sort((a, b) => (a.group ?? '').localeCompare(b.group ?? ''))
  const lectures = sessions.filter((s) => !isGroup(s))
  const currentGroup = groupChoice[course.id]
  const [selectedGroup, setSelectedGroup] = useState(currentGroup ?? (groups.length === 1 ? groups[0].id : ''))
  const [editing, setEditing] = useState(false)
  const [addingExam, setAddingExam] = useState(false)
  const [message, setMessage] = useState('')
  const allExams = useExams()

  const taken = seatsTaken(course)
  const full = taken >= course.studentLimit
  const enrolled = enrolledIds.has(course.id)
  const waitlisted = waitlistIds.has(course.id)
  const teaches = role === 'instructor' && course.teacherIds.includes(INSTRUCTOR_ID)
  const canManage = role === 'admin' || teaches
  const unit = units.find((u) => u.id === course.orgUnitId)
  const courseExams = allExams.filter((e) => e.courseId === course.id).sort((a, b) => a.date.localeCompare(b.date))

  const done = completedCourseIds()
  const unmet = course.prerequisiteIds.filter((id) => !done.has(id))
  // Schedule check: the sessions the student already attends (lectures plus the chosen practical group of each course).
  const others = allSessions.filter(
    (x) =>
      x.courseId !== course.id &&
      enrolledIds.has(x.courseId) &&
      !findCourse(x.courseId)?.archived &&
      (!isGroup(x) || groupChoice[x.courseId] === x.id),
  )
  const clash = lectures
    .flatMap((mine) => others.filter((other) => sessionsOverlap(mine, other)).map((other) => ({ mine, other })))
    .at(0)
  const needsGroup = groups.length > 0 && !selectedGroup && !full
  const blocked = role === 'student' && !enrolled && !waitlisted && (unmet.length > 0 || clash !== undefined || needsGroup)

  // The enroll button and the reasons it may be disabled. It sits in the Practical group panel when the
  // course has groups, and in the header box otherwise.
  const enrollAction = (
    <div className="flex flex-col items-start gap-2">
      <Button disabled={blocked} onClick={() => toggleEnrollment(course.id, selectedGroup || undefined)}>
        {enrolled ? 'Withdraw from course' : waitlisted ? 'Leave waitlist' : full ? 'Join waitlist' : 'Enroll'}
      </Button>
      {!enrolled && !waitlisted && clash && (
        <p className="text-sm" role="alert">
          Schedule clash: {slotLabel(clash.mine)} ({clash.mine.type}) overlaps {getCourse(clash.other.courseId).name}, {slotLabel(clash.other)}.
        </p>
      )}
      {!enrolled && !waitlisted && !clash && needsGroup && unmet.length === 0 && (
        <p className="text-sm">Choose a practical group above to enroll.</p>
      )}
      {blocked && unmet.length > 0 && (
        <p className="text-sm">
          Complete first: {unmet.map((id, i) => (
            <span key={id}>{i > 0 && ', '}<CourseLink courseId={id} /></span>
          ))}
        </p>
      )}
    </div>
  )

  const setArchived = (archived: boolean) => {
    coursesStore.set((prev) => prev.map((c) => (c.id === course.id ? { ...c, archived } : c)))
    setMessage(archived ? 'Course archived. Grades and history are kept.' : 'Course restored to the active list.')
  }

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
            {groups.length > 0 ? (
              <p className="text-sm">{enrolled ? 'Manage your group in the Practical group section.' : 'Pick a group and enroll in the Practical group section.'}</p>
            ) : (
              enrollAction
            )}
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
              <Button variant="secondary" onClick={() => setArchived(!course.archived)}>
                {course.archived ? <ArchiveRestore aria-hidden="true" className="mr-2 size-4" /> : <Archive aria-hidden="true" className="mr-2 size-4" />}
                {course.archived ? 'Restore' : 'Archive'}
              </Button>
            </div>
          </div>
        )}
      </header>
      <p role="status" aria-live="polite" className="mb-6 text-rose empty:hidden">{message}</p>

      {editing && (
        <div className="mb-10">
          <CourseForm
            initial={course}
            onDone={(saved) => {
              setEditing(false)
              if (saved) setMessage('Course details saved.')
            }}
          />
        </div>
      )}

      <Stats course={course} taken={taken} teaches={teaches} />

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className="flex flex-col gap-10 lg:col-span-3">
          {role === 'student' && !course.archived && groups.length > 0 && (
            <StudentGroupPanel
              course={course}
              groups={groups}
              lectures={lectures}
              others={others}
              selected={selectedGroup}
              onSelect={setSelectedGroup}
              enrolled={enrolled}
              current={currentGroup}
              footer={enrollAction}
            />
          )}
          {role === 'student' && <StudentGrades course={course} enrolled={enrolled} />}
          {canManage && !course.archived && groups.length > 0 && <GroupsPanel course={course} groups={groups} />}
          {role === 'instructor' && (teaches ? <TeacherGrades course={course} /> : <NoAccess />)}
          <Panel title="Grading scheme">
            <ul className="divide-y divide-rose">
              {course.gradingScheme.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <span>{c.name}</span>
                  <span className="font-semibold">{c.max} points</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink-soft">
              Completion: {course.completionType.toLowerCase()}. The final score is the sum of all components, 0 to 100.
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
              <dd>{taken} of {course.studentLimit}</dd>
              <dt className="text-ink-soft">Status</dt>
              <dd>{course.archived ? 'Archived, history is kept' : 'Active'}</dd>
            </dl>
          </Panel>

          <Panel title="Prerequisites">
            {course.prerequisiteIds.length === 0 ? (
              <p className="text-ink-soft">No prerequisites.</p>
            ) : (
              <ul className="divide-y divide-rose">
                {course.prerequisiteIds.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="font-semibold"><CourseLink courseId={id} /></span>
                    {role === 'student' && <Badge tone={done.has(id) ? 'solid' : 'outline'}>{done.has(id) ? 'Completed' : 'Not completed'}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <TimetablePanel course={course} sessions={sessions} />

          {!course.archived && (
            <Panel
              title="Exam terms"
              action={
                canManage && !addingExam ? (
                  <Button variant="secondary" onClick={() => setAddingExam(true)}>Add exam term</Button>
                ) : undefined
              }
            >
              {courseExams.length === 0 ? (
                <p className="text-ink-soft">No exam terms published yet.</p>
              ) : (
                <ul className="divide-y divide-rose">
                  {courseExams.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-semibold">{formatWeekdayDate(e.date)} at {e.start}</p>
                        <p className="text-sm text-ink-soft">{e.term}, {e.format.toLowerCase()}, room {e.room}, {e.registered} of {e.capacity} registered</p>
                      </div>
                      {canManage && (
                        <Button
                          variant="secondary"
                          className="min-h-9 px-2"
                          onClick={() => examsStore.set((prev) => prev.filter((x) => x.id !== e.id))}
                          aria-label={`Remove ${e.term} on ${formatWeekdayDate(e.date)}`}
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

          <DocumentsPanel course={course} canUpload={canManage && !course.archived} />
        </div>
      </div>
    </>
  )
}

function Stats({ course, taken, teaches }: { course: Course; taken: number; teaches: boolean }) {
  const { role } = useDemo()
  const grades = useRosterGrades()
  const credits = <StatCard key="cr" label="Credits" value={`${course.credits} ECTS`} hint={course.completionType} icon={BookOpen} />
  if (role === 'student') {
    const s = summaryFor(course, gradeFor(course.id))
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
  const rows = grades[course.id]
  const shares = rows
    ? rows.map((r) => summarize(course.gradingScheme, r)).filter((s) => s.graded > 0).map((s) => percent(s.total, s.graded))
    : []
  const avg = shares.length ? Math.round(shares.reduce((a, b) => a + b, 0) / shares.length) : null
  const visible = role === 'instructor' && teaches && avg !== null
  return (
    <StatGrid>
      {credits}
      <StatCard key="seats" label="Students" value={`${taken}`} hint={`Limit ${course.studentLimit}`} icon={Users} />
      <StatCard key="occ" label="Occupancy" value={`${percent(taken, course.studentLimit)}%`} hint="Of the student limit" icon={Gauge} />
      <StatCard key="avg" label="Average result" value={visible ? `${avg}%` : 'Hidden'} hint={visible ? 'Of points available so far' : 'Grades are visible to course teachers'} icon={Percent} />
    </StatGrid>
  )
}

function StudentGrades({ course, enrolled }: { course: Course; enrolled: boolean }) {
  const grade = gradeFor(course.id)
  const s = summaryFor(course, grade)

  if (!enrolled && !grade) {
    return (
      <Panel title="Your grades">
        <EmptyState title="You are not enrolled in this course">Enroll to see your grades here.</EmptyState>
      </Panel>
    )
  }

  type Row = { name: string; max: number; points: number | null; date?: string }
  const rows: Row[] = course.gradingScheme.map((c, i) => ({ name: c.name, max: c.max, points: grade?.entries[i]?.points ?? null, date: grade?.entries[i]?.date }))

  const columns: Column<Row>[] = [
    { header: 'Component', rowHeader: true, cell: (r) => r.name },
    { header: 'Date', cell: (r) => (r.date ? formatDate(r.date) : course.archived ? '-' : 'Pending') },
    { header: 'Points', cell: (r) => <span className="whitespace-nowrap">{r.points === null ? '-' : r.points} / {r.max}</span> },
    {
      header: 'Score',
      align: 'right',
      cell: (r) =>
        r.points === null ? (
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
      {grade?.finalizedAt && <p className="px-6 pt-3 pb-3 text-sm text-ink-soft">Mark finalized on {formatDate(grade.finalizedAt)}.</p>}
    </Panel>
  )
}

function TeacherGrades({ course }: { course: Course }) {
  const grades = useRosterGrades()
  const sessionsAll = useSessions()
  const [editing, setEditing] = useState(false)
  const rows = grades[course.id]
  if (!rows) {
    return (
      <Panel title="Student grades">
        <EmptyState title="No students yet">Grades appear here once students are enrolled.</EmptyState>
      </Panel>
    )
  }
  const scheme = course.gradingScheme
  const canEdit = !course.archived
  const data = roster.map((s, i) => ({ ...s, index: i, row: rows[i], sum: summarize(scheme, rows[i]) }))
  type Row = (typeof data)[number]

  const columns: Column<Row>[] = [
    {
      header: 'Student',
      rowHeader: true,
      cell: (s) => (
        <>
          {s.name}
          <span className="block text-sm font-normal text-ink-soft">{s.id}</span>
        </>
      ),
    },
    ...(rosterGroups[course.id]
      ? [
          {
            header: 'Group',
            cell: (s: Row) => {
              const g = sessionsAll.find((x) => x.id === rosterGroups[course.id][s.index])
              return g ? groupName(g) : '-'
            },
          } satisfies Column<Row>,
        ]
      : []),
    ...scheme.map<Column<Row>>((c, j) => ({
      header: c.name,
      cell: (s) =>
        editing ? (
          <input
            type="number"
            min={0}
            max={c.max}
            value={s.row[j] ?? ''}
            aria-label={`${s.name}, ${c.name}, out of ${c.max}`}
            onChange={(e) => {
              const raw = e.target.value
              setRosterGrade(course.id, s.index, j, raw === '' ? null : Math.min(c.max, Math.max(0, Math.round(Number(raw)))))
            }}
            className="min-h-10 w-20 rounded-md border-2 border-wine bg-fog px-2 text-wine"
          />
        ) : (
          <span className="whitespace-nowrap">{s.row[j] ?? '-'} / {c.max}</span>
        ),
    })),
    { header: 'Total', cell: (s) => <span className="font-semibold whitespace-nowrap">{s.sum.total}{s.sum.complete ? ' / 100' : ''}</span> },
    {
      header: 'Mark',
      align: 'right',
      cell: (s) =>
        s.sum.mark ? <Badge tone={s.sum.mark === 'FX' ? 'outline' : 'solid'}>{s.sum.mark}</Badge> : <Badge tone="outline">In progress</Badge>,
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
            <Button variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing((v) => !v)}>
              {editing ? 'Done editing' : 'Edit grades'}
            </Button>
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

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

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
              <p className="text-sm text-ink-soft">{s.type}{s.group ? `, group ${s.group}` : ''}, room {s.room}, {teacherName(s.teacherId)}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const MAX_KB = 10 * 1024

function DocumentsPanel({ course, canUpload }: { course: Course; canUpload: boolean }) {
  const docs = useDocuments().filter((d) => d.courseId === course.id)
  const [kind, setKind] = useState<'Syllabus' | 'Material'>('Material')
  const [error, setError] = useState('')

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) return setError('Only PDF files can be added.')
    const kb = Math.max(1, Math.round(file.size / 1024))
    if (kb > MAX_KB) return setError('The file is larger than 10 MB.')
    setError('')
    documentsStore.set((prev) => [
      ...prev,
      { id: `d-${Date.now()}`, courseId: course.id, name: file.name, kind, sizeKb: kb, uploadedAt: DEMO_TODAY, url: URL.createObjectURL(file) },
    ])
  }

  const remove = (id: string) => {
    const doc = docs.find((d) => d.id === id)
    if (doc?.url) URL.revokeObjectURL(doc.url)
    documentsStore.set((prev) => prev.filter((d) => d.id !== id))
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
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer" className="truncate underline underline-offset-4">{d.name}</a>
                  ) : (
                    <span className="truncate">{d.name}</span>
                  )}
                </p>
                <p className="text-sm text-ink-soft">
                  {d.kind}, {d.sizeKb} KB, {formatDate(d.uploadedAt)}{d.url ? '' : ', demo file'}
                </p>
              </div>
              {canUpload && (
                <Button variant="secondary" className="min-h-9 px-2" onClick={() => remove(d.id)} aria-label={`Remove ${d.name}`}>
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
              onChange={onFile}
              className={`${fieldClass} py-1.5 file:mr-3 file:rounded file:border-0 file:bg-wine file:px-3 file:py-1 file:font-semibold file:text-blush`}
            />
            <p className="mt-1 text-sm text-ink-soft">PDF only, up to 10 MB. Files stay in your browser; nothing is uploaded.</p>
          </div>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      )}
    </Panel>
  )
}

function StudentGroupPanel({
  course,
  groups,
  lectures,
  others,
  selected,
  onSelect,
  enrolled,
  current,
  footer,
}: {
  course: Course
  groups: ClassSession[]
  lectures: ClassSession[]
  others: ClassSession[]
  selected: string
  onSelect: (id: string) => void
  enrolled: boolean
  current: string | undefined
  footer: React.ReactNode
}) {
  const { groupTaken, chooseGroup } = useDemo()
  const [message, setMessage] = useState('')

  return (
    <Panel title="Practical group">
      <fieldset>
        <legend className="mb-3 text-ink-soft">
          {enrolled ? 'You can move to another group while seats are free.' : 'Choose the practical group you will attend. Lectures are shared by everyone.'}
        </legend>
        <ul className="flex flex-col gap-3">
          {groups.map((g) => {
            const taken = groupTaken(g)
            const cap = g.capacity ?? Infinity
            const full = taken >= cap && g.id !== current
            const clashWith = [...others, ...lectures].find((o) => sessionsOverlap(g, o))
            const disabled = full || clashWith !== undefined
            const checked = selected === g.id
            return (
              <li key={g.id}>
                <label
                  className={`flex gap-3 rounded-md border-2 p-3 ${checked ? 'border-wine bg-fog' : 'border-rose'} ${disabled ? 'opacity-70' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name={`group-${course.id}`}
                    className="mt-1 size-5 shrink-0 accent-wine"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onSelect(g.id)}
                  />
                  <span className="block">
                    <span className="block font-semibold">
                      {groupName(g)}: {slotLabel(g)}
                    </span>
                    <span className="block text-sm">
                      {g.type}, room {g.room}
                    </span>
                    <span className="block text-sm">Led by {teacherName(g.teacherId)}</span>
                    <span className="block text-sm text-ink-soft">
                      {full ? 'Full' : cap === Infinity ? `${taken} students` : `${cap - taken} of ${cap} seats left`}
                      {g.id === current ? ', your group' : ''}
                    </span>
                    {clashWith && (
                      <span className="block text-sm font-semibold">
                        Overlaps {getCourse(clashWith.courseId).name}, {slotLabel(clashWith)}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-start gap-3 border-t border-rose pt-5">
        {enrolled && (
          <Button
            variant="secondary"
            disabled={!selected || selected === current}
            onClick={() => {
              chooseGroup(course.id, selected)
              setMessage(`Moved to ${groupName(groups.find((g) => g.id === selected)!)}.`)
            }}
          >
            Change group
          </Button>
        )}
        {footer}
      </div>
      <p role="status" aria-live="polite" className="mt-3 font-semibold empty:hidden">{message}</p>
    </Panel>
  )
}

function GroupsPanel({ course, groups }: { course: Course; groups: ClassSession[] }) {
  const { role, groupTaken, addNotice } = useDemo()
  const [notifying, setNotifying] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState('')

  const canNotify = (g: ClassSession) => role === 'admin' || (role === 'instructor' && g.teacherId === INSTRUCTOR_ID)
  const members = (g: ClassSession) => roster.filter((_, i) => rosterGroups[course.id]?.[i] === g.id)

  const send = (e: React.FormEvent, g: ClassSession) => {
    e.preventDefault()
    addNotice({ title: title.trim(), body: body.trim(), scope: 'group', courseId: course.id, sessionId: g.id })
    setSent(`Notice sent to ${groupTaken(g)} students in ${groupName(g)}.`)
    setNotifying(null)
    setTitle('')
    setBody('')
  }

  return (
    <Panel title="Practical groups">
      <ul className="flex flex-col gap-5">
        {groups.map((g) => {
          const taken = groupTaken(g)
          const list = members(g)
          return (
            <li key={g.id} className="rounded-md border-2 border-rose p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {groupName(g)}: {slotLabel(g)}
                  </p>
                  <p className="text-sm">
                    {g.type}, room {g.room}, led by {teacherName(g.teacherId)}
                  </p>
                </div>
                {canNotify(g) && notifying !== g.id && (
                  <Button variant="secondary" onClick={() => { setNotifying(g.id); setSent('') }} aria-label={`Notify ${groupName(g)}`}>
                    <Send aria-hidden="true" className="mr-2 size-4" />
                    Notify group
                  </Button>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3 text-sm">
                <div className="w-32">
                  <ProgressBar value={taken} max={g.capacity ?? taken} label={`${groupName(g)} seats`} />
                </div>
                <span>{taken} of {g.capacity ?? taken} students</span>
              </div>
              {list.length > 0 && (
                <p className="mt-2 text-sm text-ink-soft">
                  Includes {list.map((m) => m.name).join(', ')}
                  {taken > list.length ? ` and ${taken - list.length} more` : ''}.
                </p>
              )}
              {notifying === g.id && (
                <form onSubmit={(e) => send(e, g)} className="mt-4 flex flex-col gap-3 border-t border-rose pt-4">
                  <TextField label={`Title for ${groupName(g)}`} value={title} onChange={setTitle} required />
                  <TextAreaField label="Message" value={body} onChange={setBody} rows={3} />
                  <p className="text-sm text-ink-soft">Only the {taken} students in this group will receive it.</p>
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={!title.trim() || !body.trim()}>Send to {groupName(g)}</Button>
                    <Button variant="secondary" onClick={() => setNotifying(null)}>Cancel</Button>
                  </div>
                </form>
              )}
            </li>
          )
        })}
      </ul>
      <p role="status" aria-live="polite" className="mt-4 font-semibold empty:hidden">{sent}</p>
    </Panel>
  )
}
