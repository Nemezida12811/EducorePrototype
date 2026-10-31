import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { errorMessage, savePlatformLimits } from '../data/actions'
import { usePlatform } from '../data/stores'
import { formatMb, percent } from '../lib/format'

export function PlatformPage() {
  const platform = usePlatform()
  const [users, setUsers] = useState(String(platform?.userLimit ?? ''))
  const [storage, setStorage] = useState(String(platform?.storageLimitMb ?? ''))
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  if (!platform) return <PageHeader title="Platform" description="Platform data is not available." />

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    const u = Number(users)
    const s = Number(storage)
    if (!Number.isInteger(u) || u < platform.usersUsed) return setError(`The user limit must be a whole number of at least ${platform.usersUsed.toLocaleString('en-GB')}, the current number of users.`)
    if (!Number.isInteger(s) || s < Math.ceil(platform.storageUsedMb)) return setError(`The storage limit must be a whole number of at least ${Math.ceil(platform.storageUsedMb)} MB, the amount in use.`)
    try {
      await savePlatformLimits(platform.institutionId, { maxUsers: u, maxStorageMb: s })
      setError('')
      setMessage('Limits saved.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Platform" description="Usage and limits for the whole platform." />
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
                <span>{formatMb(platform.storageUsedMb)} of {formatMb(platform.storageLimitMb)} ({percent(platform.storageUsedMb, platform.storageLimitMb)}%)</span>
              </div>
              <ProgressBar value={platform.storageUsedMb} max={platform.storageLimitMb} label="Storage usage" />
            </li>
          </ul>
        </Panel>

        <Panel title="Limits">
          <form onSubmit={save} className="flex flex-col gap-4">
            <TextField label="User limit" type="number" min={1} value={users} onChange={setUsers} />
            <TextField label="Storage limit (MB)" type="number" min={1} value={storage} onChange={setStorage} />
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
