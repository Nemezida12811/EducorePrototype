import { useState } from 'react'
import { Button } from '../ui/Button'
import { CheckboxGroup, SelectField, TextAreaField, TextField } from '../ui/Field'
import { Panel } from '../ui/Panel'
import { INSTRUCTOR_ID } from '../../data/demo'
import { coursesStore, sessionsStore, useCourses, useOrgUnits, useSessions, useTeachers } from '../../data/stores'
import type { ClassSession, CompletionType, Course, Day, GradingComponent, SessionType } from '../../data/types'
import { sameRoom, sessionsOverlap, slotLabel } from '../../lib/conflicts'
import { teacherName } from '../../data/selectors'
import { isGroup } from '../../lib/groups'
import { useDemo } from '../../state/DemoContext'

const PRESETS: Record<string, { label: string; scheme: GradingComponent[]; completion: CompletionType }> = {
  standard: {
    label: 'Assignments 20, Test 20, Exam 60',
    scheme: [{ name: 'Assignments', max: 20 }, { name: 'Test', max: 20 }, { name: 'Exam', max: 60 }],
    completion: 'Exam',
  },
  project: {
    label: 'Project 40, Exam 60',
    scheme: [{ name: 'Project', max: 40 }, { name: 'Exam', max: 60 }],
    completion: 'Exam',
  },
  continuous: {
    label: 'Assignments 40, Midterm test 30, Final test 30 (classified credit)',
    scheme: [{ name: 'Assignments', max: 40 }, { name: 'Midterm test', max: 30 }, { name: 'Final test', max: 30 }],
    completion: 'Classified credit',
  },
}

const DAYS: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const TYPES: SessionType[] = ['Lecture', 'Practical', 'Lab', 'Seminar']

type Draft = Omit<ClassSession, 'courseId'>

interface CourseFormProps {
  /** Present when editing; absent when creating. */
  initial?: Course
  onDone: (course?: Course) => void
}

export function CourseForm({ initial, onDone }: CourseFormProps) {
  const { role } = useDemo()
  const units = useOrgUnits().filter((u) => u.parentId !== null)
  const teachers = useTeachers()
  const all = useCourses()
  const existingSessions = useSessions()

  const defaultTeacher = role === 'instructor' ? INSTRUCTOR_ID : teachers[0].id
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [credits, setCredits] = useState(String(initial?.credits ?? 5))
  const [limit, setLimit] = useState(String(initial?.studentLimit ?? 40))
  const [unit, setUnit] = useState(initial?.orgUnitId ?? units[0].id)
  const [guarantor, setGuarantor] = useState(initial?.guarantorId ?? defaultTeacher)
  const [teacherIds, setTeacherIds] = useState<string[]>(initial?.teacherIds ?? [defaultTeacher])
  const [prereqs, setPrereqs] = useState<string[]>(initial?.prerequisiteIds ?? [])
  const [description, setDescription] = useState(initial?.description ?? '')
  const [topics, setTopics] = useState((initial?.topics ?? []).join('\n'))
  const [preset, setPreset] = useState('standard')
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    existingSessions.filter((x) => x.courseId === initial?.id).map(({ courseId: _c, ...rest }) => rest),
  )
  const [error, setError] = useState('')

  const sessionTeachers = Array.from(new Set([guarantor, ...teacherIds]))
  const updateDraft = (id: string, patch: Partial<Draft>) => setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const creditsN = Number(credits)
    const limitN = Number(limit)
    const trimmedCode = code.trim()
    if (!name.trim() || !trimmedCode) return setError('Name and code are required.')
    if (!Number.isInteger(creditsN) || creditsN < 1 || creditsN > 30) return setError('Credits must be a whole number from 1 to 30.')
    if (!Number.isInteger(limitN) || limitN < 1 || limitN > 500) return setError('Capacity must be a whole number from 1 to 500.')
    if (all.some((c) => c.code.toLowerCase() === trimmedCode.toLowerCase() && c.id !== initial?.id)) {
      return setError('Another course already uses this code.')
    }
    const teachersFinal = Array.from(new Set([guarantor, ...teacherIds]))
    for (const [i, d] of drafts.entries()) {
      if (!d.room.trim()) return setError(`Session ${i + 1}: enter a room.`)
      if (d.end <= d.start) return setError(`Session ${i + 1}: the end time must be after the start time.`)
    }
    const labels = drafts.filter(isGroup).map((d) => (d.group ?? '').trim().toUpperCase())
    for (const [i, d] of drafts.entries()) {
      if (!isGroup(d)) continue
      const label = (d.group ?? '').trim().toUpperCase()
      if (!label) return setError(`Session ${i + 1}: give the practical group a label, for example A.`)
      if (labels.filter((l) => l === label).length > 1) return setError(`Session ${i + 1}: group ${label} is used more than once.`)
      const cap = d.capacity ?? 0
      if (!Number.isInteger(cap) || cap < 1 || cap > 200) return setError(`Session ${i + 1}: capacity must be a whole number from 1 to 200.`)
    }
    // Schedule check: a teacher or a room cannot be in two places at once.
    const others = existingSessions.filter((x) => x.courseId !== initial?.id)
    for (const [i, d] of drafts.entries()) {
      const teacher = sessionTeachers.includes(d.teacherId) ? d.teacherId : guarantor
      for (const [j, e] of drafts.entries()) {
        if (j <= i || !sessionsOverlap(d, e)) continue
        const eTeacher = sessionTeachers.includes(e.teacherId) ? e.teacherId : guarantor
        if (teacher === eTeacher) return setError(`Sessions ${i + 1} and ${j + 1} overlap and have the same teacher (${teacherName(teacher)}).`)
        if (sameRoom(d.room, e.room)) return setError(`Sessions ${i + 1} and ${j + 1} overlap in room ${d.room.trim()}.`)
      }
      for (const o of others) {
        if (!sessionsOverlap(d, o)) continue
        const label = `${all.find((c) => c.id === o.courseId)?.code ?? 'another course'} on ${slotLabel(o)}`
        if (o.teacherId === teacher) return setError(`Session ${i + 1}: ${teacherName(teacher)} already teaches ${label}.`)
        if (sameRoom(o.room, d.room)) return setError(`Session ${i + 1}: room ${d.room.trim()} is already booked by ${label}.`)
      }
    }
    const saveSessions = (courseId: string) =>
      sessionsStore.set((prev) => [
        ...prev.filter((x) => x.courseId !== courseId),
        ...drafts.map((d) => ({
          ...d,
          room: d.room.trim(),
          courseId,
          teacherId: teachersFinal.includes(d.teacherId) ? d.teacherId : guarantor,
          // Only practical groups have a label, capacity and seat count.
          group: isGroup(d) ? (d.group ?? '').trim().toUpperCase() : undefined,
          capacity: isGroup(d) ? d.capacity : undefined,
          taken: isGroup(d) ? (d.taken ?? 0) : undefined,
        })),
      ])
    const topicList = topics.split('\n').map((t) => t.trim()).filter(Boolean)
    const common = {
      name: name.trim(),
      code: trimmedCode,
      description: description.trim(),
      credits: creditsN,
      studentLimit: limitN,
      orgUnitId: unit,
      guarantorId: guarantor,
      teacherIds: teachersFinal,
      prerequisiteIds: prereqs.filter((p) => p !== initial?.id),
      topics: topicList,
    }

    if (initial) {
      const updated: Course = { ...initial, ...common }
      coursesStore.set((prev) => prev.map((c) => (c.id === initial.id ? updated : c)))
      if (!initial.archived) saveSessions(initial.id)
      onDone(updated)
      return
    }
    const base = trimmedCode.toLowerCase().replace(/[^a-z0-9]/g, '') || 'course'
    let id = base
    for (let n = 2; all.some((c) => c.id === id); n += 1) id = `${base}${n}`
    const created: Course = {
      ...common,
      id,
      academicYear: '2026/27',
      semester: 'Winter',
      enrolled: 0,
      archived: false,
      completionType: PRESETS[preset].completion,
      gradingScheme: PRESETS[preset].scheme,
    }
    coursesStore.set((prev) => [...prev, created])
    saveSessions(id)
    onDone(created)
  }

  const teacherOptions = teachers.map((t) => ({ value: t.id, label: `${t.title} ${t.name}`.trim() }))

  return (
    <Panel title={initial ? 'Edit course' : 'New course'}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} required />
        <TextField label="Code" value={code} onChange={setCode} hint="For example KPI/XYZ" required />
        <TextField label="Credits (ECTS)" type="number" min={1} max={30} value={credits} onChange={setCredits} />
        <TextField label="Student capacity" type="number" min={1} max={500} value={limit} onChange={setLimit} />
        <SelectField label="Department" value={unit} onChange={setUnit} options={units.map((u) => ({ value: u.id, label: `${u.code}, ${u.name}` }))} />
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
                onClick={() =>
                  setDrafts((prev) => [...prev, { id: `s-${Date.now()}`, day: 'Mon', start: '08:00', end: '09:40', type: 'Lecture', room: '', teacherId: guarantor, capacity: 20 }])
                }
              >
                Add lecture or practical group
              </Button>
            </div>
            {drafts.length === 0 ? (
              <p className="text-ink-soft">No sessions yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {drafts.map((d, i) => (
                  <fieldset key={d.id} className="grid gap-3 rounded-md border-2 border-rose p-4 sm:grid-cols-3">
                    <legend className="px-1 font-semibold">Session {i + 1}</legend>
                    <SelectField label="Type" value={d.type} onChange={(v) => updateDraft(d.id, { type: v as SessionType })} options={TYPES.map((t) => ({ value: t, label: t }))} />
                    <SelectField label="Day" value={d.day} onChange={(v) => updateDraft(d.id, { day: v as Day })} options={DAYS.map((x) => ({ value: x, label: x }))} />
                    <SelectField
                      label="Teacher"
                      value={sessionTeachers.includes(d.teacherId) ? d.teacherId : guarantor}
                      onChange={(v) => updateDraft(d.id, { teacherId: v })}
                      options={teacherOptions.filter((o) => sessionTeachers.includes(o.value))}
                    />
                    <TextField label="Start" type="time" value={d.start} onChange={(v) => updateDraft(d.id, { start: v })} />
                    <TextField label="End" type="time" value={d.end} onChange={(v) => updateDraft(d.id, { end: v })} />
                    <TextField label="Room" value={d.room} onChange={(v) => updateDraft(d.id, { room: v })} />
                    {isGroup(d) && (
                      <>
                        <TextField label="Group label" value={d.group ?? ''} onChange={(v) => updateDraft(d.id, { group: v })} hint="For example A, B, C" />
                        <TextField label="Group capacity" type="number" min={1} max={200} value={String(d.capacity ?? 20)} onChange={(v) => updateDraft(d.id, { capacity: Number(v) })} />
                      </>
                    )}
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
        {initial ? (
          <div className="md:col-span-2">
            <p className="mb-1 font-medium">Grading scheme</p>
            <p className="text-ink-soft">{initial.gradingScheme.map((c) => `${c.name} ${c.max}`).join(', ')}. The scheme is fixed once the course exists.</p>
          </div>
        ) : (
          <div className="md:col-span-2">
            <SelectField
              label="Grading scheme"
              value={preset}
              onChange={setPreset}
              options={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label }))}
              hint="Components add up to 100 points."
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit">{initial ? 'Save changes' : 'Create course'}</Button>
          <Button variant="secondary" onClick={() => onDone()}>Cancel</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}
