import { useId, useState } from 'react'
import { Download } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { errorMessage } from '../data/actions'
import { useOrgUnits, usePrograms } from '../data/stores'
import { api, download } from '../lib/api'
import { useApp } from '../state/AppContext'

const ROLE_LABEL = { student: 'Student', instructor: 'Instructor', admin: 'Administrator', superadmin: 'Super administrator' }
const field = 'min-h-11 w-full rounded-md border-2 border-wine bg-fog px-3 text-wine'
const CHANNELS = [
  { key: 'inApp', label: 'In-app notifications' },
  { key: 'email', label: 'E-mail' },
  { key: 'push', label: 'Push notifications' },
] as const

export function ProfilePage() {
  const { user, role, name, initials } = useApp()
  const { refreshUser } = useAuth()
  const units = useOrgUnits()
  const programs = usePrograms()
  const ids = { email: useId(), phone: useId(), first: useId(), last: useId() }
  const [first, setFirst] = useState(user.firstName)
  const [last, setLast] = useState(user.lastName)
  const [phone, setPhone] = useState(user.phone ?? '')
  const [channels, setChannels] = useState(user.notificationChannels ?? { email: true, inApp: true, push: false })
  const [message, setMessage] = useState('')

  const detail =
    role === 'student' ? programs.find((p) => p.id === user.studyProgramId)?.name
    : role === 'instructor' ? units.find((u) => u.id === user.departmentId)?.name
    : undefined

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api('/users/me', { method: 'PUT', json: { firstName: first.trim(), lastName: last.trim(), phone: phone.trim() || null, notificationChannels: channels } })
      await refreshUser()
      setMessage('Saved.')
    } catch (err) {
      setMessage(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Profile" description="Your contact details, notification choices and a copy of your data." />
      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className="flex flex-col gap-10 lg:col-span-3">
          <Panel title="Personal details">
            <div className="mb-5 flex items-center gap-4">
              <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-wine font-display text-xl font-semibold text-blush">
                {initials}
              </span>
              <div>
                <p className="text-lg font-semibold">{name}</p>
                <p className="text-ink-soft">{ROLE_LABEL[role]}{detail ? `, ${detail}` : ''}</p>
              </div>
            </div>
            <form className="flex flex-col gap-4" onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={ids.first} className="mb-1 block font-medium">First name</label>
                  <input id={ids.first} className={field} value={first} onChange={(e) => setFirst(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor={ids.last} className="mb-1 block font-medium">Last name</label>
                  <input id={ids.last} className={field} value={last} onChange={(e) => setLast(e.target.value)} required />
                </div>
              </div>
              <div>
                <label htmlFor={ids.email} className="mb-1 block font-medium">University e-mail</label>
                <input id={ids.email} className={`${field} opacity-80`} value={user.email} readOnly />
              </div>
              <div>
                <label htmlFor={ids.phone} className="mb-1 block font-medium">Phone</label>
                <input id={ids.phone} className={field} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
              </div>
              <fieldset>
                <legend className="mb-2 font-medium">Notifications</legend>
                <div className="flex flex-col gap-2">
                  {CHANNELS.map((c) => (
                    <label key={c.key} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="size-5 accent-wine"
                        checked={channels[c.key]}
                        onChange={(e) => setChannels((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit">Save changes</Button>
              <p role="status" aria-live="polite" className="text-sm text-ink-soft">{message}</p>
            </form>
          </Panel>
        </div>

        <div className="lg:col-span-2">
          <Panel title="Your data">
            <p className="mb-4">Download a copy of the personal data the platform holds about you.</p>
            <Button variant="secondary" onClick={() => download('/users/me/export', {}, 'my-educore-data.json').catch((e) => setMessage(errorMessage(e)))}>
              <Download aria-hidden="true" className="mr-2 size-4" />
              Download my data (JSON)
            </Button>
          </Panel>
        </div>
      </div>
    </>
  )
}
