
import { useState, type FormEvent } from 'react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { platform, university } from '../data/demo'
import { platformStore, usePlatform } from '../data/stores'
import { percent } from '../lib/format'

export function UsageCell({
  used,
  limit,
  unit,
}: {
  used: number
  limit: number
  unit: string
}) {
  const pct = percent(used, limit)

  return (
    <div className="flex items-center gap-3">
      <div className="w-24">
        <ProgressBar
          value={used}
          max={limit}
          label={`${unit} usage`}
        />
      </div>

      <span className="whitespace-nowrap">
        {used.toLocaleString('en-GB')} of{' '}
        {limit.toLocaleString('en-GB')} {unit}
      </span>

      {pct >= 90 && (
        <Badge tone="solid">Near limit</Badge>
      )}
    </div>
  )
}

export function InstitutionsPage() {
  const settings = usePlatform()

  const [users, setUsers] = useState(
    String(settings.userLimit),
  )
  const [storage, setStorage] = useState(
    String(settings.storageLimitGb),
  )
  const [error, setError] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const userLimit = Number(users)
    const storageLimitGb = Number(storage)

    if (!Number.isInteger(userLimit) || userLimit < 1) {
      setError('User limit must be a positive whole number.')
      return
    }

    if (!Number.isFinite(storageLimitGb) || storageLimitGb <= 0) {
      setError('Storage limit must be greater than zero.')
      return
    }

    if (userLimit < settings.usersUsed) {
      setError('User limit cannot be lower than current usage.')
      return
    }

    if (storageLimitGb < settings.storageUsedGb) {
      setError('Storage limit cannot be lower than current usage.')
      return
    }

    platformStore.set((prev) => ({
      ...prev,
      userLimit,
      storageLimitGb,
    }))

    setError('')
  }

  const reset = () => {
    setUsers(String(platform.userLimit))
    setStorage(String(platform.storageLimitGb))

    platformStore.set((prev) => ({
      ...prev,
      userLimit: platform.userLimit,
      storageLimitGb: platform.storageLimitGb,
    }))

    setError('')
  }

  return (
    <>
      <PageHeader
        title="Institution"
        description="Manage institution-wide user and storage limits."
      />

      <Panel title={university.name}>
        <p className="text-sm text-ink-soft">
          {university.faculty}
        </p>
      </Panel>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel title="Current usage">
          <div className="grid gap-6">
            <div>
              <p className="mb-2 text-sm font-medium">
                Users
              </p>
              <UsageCell
                used={settings.usersUsed}
                limit={settings.userLimit}
                unit="users"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                Storage
              </p>
              <UsageCell
                used={settings.storageUsedGb}
                limit={settings.storageLimitGb}
                unit="GB"
              />
            </div>
          </div>
        </Panel>

        <Panel title="Platform limits">
          <form onSubmit={submit} className="grid gap-5">
            <TextField
              label="User limit"
              type="number"
              min={1}
              value={users}
              onChange={setUsers}
              required
            />

            <TextField
              label="Storage limit (GB)"
              type="number"
              min={0.1}
              value={storage}
              onChange={setStorage}
              required
            />

            {error && (
              <p role="alert" className="font-semibold text-red-600">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="submit">
                Save changes
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={reset}
              >
                Reset limits
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  )
}
