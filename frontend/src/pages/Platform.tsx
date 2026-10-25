import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { platformStore, usePlatform } from '../data/stores'
import { percent } from '../lib/format'

export function PlatformPage() {
  const platform = usePlatform()
  const [users, setUsers] = useState(String(platform.userLimit))
  const [storage, setStorage] = useState(String(platform.storageLimitGb))
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    const u = Number(users)
    const s = Number(storage)
    if (!Number.isInteger(u) || u < platform.usersUsed) return setError(`The user limit must be a whole number of at least ${platform.usersUsed.toLocaleString('en-GB')}, the current number of users.`)
    if (!(s >= platform.storageUsedGb)) return setError(`The storage limit must be at least ${platform.storageUsedGb} GB, the amount in use.`)
    setError('')
    platformStore.set((prev) => ({ ...prev, userLimit: u, storageLimitGb: s }))
    setMessage('Limits saved.')
  }

  return (
    <>
      <PageHeader title="Platform" description="Usage and limits for the whole platform. Changes reset on reload." />
      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
        <Panel title="Usage">
          <ul className="flex flex-col gap-6">
            <li>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="font-semibold">Users</span>
                <span>{platform.usersUsed.toLocaleString('en-GB')} of {platform.userLimit.toLocaleString('en-GB')} ({percent(platform.usersUsed, platform.userLimit)}%)</span>
              </div>
              <ProgressBar value={platform.usersUsed} max={platform.userLimit} label="User usage" />
            </li>
            <li>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="font-semibold">Storage</span>
                <span>{platform.storageUsedGb} of {platform.storageLimitGb} GB ({percent(platform.storageUsedGb, platform.storageLimitGb)}%)</span>
              </div>
              <ProgressBar value={platform.storageUsedGb} max={platform.storageLimitGb} label="Storage usage" />
            </li>
          </ul>
        </Panel>

        <Panel title="Limits">
          <form onSubmit={save} className="flex flex-col gap-4">
            <TextField label="User limit" type="number" min={1} value={users} onChange={setUsers} />
            <TextField label="Storage limit (GB)" type="number" min={1} value={storage} onChange={setStorage} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">Save limits</Button>
              <p role="alert" className="font-semibold">{error}</p>
              <p role="status" aria-live="polite" className="font-semibold">{message}</p>
            </div>
          </form>
        </Panel>
      </div>
    </>
  )
}
