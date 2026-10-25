import { useId, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel } from '../components/ui/Panel'
import { studentGrades, users } from '../data/demo'
import { downloadFile } from '../lib/download'
import { useDemo } from '../state/DemoContext'
import { useMine } from '../state/useMine'

const TYPES = ['New grade', 'Enrollment approved', 'Upcoming deadline', 'New notice']
const ROLE_LABEL = { student: 'Student', instructor: 'Instructor', admin: 'Administrator', superadmin: 'Super administrator' }
const field = 'min-h-11 w-full rounded-md border-2 border-wine bg-fog px-3 text-wine'

export function ProfilePage() {
  const { role } = useDemo()
  const mine = useMine()
  const user = users[role]
  const emailId = useId()
  const phoneId = useId()
  const [phone, setPhone] = useState('+421 900 000 000')
  const [message, setMessage] = useState('')
  const [prefs, setPrefs] = useState<Record<string, { app: boolean; email: boolean }>>(
    Object.fromEntries(TYPES.map((t) => [t, { app: true, email: t !== 'New notice' }])),
  )

  const email = `${user.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '.')}@educore.example`

  const exportData = () =>
    downloadFile(
      'my-educore-data.json',
      'application/json',
      JSON.stringify(
        {
          profile: { name: user.name, email, phone, role: ROLE_LABEL[role], detail: user.detail },
          courses: mine.courses.map((c) => ({ code: c.code, name: c.name })),
          grades: role === 'student' ? studentGrades : undefined,
          notificationPreferences: prefs,
        },
        null,
        2,
      ),
    )

  return (
    <>
      <PageHeader title="Profile" description="Your contact details, notification choices and a copy of your data." />
      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-5">
        <div className="flex flex-col gap-10 lg:col-span-2">
          <Panel title="Personal details">
            <div className="mb-5 flex items-center gap-4">
              <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-wine font-display text-xl font-semibold text-blush">
                {user.initials}
              </span>
              <div>
                <p className="text-lg font-semibold">{user.name}</p>
                <p className="text-ink-soft">{ROLE_LABEL[role]}, {user.detail}</p>
              </div>
            </div>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                setMessage('Contact details saved for this session.')
              }}
            >
              <div>
                <label htmlFor={emailId} className="mb-1 block font-medium">University e-mail</label>
                <input id={emailId} className={`${field} opacity-80`} value={email} readOnly />
              </div>
              <div>
                <label htmlFor={phoneId} className="mb-1 block font-medium">Phone</label>
                <input id={phoneId} className={field} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
              </div>
              <Button type="submit">Save changes</Button>
              <p role="status" aria-live="polite" className="text-sm text-ink-soft">{message}</p>
            </form>
          </Panel>
          <Panel title="Your data">
            <p className="mb-4">Download a copy of the personal data this demo holds about you.</p>
            <Button variant="secondary" onClick={exportData}>
              <Download aria-hidden="true" className="mr-2 size-4" />
              Download my data (JSON)
            </Button>
          </Panel>
        </div>

        <div className="lg:col-span-3">
          <Panel title="Notification preferences" flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] border-collapse text-left">
                <caption className="sr-only">Choose how you want to be notified about each event</caption>
                <thead>
                  <tr className="bg-rose">
                    <th scope="col" className="px-5 py-3 pl-6 text-sm font-semibold">Event</th>
                    <th scope="col" className="px-5 py-3 text-sm font-semibold">In-app</th>
                    <th scope="col" className="px-5 py-3 pr-6 text-sm font-semibold">E-mail</th>
                  </tr>
                </thead>
                <tbody>
                  {TYPES.map((t) => (
                    <tr key={t} className="border-b border-rose last:border-b-0">
                      <th scope="row" className="px-5 py-3.5 pl-6 font-semibold">{t}</th>
                      {(['app', 'email'] as const).map((ch) => (
                        <td key={ch} className="px-5 py-3.5 last:pr-6">
                          <input
                            type="checkbox"
                            className="size-5 accent-wine"
                            checked={prefs[t][ch]}
                            aria-label={`${t}, ${ch === 'app' ? 'in-app' : 'e-mail'}`}
                            onChange={(e) => setPrefs((p) => ({ ...p, [t]: { ...p[t], [ch]: e.target.checked } }))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}
