import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { SelectField, TextField } from '../components/ui/Field'
import { FilterTabs } from '../components/ui/FilterTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { createUser, errorMessage, updateUser } from '../data/actions'
import { useDirectory, useOrgUnits, usePrograms } from '../data/stores'
import { useApp } from '../state/AppContext'
import type { DirectoryUser, Role } from '../data/types'

type Filter = 'all' | Exclude<Role, 'superadmin'>
type Editing = null | 'new' | string
const ROLE_LABEL: Record<Role, string> = { student: 'Student', instructor: 'Teacher', admin: 'Administrator', superadmin: 'Super administrator' }

export function UsersPage() {
  const users = useDirectory()
  const { user: me, role: myRole } = useApp()
  const SELF_ID = me.id
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Editing>(null)
  const [message, setMessage] = useState('')

  const setActive = async (u: DirectoryUser) => {
    try {
      await updateUser(u.id, { active: !u.active })
      setMessage(`${u.name} ${u.active ? 'deactivated' : 'activated'}.`)
    } catch (e) {
      setMessage(errorMessage(e))
    }
  }
  // Only a super administrator may change administrator accounts (the API enforces it too).
  const locked = (u: DirectoryUser) => u.role === 'admin' && myRole !== 'superadmin'

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
          <Button variant="secondary" disabled={locked(u)} onClick={() => setEditing(u.id)} aria-label={`Edit ${u.name}`}>Edit</Button>
          <Button
            variant="secondary"
            disabled={u.id === SELF_ID || locked(u)}
            onClick={() => void setActive(u)}
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
        description="Create, edit and deactivate accounts, and change roles."
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
            selfId={SELF_ID}
            canCreateAdmins={myRole === 'superadmin'}
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

function UserForm({ user, selfId, canCreateAdmins, onDone }: { user?: DirectoryUser; selfId: string; canCreateAdmins: boolean; onDone: (message?: string) => void }) {
  const users = useDirectory()
  const departments = useOrgUnits()
  const programs = usePrograms()
  const isSelf = user?.id === selfId

  const [first, setFirst] = useState(user?.firstName ?? '')
  const [last, setLast] = useState(user?.lastName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<Exclude<Role, 'superadmin'>>((user?.role as Exclude<Role, 'superadmin'>) ?? 'student')
  const [dept, setDept] = useState(user?.departmentId ?? departments[0]?.id ?? '')
  const [program, setProgram] = useState(user?.studyProgramId ?? programs[0]?.id ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const mail = email.trim().toLowerCase()
    if (!first.trim() || !last.trim()) return setError('First and last name are required.')
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setError('Enter a valid e-mail address.')
    if (users.some((u) => u.email.toLowerCase() === mail && u.id !== user?.id)) return setError('This e-mail is already used by another account.')
    const input = {
      firstName: first.trim(), lastName: last.trim(), email: mail, role,
      departmentId: role === 'student' ? null : dept || null,
      studyProgramId: role === 'student' ? program || null : null,
    }
    setBusy(true)
    try {
      const display = `${input.firstName} ${input.lastName}`
      if (user) {
        await updateUser(user.id, input)
        onDone(`${display} updated.`)
      } else {
        const password = await createUser(input)
        onDone(password ? `${display} created. Temporary password (shown once): ${password}` : `${display} created.`)
      }
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Panel title={user ? `Edit ${user.name}` : 'New user'}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="First name" value={first} onChange={setFirst} required />
        <TextField label="Last name" value={last} onChange={setLast} required />
        <TextField label="E-mail" type="email" value={email} onChange={setEmail} required />
        <SelectField
          label="Role"
          value={role}
          onChange={(v) => setRole(v as Exclude<Role, 'superadmin'>)}
          disabled={isSelf}
          hint={isSelf ? 'You cannot change your own role.' : undefined}
          options={[
            { value: 'student', label: 'Student' },
            { value: 'instructor', label: 'Teacher' },
            ...(canCreateAdmins ? [{ value: 'admin', label: 'Administrator' }] : []),
          ]}
        />
        {role !== 'student' && (
          <SelectField label="Department" value={dept} onChange={setDept} options={departments.map((d) => ({ value: d.id, label: `${d.code}, ${d.name}` }))} />
        )}
        {role === 'student' && (
          <SelectField label="Study program" value={program} onChange={setProgram} options={programs.map((p) => ({ value: p.id, label: `${p.name} (${p.degree})` }))} />
        )}
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit" disabled={busy}>{user ? 'Save changes' : 'Create user'}</Button>
          <Button variant="secondary" onClick={() => onDone()}>Cancel</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}
