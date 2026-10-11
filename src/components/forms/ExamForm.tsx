import { useState } from 'react'
import { Button } from '../ui/Button'
import { SelectField, TextField } from '../ui/Field'
import { examsStore } from '../../data/stores'
import type { Course, Exam } from '../../data/types'

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
  const [format, setFormat] = useState<Exam['format']>('Written')
  const [term, setTerm] = useState('Term 1')
  const [capacity, setCapacity] = useState('40')
  const [registration, setRegistration] = useState<Exam['registration']>('open')
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const cap = Number(capacity)
    if (!courseId) return setError('Choose a course.')
    if (!date) return setError('Choose a date.')
    if (!room.trim()) return setError('Enter a room.')
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) return setError('Capacity must be a whole number from 1 to 500.')
    examsStore.set((prev) => [
      ...prev,
      { id: `e-${Date.now()}`, courseId, date, start, room: room.trim(), format, term, capacity: cap, registered: 0, registration },
    ])
    onDone()
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
        onChange={(v) => setFormat(v as Exam['format'])}
        options={[{ value: 'Written', label: 'Written' }, { value: 'Oral', label: 'Oral' }, { value: 'Practical', label: 'Practical' }]}
      />
      <SelectField
        label="Term"
        value={term}
        onChange={setTerm}
        options={['Term 1', 'Term 2', 'Term 3'].map((t) => ({ value: t, label: t }))}
      />
      <SelectField
        label="Registration"
        value={registration}
        onChange={(v) => setRegistration(v as Exam['registration'])}
        options={[{ value: 'open', label: 'Open to students' }, { value: 'closed', label: 'Closed' }]}
      />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit">Add exam term</Button>
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        <p role="alert" className="font-semibold">{error}</p>
      </div>
    </form>
  )
}
