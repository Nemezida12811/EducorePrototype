import { useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { FilterTabs } from '../components/ui/FilterTabs'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { directory } from '../data/demo'
import type { DirectoryUser, Role } from '../data/types'

type Filter = 'all' | Role
const ROLE_LABEL: Record<Role, string> = { student: 'Student', instructor: 'Teacher', admin: 'Administrator' }

export function UsersPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [inactive, setInactive] = useState<ReadonlySet<string>>(() => new Set(directory.filter((u) => !u.active).map((u) => u.id)))
  const [message, setMessage] = useState('')

  const toggle = (u: DirectoryUser) => {
    const off = inactive.has(u.id)
    setInactive((p) => {
      const next = new Set(p)
      if (off) next.delete(u.id)
      else next.add(u.id)
      return next
    })
    setMessage(`${u.name} ${off ? 'activated' : 'deactivated'}.`)
  }

  const rows = directory.filter((u) => filter === 'all' || u.role === filter)

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
    { header: 'Status', cell: (u) => (inactive.has(u.id) ? <Badge tone="outline">Deactivated</Badge> : <Badge tone="soft">Active</Badge>) },
    {
      header: 'Action',
      align: 'right',
      cell: (u) => (
        <Button variant="secondary" onClick={() => toggle(u)} aria-label={`${inactive.has(u.id) ? 'Activate' : 'Deactivate'} ${u.name}`}>
          {inactive.has(u.id) ? 'Activate' : 'Deactivate'}
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts of the institution. Changes here are demo-only and reset when you reload."
        action={
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
        }
      />
      <Panel title={`${rows.length} accounts`} flush>
        <DataTable caption="User accounts" columns={columns} rows={rows} getKey={(u) => u.id} />
      </Panel>
      <p className="sr-only" role="status" aria-live="polite">{message}</p>
    </>
  )
}
