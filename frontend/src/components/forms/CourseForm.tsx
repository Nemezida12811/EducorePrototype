import { useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { CheckboxGroup, SelectField, TextAreaField, TextField } from '../ui/Field'
import { Panel } from '../ui/Panel'
import { buildScheme, GradingBuilder, rowsFromScheme, rowsFromTemplate } from './GradingBuilder'
import { errorMessage, isNewDraft, saveCourse, type SessionDraft } from '../../data/actions'
import { useAllSessions, useCourses, useOrgUnits, useTeachers } from '../../data/stores'
import type { CompletionType, CourseDetailData, Day, SessionType, Term } from '../../data/types'
import { sameRoom, sessionsOverlap, slotLabel } from '../../lib/conflicts'
import { currentTerm } from '../../lib/clock'
import { teacherName } from '../../data/selectors'
import { useApp } from '../../state/AppContext'

const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TYPES: SessionType[] = ['Lecture', 'Practical', 'Lab', 'Seminar']
const COMPLETIONS: CompletionType[] = ['Exam', 'Credit', 'Classified credit']

interface CourseFormProps {
  /** Present when editing; absent when creating. */
  initial?: CourseDetailData
  /** Called with the id of the saved course (undefined when cancelled). */
  onDone: (savedId?: string) => void
}

export function CourseForm({ initial, onDone }: CourseFormProps) {
  const { role, user } = useApp()
  const units = useOrgUnits()
  const teachers = useTeachers()
  const all = useCourses()
  const allSessions = useAllSessions()
  const term = currentTerm()

  const defaultTeacher = role === 'instructor' ? user.id : (teachers[0]?.id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [credits, setCredits] = useState(String(initial?.credits ?? 5))
  const [limit, setLimit] = useState(String(initial?.studentLimit ?? 40))
  const [unit, setUnit] = useState(initial?.orgUnitId ?? units[0]?.id ?? '')
  const [guarantor, setGuarantor] = useState(initial?.guarantorId ?? defaultTeacher)
  const [teacherIds, setTeacherIds] = useState<string[]>(initial?.teacherIds ?? (defaultTeacher ? [defaultTeacher] : []))
  const [prereqs, setPrereqs] = useState<string[]>(initial?.prerequisites.map((p) => p.id) ?? [])
  const [description, setDescription] = useState(initial?.description ?? '')
  const [topics, setTopics] = useState((initial?.topics ?? []).join('\n'))
  const [year, setYear] = useState(initial?.academicYear ?? term.academicYear)
  const [semester, setSemester] = useState<Term>(initial?.semester ?? term.term)
  const [completion, setCompletion] = useState<CompletionType>(initial?.completionType ?? 'Exam')
  const [schemeRows, setSchemeRows] = useState(() => (initial ? rowsFromScheme(initial.gradingScheme) : rowsFromTemplate('standard')))
  const built = useMemo(() => buildScheme(schemeRows), [schemeRows])
  const [drafts, setDrafts] = useState<SessionDraft[]>(() => (initial?.sessions ?? []).map(({ courseId: _c, ...rest }) => rest))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sessionTeachers = Array.from(new Set([guarantor, ...teacherIds].filter(Boolean)))
  const updateDraft = (id: string, patch: Partial<SessionDraft>) => setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  const teacherFor = (d: SessionDraft) => (d.teacherId && sessionTeachers.includes(d.teacherId) ? d.teacherId : guarantor)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const creditsN = Number(credits)
    const limitN = Number(limit)
    const trimmedCode = code.trim()
    if (!name.trim() || !trimmedCode) return setError('Name and code are required.')
    if (!guarantor) return setError('Choose a guarantor. Ask an administrator to create a teacher account first if none is listed.')
    if (!Number.isInteger(creditsN) || creditsN < 1 || creditsN > 30) return setError('Credits must be a whole number from 1 to 30.')
    if (!Number.isInteger(limitN) || limitN < 1 || limitN > 500) return setError('Capacity must be a whole number from 1 to 500.')
    if (!initial?.archived && built.error) return setError(`Grading scheme: ${built.error}`)
    if (!/^\d{4}\/\d{4}$/.test(year.trim())) return setError('The academic year must look like 2026/2027.')
    if (all.some((c) => c.code.toLowerCase() === trimmedCode.toLowerCase() && c.id !== initial?.id)) {
      return setError('Another course already uses this code.')
    }
    const teachersFinal = Array.from(new Set([guarantor, ...teacherIds]))
    for (const [i, d] of drafts.entries()) {
      if (!d.room.trim()) return setError(`Session ${i + 1}: enter a room.`)
      if (d.end <= d.start) return setError(`Session ${i + 1}: the end time must be after the start time.`)
    }
    // Schedule check: a teacher or a room cannot be in two places at once (the server checks again).
    const others = allSessions.filter((x) => x.courseId !== initial?.id)
    for (const [i, d] of drafts.entries()) {
      const teacher = teacherFor(d)
      for (const [j, o] of drafts.entries()) {
        if (j <= i || !sessionsOverlap(d, o)) continue
        if (teacher === teacherFor(o)) return setError(`Sessions ${i + 1} and ${j + 1} overlap and have the same teacher (${teacherName(teacher)}).`)
        if (sameRoom(d.room, o.room)) return setError(`Sessions ${i + 1} and ${j + 1} overlap in room ${d.room.trim()}.`)
      }
      for (const o of others) {
        if (!sessionsOverlap(d, o)) continue
        const label = `${all.find((c) => c.id === o.courseId)?.code ?? 'another course'} on ${slotLabel(o)}`
        if (o.teacherId === teacher) return setError(`Session ${i + 1}: ${teacherName(teacher)} already teaches ${label}.`)
        if (sameRoom(o.room, d.room)) return setError(`Session ${i + 1}: room ${d.room.trim()} is already booked by ${label}.`)
      }
    }

    setBusy(true)
    setError('')
    try {
      const { id, problems } = await saveCourse(
        initial?.id ?? null,
        {
          code: trimmedCode,
          name: name.trim(),
          description: description.trim(),
          departmentId: unit || null,
          guarantorId: guarantor,
          academicYear: year.trim(),
          semester,
          credits: creditsN,
          capacity: limitN,
          completion,
          syllabus: topics.split('\n').map((t) => t.trim()).filter(Boolean),
          teacherIds: teachersFinal,
          prerequisiteIds: prereqs.filter((p) => p !== initial?.id),
          // Editing: only send the scheme when it changed, because the API locks it once grades exist.
          gradingScheme: initial && (initial.archived || JSON.stringify(initial.gradingScheme) === JSON.stringify(built.scheme)) ? undefined : built.scheme,
        },
        drafts,
        (initial?.sessions ?? []).map((x) => x.id),
        !initial?.archived,
      )
      if (problems.length > 0) {
        setError(`The course was saved, but not everything in the timetable: ${problems.join(' ')}`)
        setBusy(false)
        return
      }
      onDone(id)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const teacherOptions = teachers.map((t) => ({ value: t.id, label: t.name }))

  return (
    <Panel title={initial ? 'Edit course' : 'New course'}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} required />
        <TextField label="Code" value={code} onChange={setCode} hint="For example KPI/XYZ" required />
        <TextField label="Credits (ECTS)" type="number" min={1} max={30} value={credits} onChange={setCredits} />
        <TextField label="Student capacity" type="number" min={1} max={500} value={limit} onChange={setLimit} />
        <TextField label="Academic year" value={year} onChange={setYear} hint="For example 2026/2027" />
        <SelectField label="Semester" value={semester} onChange={(v) => setSemester(v as Term)} options={[{ value: 'Winter', label: 'Winter' }, { value: 'Summer', label: 'Summer' }]} />
        <SelectField label="Department" value={unit} onChange={setUnit} options={units.map((u) => ({ value: u.id, label: `${u.code}, ${u.name}` }))} />
        <SelectField label="Completion" value={completion} onChange={(v) => setCompletion(v as CompletionType)} options={COMPLETIONS.map((c) => ({ value: c, label: c }))} />
        <SelectField label="Guarantor" value={guarantor} onChange={setGuarantor} options={teacherOptions} />
        <div className="md:col-span-2">
          <CheckboxGroup legend="Teachers (the guarantor is always included)" options={teacherOptions} selected={teacherIds} onChange={setTeacherIds} />
        </div>
        <div className="md:col-span-2">
          <TextAreaField label="Description" value={description} onChange={setDescription} rows={3} />
        </div>
        <div className="md:col-span-2">
          <TextAreaField label="Syllabus topics" hint="One topic per line." value={topics} onChange={setTopics} rows={5} />
        </div>
        <div className="md:col-span-2">
          <CheckboxGroup
            legend="Prerequisites"
            options={all.filter((c) => c.id !== initial?.id).map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))}
            selected={prereqs}
            onChange={setPrereqs}
          />
        </div>
        {!initial?.archived && (
          <div className="md:col-span-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-medium">Timetable</h3>
              <Button
                variant="secondary"
                onClick={() => setDrafts((prev) => [...prev, { id: `new-${Date.now()}`, day: 'Mon', start: '08:00', end: '09:40', type: 'Lecture', room: '', teacherId: guarantor || null }])}
              >
                Add session
              </Button>
            </div>
            {drafts.length === 0 ? (
              <p className="text-ink-soft">No sessions yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {drafts.map((d, i) => (
                  <fieldset key={d.id} className="grid gap-3 rounded-md border-2 border-rose p-4 sm:grid-cols-3">
                    <legend className="px-1 font-semibold">Session {i + 1}{isNewDraft(d) ? ' (new)' : ''}</legend>
                    <SelectField label="Type" value={d.type} onChange={(v) => updateDraft(d.id, { type: v as SessionType })} options={TYPES.map((t) => ({ value: t, label: t }))} />
                    <SelectField label="Day" value={d.day} onChange={(v) => updateDraft(d.id, { day: v as Day })} options={DAYS.map((x) => ({ value: x, label: x }))} />
                    <SelectField
                      label="Teacher"
                      value={teacherFor(d)}
                      onChange={(v) => updateDraft(d.id, { teacherId: v })}
                      options={teacherOptions.filter((o) => sessionTeachers.includes(o.value))}
                    />
                    <TextField label="Start" type="time" value={d.start} onChange={(v) => updateDraft(d.id, { start: v })} />
                    <TextField label="End" type="time" value={d.end} onChange={(v) => updateDraft(d.id, { end: v })} />
                    <TextField label="Room" value={d.room} onChange={(v) => updateDraft(d.id, { room: v })} />
                    <div className="sm:col-span-3">
                      <Button variant="secondary" onClick={() => setDrafts((prev) => prev.filter((x) => x.id !== d.id))}>
                        Remove session {i + 1}
                      </Button>
                    </div>
                  </fieldset>
                ))}
              </div>
            )}
          </div>
        )}
        {!initial?.archived ? (
          <div className="md:col-span-2">
            <GradingBuilder rows={schemeRows} onChange={setSchemeRows} built={built} editing={!!initial} />
          </div>
        ) : (
          <p className="text-ink-soft md:col-span-2">The grading scheme of an archived course is read-only.</p>
        )}
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit" disabled={busy}>{initial ? 'Save changes' : 'Create course'}</Button>
          <Button variant="secondary" onClick={() => onDone()}>Cancel</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}
