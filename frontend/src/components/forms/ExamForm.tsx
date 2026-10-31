import { useState } from 'react'
import { Button } from '../ui/Button'
import { SelectField, TextField } from '../ui/Field'
import { addExam, errorMessage } from '../../data/actions'
import { examsStore } from '../../data/stores'
import { examsOverlap, sameRoom } from '../../lib/conflicts'
import { findCourse } from '../../data/selectors'
import { formatWeekdayDate } from '../../lib/format'
import type { Course, ExamFormat } from '../../data/types'

interface ExamFormProps {
  /** Courses the user may add an exam term to. */
  courses: Course[]
  /** Pre-select (and lock) one course, e.g. on the course page. */
  fixedCourseId?: string
  onDone: () => void
}

export function ExamForm({ courses, fixedCourseId, onDone }: ExamFormProps) {
  const [courseId, setCourseId] = useState(fixedCourseId ?? courses[0]?.id ?? '')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('09:00')
  const [room, setRoom] = useState('')
  const [format, setFormat] = useState<ExamFormat>('Written')
  const [term, setTerm] = useState('1')
  const [capacity, setCapacity] = useState('40')
  const [open, setOpen] = useState('open')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cap = Number(capacity)
    if (!courseId) return setError('Choose a course.')
    if (!date) return setError('Choose a date.')
    if (!room.trim()) return setError('Enter a room.')
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) return setError('Capacity must be a whole number from 1 to 500.')
    const clash = examsStore.get().find((x) => sameRoom(x.room, room) && examsOverlap(x, { date, start }))
    if (clash) return setError(`Room ${room.trim()} is already booked for ${findCourse(clash.courseId)?.code ?? 'another course'} on ${formatWeekdayDate(clash.date)} at ${clash.start} (exams last about two hours).`)
    const sameCourse = examsStore.get().find((x) => x.courseId === courseId && examsOverlap(x, { date, start }))
    if (sameCourse) return setError('This course already has an exam term at that time.')
    setBusy(true)
    try {
      await addExam(courseId, { date, time: start, room: room.trim(), format, term: Number(term), capacity: cap, registrationOpen: open === 'open' })
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      {!fixedCourseId && (
        <div className="sm:col-span-2">
          <SelectField label="Course" value={courseId} onChange={setCourseId} options={courses.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` }))} />
        </div>
      )}
      <TextField label="Date" type="date" value={date} onChange={setDate} required />
      <TextField label="Start time" type="time" value={start} onChange={setStart} />
      <TextField label="Room" value={room} onChange={setRoom} required />
      <TextField label="Capacity" type="number" min={1} max={500} value={capacity} onChange={setCapacity} />
      <SelectField
        label="Format"
        value={format}
        onChange={(v) => setFormat(v as ExamFormat)}
        options={(['Written', 'Oral', 'Online', 'Practical'] as const).map((f) => ({ value: f, label: f }))}
      />
      <SelectField label="Term" value={term} onChange={setTerm} options={['1', '2', '3'].map((t) => ({ value: t, label: `Term ${t}` }))} />
      <SelectField label="Registration" value={open} onChange={setOpen} options={[{ value: 'open', label: 'Open to students' }, { value: 'closed', label: 'Closed' }]} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={busy}>Add exam term</Button>
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <p role="alert" className="font-semibold">{error}</p>
      </div>
    </form>
  )
}
