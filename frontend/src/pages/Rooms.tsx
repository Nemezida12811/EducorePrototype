import { useState } from 'react'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { EmptyState } from '../components/ui/EmptyState'
import { CheckboxGroup, SelectField, TextField } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { deleteRoom, errorMessage, saveRoom } from '../data/actions'
import { useOrgUnits, useRooms } from '../data/stores'
import type { Room, RoomKind } from '../data/types'
import { KIND_LABEL } from '../lib/rooms'

const KINDS = Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))

export function RoomsPage() {
  const rooms = useRooms()
  const units = useOrgUnits()
  const [department, setDepartment] = useState('all')
  const [kind, setKind] = useState('all')
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [message, setMessage] = useState('')

  const unitCode = (id: string) => units.find((u) => u.id === id)?.code ?? '?'
  const visible = rooms.filter((r) => (department === 'all' || r.departmentIds.includes(department)) && (kind === 'all' || r.kind === kind))
  const target = editing && editing !== 'new' ? rooms.find((r) => r.id === editing) : undefined

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action()
      setMessage(ok)
    } catch (e) {
      setMessage(errorMessage(e))
    }
  }

  const columns: Column<Room>[] = [
    {
      header: 'Room',
      rowHeader: true,
      cell: (r) => (
        <>
          {r.code}
          {r.building && <span className="block text-sm font-normal text-ink-soft">Building {r.building}</span>}
        </>
      ),
    },
    { header: 'Type', cell: (r) => KIND_LABEL[r.kind] },
    { header: 'Seats', cell: (r) => r.capacity },
    { header: 'Departments', cell: (r) => r.departmentIds.map(unitCode).join(', ') },
    { header: 'In timetables', cell: (r) => r.sessionCount },
    { header: 'Status', cell: (r) => <Badge tone={r.active ? 'solid' : 'outline'}>{r.active ? 'Active' : 'Inactive'}</Badge> },
    {
      header: 'Actions',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" className="min-h-9 px-2" onClick={() => setEditing(r.id)} aria-label={`Edit ${r.code}`}>
            <Pencil aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="secondary"
            className="min-h-9 px-2"
            aria-label={`${r.active ? 'Deactivate' : 'Activate'} ${r.code}`}
            onClick={() => void run(() => saveRoom(r.id, { code: r.code, building: r.building, kind: r.kind, capacity: r.capacity, departmentIds: r.departmentIds, active: !r.active }), `${r.code} ${r.active ? 'deactivated' : 'activated'}.`)}
          >
            <Power aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="secondary"
            className="min-h-9 px-2"
            disabled={r.sessionCount > 0}
            title={r.sessionCount > 0 ? 'Used in timetables: deactivate it instead' : undefined}
            aria-label={`Delete ${r.code}`}
            onClick={() => void run(() => deleteRoom(r.id), `${r.code} deleted.`)}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Rooms"
        description="Lecture halls, classrooms and labs. A room belongs to one or more departments, and only their courses can schedule it."
        action={
          !editing ? (
            <Button className="bg-blush" variant="secondary" onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" className="mr-2 size-4" />
              New room
            </Button>
          ) : undefined
        }
      />
      {editing && (
        <div className="mb-10">
          <RoomForm
            key={editing}
            room={target}
            onDone={(m) => {
              setEditing(null)
              if (m) setMessage(m)
            }}
          />
        </div>
      )}
      <div className="mb-6 grid max-w-xl gap-4 sm:grid-cols-2">
        <SelectField label="Department" value={department} onChange={setDepartment} options={[{ value: 'all', label: 'All departments' }, ...units.map((u) => ({ value: u.id, label: `${u.code}, ${u.name}` }))]} />
        <SelectField label="Type" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All types' }, ...KINDS]} />
      </div>
      <p role="status" aria-live="polite" className="mb-4 text-rose empty:hidden">{message}</p>
      {visible.length === 0 ? (
        <EmptyState title="No rooms here">Add a room, or change the filters.</EmptyState>
      ) : (
        <Panel title={`${visible.length} ${visible.length === 1 ? 'room' : 'rooms'}`} flush>
          <DataTable caption="Rooms" columns={columns} rows={visible} getKey={(r) => r.id} />
        </Panel>
      )}
    </>
  )
}

function RoomForm({ room, onDone }: { room?: Room; onDone: (message?: string) => void }) {
  const rooms = useRooms()
  const units = useOrgUnits()
  const [code, setCode] = useState(room?.code ?? '')
  const [building, setBuilding] = useState(room?.building ?? '')
  const [kind, setKind] = useState<RoomKind>(room?.kind ?? 'classroom')
  const [capacity, setCapacity] = useState(String(room?.capacity ?? 30))
  const [deps, setDeps] = useState<string[]>(room?.departmentIds ?? [])
  const [active, setActive] = useState(room?.active ?? true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cap = Number(capacity)
    if (!code.trim()) return setError('Enter the room code, for example Meridian.')
    if (rooms.some((r) => r.code.toLowerCase() === code.trim().toLowerCase() && r.id !== room?.id)) return setError('Another room already has this code.')
    if (!Number.isInteger(cap) || cap < 1 || cap > 2000) return setError('Seats must be a whole number from 1 to 2000.')
    if (deps.length === 0) return setError('Choose at least one department the room belongs to.')
    setBusy(true)
    try {
      await saveRoom(room?.id ?? null, { code: code.trim(), building: building.trim(), kind, capacity: cap, departmentIds: deps, active })
      onDone(`${code.trim()} ${room ? 'updated' : 'added'}.`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Panel title={room ? `Edit ${room.code}` : 'New room'}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="Code" value={code} onChange={setCode} hint="Shown in timetables, for example Meridian or PK6_PC1" required />
        <TextField label="Building" value={building} onChange={setBuilding} />
        <SelectField label="Type" value={kind} onChange={(v) => setKind(v as RoomKind)} options={KINDS} />
        <TextField label="Seats" type="number" min={1} max={2000} value={capacity} onChange={setCapacity} />
        <div className="md:col-span-2">
          <CheckboxGroup legend="Belongs to departments" options={units.map((u) => ({ value: u.id, label: `${u.code}, ${u.name}` }))} selected={deps} onChange={setDeps} />
        </div>
        <label className="flex items-center gap-3 md:col-span-2">
          <input type="checkbox" className="size-5 accent-wine" checked={active} onChange={(e) => setActive(e.target.checked)} />
          In use (inactive rooms cannot be booked)
        </label>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit" disabled={busy}>{room ? 'Save changes' : 'Add room'}</Button>
          <Button variant="secondary" onClick={() => onDone()}>Cancel</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}
