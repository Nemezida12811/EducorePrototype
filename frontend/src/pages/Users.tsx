import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { SelectField, TextField } from '../components/ui/Field'
import { FilterTabs } from '../components/ui/FilterTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { directoryStore, teachersStore, useDirectory, useOrgUnits, usePrograms } from '../data/stores'
import type { DirectoryUser, Role } from '../data/types'

type Filter = 'all' | Exclude<Role, 'superadmin'>
type Editing = null | 'new' | string
const ROLE_LABEL: Record<Role, string> = { student: 'Student', instructor: 'Teacher', admin: 'Administrator', superadmin: 'Super administrator' }
const SELF_ID = 'u-admin'

const emailOf = (name: string) =>
  `${name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.')}@educore.example`

export function UsersPage() {
  const users = useDirectory()
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Editing>(null)
  const [message, setMessage] = useState('')

  const setActive = (u: DirectoryUser) => {
    directoryStore.set((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)))
    setMessage(`${u.name} ${u.active ? 'deactivated' : 'activated'}.`)
  }

  const rows = users.filter((u) => filter === 'all' || u.role === filter)
  const target = editing && editing !== 'new' ? users.find((u) => u.id === editing) : undefined

  const columns: Column<DirectoryUser>[] = [
    {
      header: 'Name',
      rowHeader: true,
      cell: (u) => (
        <>
          {u.name}
          <span className="block text-sm font-normal text-ink-soft">{u.email}</span>
        </>
      ),
    },
    { header: 'Role', cell: (u) => <Badge tone={u.role === 'admin' ? 'solid' : 'soft'}>{ROLE_LABEL[u.role]}</Badge> },
    { header: 'Unit', cell: (u) => u.unit },
    { header: 'Status', cell: (u) => (u.active ? <Badge tone="soft">Active</Badge> : <Badge tone="outline">Deactivated</Badge>) },
    {
      header: 'Actions',
      align: 'right',
      cell: (u) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(u.id)} aria-label={`Edit ${u.name}`}>Edit</Button>
          <Button
            variant="secondary"
            disabled={u.id === SELF_ID}
            onClick={() => setActive(u)}
            aria-label={`${u.active ? 'Deactivate' : 'Activate'} ${u.name}`}
          >
            {u.active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        description="Create, edit and deactivate accounts, and change roles. Changes are demo-only and reset on reload."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <FilterTabs
              label="Filter users by role"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'student', label: 'Students' },
                { value: 'instructor', label: 'Teachers' },
                { value: 'admin', label: 'Admins' },
              ]}
            />
            <Button className="bg-blush" variant="secondary" onClick={() => setEditing('new')}>
              <UserPlus aria-hidden="true" className="mr-2 size-4" />
              New user
            </Button>
          </div>
        }
      />
      {editing && (
        <div className="mb-10">
          <UserForm
            key={editing}
            user={target}
            onDone={(msg) => {
              setEditing(null)
              if (msg) setMessage(msg)
            }}
          />
        </div>
      )}
      <Panel title={`${rows.length} accounts`} flush>
        <DataTable caption="User accounts" columns={columns} rows={rows} getKey={(u) => u.id} />
      </Panel>
      <p className="sr-only" role="status" aria-live="polite">{message}</p>
      {message && <p className="mt-4 text-rose" aria-hidden="true">{message}</p>}
    </>
  )
}

function UserForm({ user, onDone }: { user?: DirectoryUser; onDone: (message?: string) => void }) {
  const users = useDirectory()
  const departments = useOrgUnits().filter((u) => u.parentId !== null)
  const programs = usePrograms()
  const isSelf = user?.id === SELF_ID

  const titleMatch = user?.teacherId ? teachersStore.get().find((t) => t.id === user.teacherId) : undefined
  const [name, setName] = useState(titleMatch ? titleMatch.name : (user?.name ?? ''))
  const [title, setTitle] = useState(titleMatch?.title ?? 'Dr.')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Exclude<Role, 'superadmin'>>((user?.role as Exclude<Role, 'superadmin'>) ?? 'student')
  const [dept, setDept] = useState(departments.find((d) => d.code === user?.unit)?.id ?? departments[0].id)
  const [program, setProgram] = useState(programs.find((p) => p.name === user?.unit)?.id ?? programs[0].id)
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    const mail = (email.trim() || (trimmed ? emailOf(trimmed) : '')).toLowerCase()
    if (!trimmed) return setError('Name is required.')
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError('Enter a valid e-mail address.')
    if (users.some((u) => u.email.toLowerCase() === mail && u.id !== user?.id)) return setError('This e-mail is already used by another account.')

    const unit =
      role === 'instructor' ? (departments.find((d) => d.id === dept)?.code ?? '') : role === 'student' ? (programs.find((p) => p.id === program)?.name ?? '') : 'Study office'

    // Teachers also get a Teacher record so they can be chosen as course teachers.
    let teacherId = user?.teacherId
    if (role === 'instructor') {
      if (teacherId) {
        teachersStore.set((prev) => prev.map((t) => (t.id === teacherId ? { ...t, name: trimmed, title: title.trim(), orgUnitId: dept } : t)))
      } else {
        teacherId = `t-${Date.now()}`
        const id = teacherId
        teachersStore.set((prev) => [...prev, { id, name: trimmed, title: title.trim(), orgUnitId: dept }])
      }
    }
    const display = role === 'instructor' ? `${title.trim()} ${trimmed}`.trim() : trimmed

    if (user) {
      directoryStore.set((prev) => prev.map((u) => (u.id === user.id ? { ...u, name: display, email: mail, role, unit, teacherId } : u)))
      onDone(`${display} updated.`)
    } else {
      directoryStore.set((prev) => [...prev, { id: `u-${Date.now()}`, name: display, email: mail, role, unit, active: true, teacherId }])
      onDone(`${display} created.`)
    }
  }

  return (
    <Panel title={user ? `Edit ${user.name}` : 'New user'}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="Full name" value={name} onChange={setName} required />
        <TextField label="E-mail" type="email" value={email} onChange={setEmail} hint="Leave empty to generate one from the name." />
        <SelectField
          label="Role"
          value={role}
          onChange={(v) => setRole(v as Exclude<Role, 'superadmin'>)}
          disabled={isSelf}
          hint={isSelf ? 'You cannot change your own role.' : undefined}
          options={[
            { value: 'student', label: 'Student' },
            { value: 'instructor', label: 'Teacher' },
            { value: 'admin', label: 'Administrator' },
          ]}
        />
        {role === 'instructor' && (
          <>
            <TextField label="Title" value={title} onChange={setTitle} hint="For example Dr., Prof." />
            <SelectField label="Department" value={dept} onChange={setDept} options={departments.map((d) => ({ value: d.id, label: `${d.code}, ${d.name}` }))} />
          </>
        )}
        {role === 'student' && (
          <SelectField label="Study program" value={program} onChange={setProgram} options={programs.map((p) => ({ value: p.id, label: `${p.name} (${p.degreeLevel})` }))} />
        )}
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit">{user ? 'Save changes' : 'Create user'}</Button>
          <Button variant="secondary" onClick={() => onDone()}>Cancel</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}
