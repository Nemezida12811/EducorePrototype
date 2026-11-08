import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { CheckboxGroup, SelectField, TextAreaField, TextField } from '../ui/Field'
import { Panel } from '../ui/Panel'
import { buildScheme, GradingBuilder, rowsFromScheme, rowsFromTemplate } from './GradingBuilder'
import { PrerequisitePicker } from './PrerequisitePicker'
import { errorMessage, isNewDraft, saveCourse, type SessionDraft } from '../../data/actions'
import { useAllSessions, useCourses, useOrgUnits, useRooms, useTeachers } from '../../data/stores'
import type { CompletionType, CourseDetailData, Day, SessionType, Term } from '../../data/types'
import { sameRoom, sameTerm, sessionsOverlap, slotLabel } from '../../lib/conflicts'
import { bestRoom, KIND_LABEL, roomOptions } from '../../lib/rooms'
import { fieldClass } from '../ui/Field'
import { currentTerm } from '../../lib/clock'
import { teacherName } from '../../data/selectors'
import { useApp } from '../../state/AppContext'

const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TYPES: SessionType[] = ['Lecture', 'Practical', 'Lab', 'Seminar']
const COMPLETIONS: CompletionType[] = ['Exam', 'Credit', 'Classified credit']

interface CourseFormProps {
  /** Present when editing; absent when creating. */
  initial?: CourseDetailData
  /** A course to copy from: syllabus, grading scheme, prerequisites, teachers and timetable are taken over, the code is not. */
  template?: CourseDetailData
  /** Called with the id of the saved course (undefined when cancelled). */
  onDone: (savedId?: string) => void
}

export function CourseForm({ initial, template, onDone }: CourseFormProps) {
  const src = initial ?? template
  const { role, user } = useApp()
  const units = useOrgUnits()
  const teachers = useTeachers()
  const all = useCourses()
  const allSessions = useAllSessions()
  const rooms = useRooms()
  const term = currentTerm()

  const defaultTeacher = role === 'instructor' ? user.id : (teachers[0]?.id ?? '')
  const [name, setName] = useState(src?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [credits, setCredits] = useState(String(src?.credits ?? 5))
  const [limit, setLimit] = useState(String(src?.studentLimit ?? 40))
  const [groups, setGroups] = useState(String(src?.groupCount ?? 1))
  const [unit, setUnit] = useState(src?.orgUnitId ?? units[0]?.id ?? '')
  const [guarantor, setGuarantor] = useState(src?.guarantorId ?? defaultTeacher)
  const [teacherIds, setTeacherIds] = useState<string[]>(() => Array.from(new Set([...(role === 'instructor' ? [user.id] : []), ...(src?.teacherIds ?? (defaultTeacher ? [defaultTeacher] : []))])))
  const [prereqs, setPrereqs] = useState<string[]>(src?.prerequisites.map((p) => p.id) ?? [])
  const [description, setDescription] = useState(src?.description ?? '')
  const [topics, setTopics] = useState((src?.topics ?? []).join('\n'))
  const [year, setYear] = useState(initial?.academicYear ?? term.academicYear)
  const [semester, setSemester] = useState<Term>(initial?.semester ?? term.term)
  const [completion, setCompletion] = useState<CompletionType>(src?.completionType ?? 'Exam')
  const [schemeRows, setSchemeRows] = useState(() => (src ? rowsFromScheme(src.gradingScheme) : rowsFromTemplate('standard')))
  const built = useMemo(() => buildScheme(schemeRows), [schemeRows])
  const [drafts, setDrafts] = useState<SessionDraft[]>(() => (src?.sessions ?? []).map(({ courseId: _c, ...rest }, i) => (template && !initial ? { ...rest, id: `new-copy-${i}` } : rest)))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sessionTeachers = Array.from(new Set([guarantor, ...teacherIds].filter(Boolean)))
  const updateDraft = (id: string, patch: Partial<SessionDraft>) => setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  const teacherFor = (d: SessionDraft) => (d.teacherId && sessionTeachers.includes(d.teacherId) ? d.teacherId : guarantor)

  const limitNow = Number(limit)
  const unitId = unit || null
  /** Everything a timetable row needs to offer rooms: other courses' sessions and the other rows of this form. */
  const takenFor = (draft: SessionDraft) => [
    ...allSessions.filter((x) => x.courseId !== initial?.id && sameTerm(x, { semester })).map((x) => ({ ...x, label: `${all.find((c) => c.id === x.courseId)?.code ?? 'another course'}` })),
    ...drafts.filter((x) => x.id !== draft.id).map((x) => ({ ...x, courseId: initial?.id ?? 'new', label: 'another session of this course' })),
  ]
  const groupsNow = Math.max(1, Number.isInteger(Number(groups)) ? Number(groups) : 1)
  /** Seats a session needs: the students enrolled now (or the planned limit while nobody has enrolled), split by group for group sessions. */
  const enrolledNow = initial?.enrolled ?? 0
  const baseSeats = enrolledNow > 0 ? enrolledNow : Number.isFinite(limitNow) ? limitNow : 0
  const neededFor = (d: SessionDraft) => (d.group ? Math.ceil(baseSeats / groupsNow) : baseSeats)
  const optionsFor = (d: SessionDraft) =>
    roomOptions({ rooms, departmentId: unitId, taken: takenFor(d), slot: { day: d.day, start: d.start, end: d.end }, semester, type: d.type, needed: neededFor(d) })

  const save = async (status: 'draft' | 'published') => {
    const creditsN = Number(credits)
    const limitN = Number(limit)
    const trimmedCode = code.trim()
    if (!name.trim() || !trimmedCode) return setError('Name and code are required.')
    if (!guarantor) return setError('Choose a guarantor. Ask an administrator to create a teacher account first if none is listed.')
    if (!Number.isInteger(creditsN) || creditsN < 1 || creditsN > 30) return setError('Credits must be a whole number from 1 to 30.')
    if (!Number.isInteger(limitN) || limitN < 1 || limitN > 500) return setError('Capacity must be a whole number from 1 to 500.')
    const groupsN = Number(groups)
    if (!Number.isInteger(groupsN) || groupsN < 1 || groupsN > 10) return setError('The number of groups must be a whole number from 1 to 10.')
    const badGroup = drafts.findIndex((d) => d.group !== null && d.group > groupsN)
    if (badGroup >= 0) return setError(`Session ${badGroup + 1} belongs to group ${drafts[badGroup]!.group}, but the course has only ${groupsN} group(s).`)
    if (!initial?.archived && built.error) return setError(`Grading scheme: ${built.error}`)
    if (!/^\d{4}\/\d{4}$/.test(year.trim())) return setError('The academic year must look like 2026/2027.')
    if (all.some((c) => c.code.toLowerCase() === trimmedCode.toLowerCase() && c.id !== initial?.id)) {
      return setError('Another course already uses this code.')
    }
    const teachersFinal = Array.from(new Set([guarantor, ...teacherIds]))
    for (const [i, d] of drafts.entries()) {
      if (!d.room.trim()) return setError(`Session ${i + 1}: choose a room.`)
      if (!rooms.some((r) => r.active && r.code.toLowerCase() === d.room.trim().toLowerCase() && (!unitId || r.departmentIds.includes(unitId)))) {
        return setError(`Session ${i + 1}: room ${d.room.trim()} is not available to this department. Choose one from the list.`)
      }
      if (d.end <= d.start) return setError(`Session ${i + 1}: the end time must be after the start time.`)
    }
    if (status === 'published' && !initial?.archived && drafts.length === 0) {
      return setError('A published course needs at least one timetable entry. Save it as a draft if the timetable is not ready yet.')
    }
    // Schedule check: a teacher or a room cannot be in two places at once (the server checks again).
    const others = allSessions.filter((x) => x.courseId !== initial?.id && sameTerm(x, { semester }))
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
          status,
          groupCount: groupsN,
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

  // A copied timetable keeps the old rooms, which are usually taken by the original course: swap those for free rooms once.
  const [copyNote, setCopyNote] = useState('')
  useEffect(() => {
    if (!template || initial) return
    let changed = 0
    const next = drafts.map((d) => {
      const opts = optionsFor(d)
      const cur = opts.find((o) => o.room.code.toLowerCase() === d.room.toLowerCase())
      if (cur && cur.fit !== 'busy') return d
      const b = bestRoom(opts)
      if (!b) return d
      changed += 1
      return { ...d, room: b.room.code }
    })
    if (changed) {
      setDrafts(next)
      setCopyNote(`${changed} ${changed === 1 ? 'room was' : 'rooms were'} occupied or unavailable, so a free room was chosen instead. If you copy a course of the same semester, also change the times: the original still uses its slots.`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isDraft = !initial || initial.status === 'draft'
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void save('published')
  }

  /** Room select for one timetable row: free rooms that fit first, then too-small ones, occupied ones last and disabled. */
  const roomField = (d: SessionDraft) => {
    const opts = optionsFor(d)
    const chosen = rooms.find((r) => r.code.toLowerCase() === d.room.toLowerCase())
    const chosenOpt = opts.find((o) => o.room.code.toLowerCase() === d.room.toLowerCase())
    const id = `room-${d.id}`
    const warnings: string[] = []
    if (d.room && !chosenOpt) warnings.push(`Room ${d.room} is not available to this department. Choose another room.`)
    if (chosenOpt?.fit === 'busy') warnings.push(`Room ${chosenOpt.room.code} is occupied at this time by ${chosenOpt.busyWith}. Choose another room or time.`)
    if (chosen && chosen.capacity < neededFor(d)) {
      const who = enrolledNow > 0 ? `${neededFor(d)} students ${d.group ? `of group ${d.group} ` : ''}are enrolled` : `the course limit is ${limitNow} students${d.group ? `, about ${neededFor(d)} per group` : ''}`
      warnings.push(`Room ${chosen.code} seats ${chosen.capacity}, but ${who}.`)
    }
    const warning = warnings.join(' ')
    const label = (o: (typeof opts)[number]) =>
      `${o.room.code}, ${KIND_LABEL[o.room.kind].toLowerCase()}, ${o.room.capacity} seats${o.fit === 'small' ? ' (too small)' : ''}${o.fit === 'busy' ? ` (occupied by ${o.busyWith})` : ''}`
    return (
      <div>
        <label htmlFor={id} className="mb-1 block font-medium">Room</label>
        <div className="flex flex-wrap items-center gap-3">
          <select id={id} className={`${fieldClass} max-w-md flex-1`} value={d.room} aria-describedby={warning ? `${id}-warn` : undefined} onChange={(e) => updateDraft(d.id, { room: e.target.value })}>
            <option value="">Choose a room…</option>
            {d.room && !chosenOpt && <option value={d.room}>{d.room} (not available)</option>}
            {opts.map((o) => (
              <option key={o.room.id} value={o.room.code} disabled={o.fit === 'busy' && o.room.code !== d.room}>{label(o)}</option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => { const b = bestRoom(opts); if (b) updateDraft(d.id, { room: b.room.code }) }} disabled={!bestRoom(opts)}>
            Suggest a free room
          </Button>
        </div>
        {opts.length === 0 && <p className="mt-1 text-sm">No active room belongs to this department yet. Ask an administrator to add one.</p>}
        <p id={`${id}-warn`} role="status" aria-live="polite" className="mt-1 text-sm font-semibold empty:hidden">{warning}</p>
      </div>
    )
  }

  const teacherOptions = teachers.map((t) => ({ value: t.id, label: t.name }))

  return (
    <Panel title={initial ? 'Edit course' : template ? `New course based on ${template.code}` : 'New course'}>
      {!initial && (
        <p className="mb-4 text-ink-soft">
          {template ? 'Syllabus, grading scheme, prerequisites, teachers and timetable were copied. Enter a new code and check the dates and rooms. ' : ''}
          Drafts are visible only to you and administrators until you publish.
        </p>
      )}
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} required />
        <TextField label="Code" value={code} onChange={setCode} hint="For example KPI/XYZ" required />
        <TextField label="Credits (ECTS)" type="number" min={1} max={30} value={credits} onChange={setCredits} />
        <TextField label="Student capacity" type="number" min={1} max={500} value={limit} onChange={setLimit} />
        <TextField label="Number of groups" type="number" min={1} max={10} value={groups} onChange={setGroups} hint="Practical sessions can be given to one group or to all. Students are placed in the emptiest group." />
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
          <PrerequisitePicker
            options={all.filter((c) => c.id !== initial?.id).map((c) => ({ id: c.id, code: c.code, name: c.name, academicYear: c.academicYear }))}
            selected={prereqs}
            onChange={setPrereqs}
          />
        </div>
        {!initial?.archived && (
          <div className="md:col-span-2">
            <p role="status" className="mb-3 text-sm font-semibold empty:hidden">{copyNote}</p>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-medium">Timetable</h3>
              <Button
                variant="secondary"
                onClick={() => setDrafts((prev) => [...prev, { id: `new-${Date.now()}`, day: 'Mon', start: '08:00', end: '09:40', type: 'Lecture', room: '', teacherId: guarantor || null, group: null, semester }])}
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
                    <SelectField
                      label="Group"
                      value={d.group === null ? 'all' : String(d.group)}
                      onChange={(v) => updateDraft(d.id, { group: v === 'all' ? null : Number(v) })}
                      options={[{ value: 'all', label: 'All groups' }, ...Array.from({ length: groupsNow }, (_, i) => ({ value: String(i + 1), label: `Group ${i + 1}` }))]}
                    />
                    <div className="sm:col-span-3">{roomField(d)}</div>
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
          <Button type="submit" disabled={busy}>{!initial ? 'Publish course' : isDraft ? 'Save and publish' : 'Save changes'}</Button>
          {isDraft && <Button variant="secondary" disabled={busy} onClick={() => void save('draft')}>{initial ? 'Save draft' : 'Save as draft'}</Button>}
          <Button variant="secondary" onClick={() => onDone()}>Cancel</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}
