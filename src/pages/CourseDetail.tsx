import { ArrowLeft, Award, BookOpen, CheckCircle2, Gauge, Hourglass, Percent, Users } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { EmptyState } from '../components/ui/EmptyState'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { StatCard, StatGrid } from '../components/ui/StatCard'
import { exams, INSTRUCTOR_ID, orgUnits, roster, rosterGrades, sessions } from '../data/demo'
import { findCourse, teacherName, teacherNames } from '../data/selectors'
import type { Course, Mark } from '../data/types'
import { gradeFor, padRow, SCALE, summarize, summaryFor } from '../lib/grades'
import { formatDate, formatWeekdayDate, percent } from '../lib/format'
import { hrefFor } from '../lib/router'
import { useDemo } from '../state/DemoContext'

export function CourseDetailPage({ courseId }: { courseId: string }) {
  const course = findCourse(courseId)
  if (!course) {
    return (
      <>
        <BackLink />
        <Panel title="Course not found">
          <EmptyState title="There is no course with this address">
            Go back to the course list and pick one from there.
          </EmptyState>
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
  const { role, enrolledIds, waitlistIds, seatsTaken, toggleEnrollment } = useDemo()
  const taken = seatsTaken(course)
  const full = taken >= course.studentLimit
  const enrolled = enrolledIds.has(course.id)
  const waitlisted = waitlistIds.has(course.id)
  const teaches = role === 'instructor' && course.teacherIds.includes(INSTRUCTOR_ID)
  const unit = orgUnits.find((u) => u.id === course.orgUnitId)

  const courseSessions = sessions.filter((s) => s.courseId === course.id)
  const courseExams = exams.filter((e) => e.courseId === course.id)

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
          <div className="flex flex-col items-start gap-2 rounded-md bg-blush p-4 text-wine">
            <p className="font-semibold">
              {enrolled ? 'You are enrolled' : waitlisted ? 'You are on the waitlist' : full ? 'No seats left' : `${course.studentLimit - taken} seats left`}
            </p>
            <Button onClick={() => toggleEnrollment(course.id)}>
              {enrolled ? 'Withdraw from course' : waitlisted ? 'Leave waitlist' : full ? 'Join waitlist' : 'Enroll'}
            </Button>
          </div>
        )}
      </header>

      <Stats course={course} taken={taken} teaches={teaches} />

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className="flex flex-col gap-10 lg:col-span-3">
          {role === 'student' && <StudentGrades course={course} enrolled={enrolled} />}
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
            <ul className="grid list-disc gap-x-8 gap-y-1.5 pl-5 sm:grid-cols-2">
              {course.topics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="flex flex-col gap-10 lg:col-span-2">
          <Panel title="Course details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
              <dt className="text-ink-soft">Department</dt>
              <dd>{unit ? `${unit.name} (${unit.code})` : '-'}</dd>
              <dt className="text-ink-soft">Year</dt>
              <dd>
                {course.academicYear}, {course.semester.toLowerCase()} semester
              </dd>
              <dt className="text-ink-soft">Guarantor</dt>
              <dd className="font-semibold">{teacherName(course.guarantorId)}</dd>
              <dt className="text-ink-soft">Teachers</dt>
              <dd>{teacherNames(course).join(', ')}</dd>
              <dt className="text-ink-soft">Student limit</dt>
              <dd>
                {taken} of {course.studentLimit}
              </dd>
              <dt className="text-ink-soft">Status</dt>
              <dd>{course.archived ? 'Archived, history is kept' : 'Active'}</dd>
            </dl>
          </Panel>

          <Panel title="Timetable">
            {course.archived ? (
              <p className="text-ink-soft">Archived courses no longer have a live timetable.</p>
            ) : courseSessions.length === 0 ? (
              <p className="text-ink-soft">No timetable entries yet.</p>
            ) : (
              <ul className="divide-y divide-rose">
                {courseSessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                    <span className="font-semibold">
                      {s.day} {s.start}-{s.end}
                    </span>
                    <span className="text-sm text-ink-soft">
                      {s.type}, room {s.room}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {!course.archived && (
            <Panel title="Exam terms">
              {courseExams.length === 0 ? (
                <p className="text-ink-soft">No exam terms published yet.</p>
              ) : (
                <ul className="divide-y divide-rose">
                  {courseExams.map((e) => (
                    <li key={e.id} className="py-2.5 first:pt-0 last:pb-0">
                      <p className="font-semibold">{formatWeekdayDate(e.date)} at {e.start}</p>
                      <p className="text-sm text-ink-soft">
                        {e.term}, {e.format.toLowerCase()}, room {e.room}, {e.registered} of {e.capacity} registered
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}

function Stats({ course, taken, teaches }: { course: Course; taken: number; teaches: boolean }) {
  const { role } = useDemo()
  const common = [
    <StatCard key="cr" label="Credits" value={`${course.credits} ECTS`} hint={course.completionType} icon={BookOpen} />,
  ]
  if (role === 'student') {
    const s = summaryFor(course, gradeFor(course.id))
    return (
      <StatGrid>
        {common}
        <StatCard
          key="score"
          label={s.complete ? 'Final score' : 'Points so far'}
          value={String(s.total)}
          hint={s.complete ? `Mark ${s.mark}, out of 100` : `Of ${s.graded} graded so far, 100 in total`}
          icon={Award}
        />
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
  const rows = rosterGrades[course.id]
  const avg = rows
    ? Math.round(
        rows.reduce((sum, r) => {
          const s = summarize(course.gradingScheme, padRow(r, course.gradingScheme.length))
          return sum + percent(s.total, s.graded)
        }, 0) / rows.length,
      )
    : null
  return (
    <StatGrid>
      {common}
      <StatCard key="seats" label="Students" value={`${taken}`} hint={`Limit ${course.studentLimit}`} icon={Users} />
      <StatCard key="occ" label="Occupancy" value={`${percent(taken, course.studentLimit)}%`} hint="Of the student limit" icon={Gauge} />
      <StatCard
        key="avg"
        label="Average result"
        value={role === 'admin' || !teaches || avg === null ? 'Hidden' : `${avg}%`}
        hint={role === 'admin' || !teaches ? 'Grades are visible to course teachers' : 'Of points available so far'}
        icon={Percent}
      />
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
  const rows: Row[] = course.gradingScheme.map((c, i) => ({
    name: c.name,
    max: c.max,
    points: grade?.entries[i]?.points ?? null,
    date: grade?.entries[i]?.date,
  }))

  const columns: Column<Row>[] = [
    { header: 'Component', rowHeader: true, cell: (r) => r.name },
    { header: 'Date', cell: (r) => (r.date ? formatDate(r.date) : course.archived ? '-' : 'Pending') },
    {
      header: 'Points',
      cell: (r) => (
        <span className="whitespace-nowrap">
          {r.points === null ? '-' : r.points} / {r.max}
        </span>
      ),
    },
    {
      header: 'Score',
      align: 'right',
      cell: (r) =>
        r.points === null ? (
          <Badge tone="outline">Not graded</Badge>
        ) : (
          <div className="ml-auto flex items-center gap-3">
            <div className="w-24">
              <ProgressBar value={r.points} max={r.max} label={`${r.name} score`} />
            </div>
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
      {grade?.finalizedAt && (
        <p className="px-6 pt-3 pb-3 text-sm text-ink-soft">Mark finalized on {formatDate(grade.finalizedAt)}.</p>
      )}
    </Panel>
  )
}

function TeacherGrades({ course }: { course: Course }) {
  const rows = rosterGrades[course.id]
  if (!rows) {
    return (
      <Panel title="Student grades">
        <EmptyState title="No grades recorded yet" />
      </Panel>
    )
  }
  const scheme = course.gradingScheme
  const k = rows[0].length
  const gradedComponents = scheme.slice(0, k)
  const data = roster.map((s, i) => ({ ...s, row: rows[i], sum: summarize(scheme, padRow(rows[i], scheme.length)) }))
  const complete = data[0].sum.complete

  const columns: Column<(typeof data)[number]>[] = [
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
    ...gradedComponents.map<Column<(typeof data)[number]>>((c, i) => ({
      header: c.name,
      cell: (s) => (
        <span className="whitespace-nowrap">
          {s.row[i]} / {c.max}
        </span>
      ),
    })),
    {
      header: complete ? 'Final score' : 'Total so far',
      cell: (s) => <span className="font-semibold whitespace-nowrap">{s.sum.total} / {complete ? 100 : s.sum.graded}</span>,
    },
    {
      header: complete ? 'Mark' : 'Progress',
      align: 'right',
      cell: (s) =>
        complete && s.sum.mark ? (
          <Badge tone={s.sum.mark === 'FX' ? 'outline' : 'solid'}>{s.sum.mark}</Badge>
        ) : (
          <div className="ml-auto w-24">
            <ProgressBar value={s.sum.total} max={s.sum.graded} label={`${s.name} progress`} />
          </div>
        ),
    },
  ]

  // Distribution: final marks when complete, otherwise bands of the share of points collected so far.
  const dist: { label: string; count: number }[] = complete
    ? SCALE.map((sc) => ({ label: `${sc.mark}, ${sc.name}`, count: data.filter((d) => d.sum.mark === (sc.mark as Mark)).length }))
    : [
        { label: '90% or more', count: data.filter((d) => percent(d.sum.total, d.sum.graded) >= 90).length },
        { label: '75 to 89%', count: data.filter((d) => { const p = percent(d.sum.total, d.sum.graded); return p >= 75 && p < 90 }).length },
        { label: '50 to 74%', count: data.filter((d) => { const p = percent(d.sum.total, d.sum.graded); return p >= 50 && p < 75 }).length },
        { label: 'Below 50%', count: data.filter((d) => percent(d.sum.total, d.sum.graded) < 50).length },
      ]

  return (
    <>
      <Panel title="Student grades" flush>
        <DataTable caption={`Grades of students in ${course.name}`} columns={columns} rows={data} getKey={(s) => s.id} />
        <p className="px-6 pt-3 pb-3 text-sm text-ink-soft">
          Showing {data.length} of {course.enrolled} students.
        </p>
      </Panel>
      <Panel title={complete ? 'Mark distribution' : 'Results so far'}>
        <ul className="flex flex-col gap-3">
          {dist.map((d) => (
            <li key={d.label} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-3">
              <span>{d.label}</span>
              <ProgressBar value={d.count} max={data.length} label={`${d.label}: ${d.count} students`} />
              <span className="text-right font-semibold">{d.count}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-soft">Based on the {data.length} students shown above.</p>
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
