import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { SelectField, TextField } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { PLAN_LIMITS } from '../data/demo'
import { institutionsStore, useInstitutions } from '../data/stores'
import type { Institution, Plan } from '../data/types'
import { percent } from '../lib/format'

export function UsageCell({ used, limit, unit }: { used: number; limit: number; unit: string }) {
  const pct = percent(used, limit)
  return (
    <div className="flex items-center gap-3">
      <div className="w-24">
        <ProgressBar value={used} max={limit} label={`${unit} usage`} />
      </div>
      <span className="whitespace-nowrap">
        {used.toLocaleString('en-GB')} of {limit.toLocaleString('en-GB')} {unit}
        {pct >= 90 && <Badge tone="solid">Near limit</Badge>}
      </span>
    </div>
  )
}

export function InstitutionsPage() {
  const institutions = useInstitutions()
  const [editing, setEditing] = useState<null | 'new' | string>(null)

  const toggleActive = (i: Institution) =>
    institutionsStore.set((prev) => prev.map((x) => (x.id === i.id ? { ...x, active: !x.active } : x)))

  const columns: Column<Institution>[] = [
    {
      header: 'Institution',
      rowHeader: true,
      cell: (i) => (
        <>
          {i.name}
          <span className="block text-sm font-normal text-ink-soft">{i.domain}</span>
        </>
      ),
    },
    { header: 'Plan', cell: (i) => <Badge tone={i.plan === 'Pro' ? 'solid' : 'soft'}>{i.plan}</Badge> },
    { header: 'Users', cell: (i) => <UsageCell used={i.usersUsed} limit={i.userLimit} unit="users" /> },
    { header: 'Storage', cell: (i) => <UsageCell used={i.storageUsedGb} limit={i.storageLimitGb} unit="GB" /> },
    { header: 'Status', cell: (i) => (i.active ? <Badge tone="soft">Active</Badge> : <Badge tone="outline">Suspended</Badge>) },
    {
      header: 'Actions',
      align: 'right',
      cell: (i) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(i.id)} aria-label={`Edit ${i.name}`}>Edit</Button>
          <Button variant="secondary" onClick={() => toggleActive(i)} aria-label={`${i.active ? 'Suspend' : 'Activate'} ${i.name}`}>
            {i.active ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Institutions"
        description="Customer institutions on the platform, their subscription plan and limits. Changes reset on reload."
        action={
          <Button className="bg-blush" variant="secondary" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            New institution
          </Button>
        }
      />
      {editing && (
        <div className="mb-10">
          <InstitutionForm key={editing} institution={institutions.find((i) => i.id === editing)} onDone={() => setEditing(null)} />
        </div>
      )}
      <Panel title={`${institutions.length} institutions`} flush>
        <DataTable caption="Institutions on the platform" columns={columns} rows={institutions} getKey={(i) => i.id} />
      </Panel>
    </>
  )
}

function InstitutionForm({ institution, onDone }: { institution?: Institution; onDone: () => void }) {
  const [name, setName] = useState(institution?.name ?? '')
  const [domain, setDomain] = useState(institution?.domain ?? '')
  const [plan, setPlan] = useState<Plan>(institution?.plan ?? 'Basic')
  const [users, setUsers] = useState(String(institution?.userLimit ?? PLAN_LIMITS.Basic.users))
  const [storage, setStorage] = useState(String(institution?.storageLimitGb ?? PLAN_LIMITS.Basic.storageGb))
  const [error, setError] = useState('')

  const choosePlan = (p: string) => {
    setPlan(p as Plan)
    setUsers(String(PLAN_LIMITS[p as Plan].users))
    setStorage(String(PLAN_LIMITS[p as Plan].storageGb))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = Number(users)
    const s = Number(storage)
    if (!name.trim() || !domain.trim()) return setError('Name and domain are required.')
    if (!Number.isInteger(u) || u < 1) return setError('User limit must be a positive whole number.')
    if (!(s > 0)) return setError('Storage limit must be greater than zero.')
    const values = { name: name.trim(), domain: domain.trim().toLowerCase(), plan, userLimit: u, storageLimitGb: s }
    if (institution) institutionsStore.set((prev) => prev.map((i) => (i.id === institution.id ? { ...i, ...values } : i)))
    else institutionsStore.set((prev) => [...prev, { ...values, id: `i-${Date.now()}`, usersUsed: 0, storageUsedGb: 0, active: true }])
    onDone()
  }

  return (
    <Panel title={institution ? `Edit ${institution.name}` : 'New institution'}>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <TextField label="Name" value={name} onChange={setName} required />
        <TextField label="E-mail domain" value={domain} onChange={setDomain} hint="Used for self-registration, for example uni.example" required />
        <SelectField label="Subscription plan" value={plan} onChange={choosePlan} options={[{ value: 'Basic', label: 'Basic' }, { value: 'Pro', label: 'Pro' }]} hint="Choosing a plan fills in its default limits." />
        <div className="grid grid-cols-2 gap-4">
          <TextField label="User limit" type="number" min={1} value={users} onChange={setUsers} />
          <TextField label="Storage limit (GB)" type="number" min={1} value={storage} onChange={setStorage} />
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit">{institution ? 'Save changes' : 'Create institution'}</Button>
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <p role="alert" className="font-semibold">{error}</p>
        </div>
      </form>
    </Panel>
  )
}
