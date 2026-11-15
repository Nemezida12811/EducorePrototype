import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { Panel } from '../components/ui/Panel'
import { errorMessage } from '../data/actions'
import { demoAccounts, type DemoRole } from '../lib/api'

const DEMO_LABELS: Record<DemoRole, string> = { student: 'Student', teacher: 'Teacher', admin: 'Admin' }

/** Sign-in with an optional second step when the account has two-factor authentication on. */
export function LoginPage() {
  const { signIn, verifyCode, demoSignIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [demo, setDemo] = useState<DemoRole[]>([])

  // Only present when the server runs with DEMO_LOGIN=true (testing); otherwise the list is empty and nothing is shown.
  useEffect(() => { demoAccounts().then(setDemo) }, [])

  const quick = async (role: DemoRole) => {
    setError('')
    setBusy(true)
    try { await demoSignIn(role) } catch (err) { setError(errorMessage(err)); setBusy(false) }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (challenge) {
        await verifyCode(challenge, code.trim())
      } else {
        const r = await signIn(email.trim(), password)
        if (r !== 'ok') setChallenge(r.challengeToken)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-8 px-4 py-10">
      <h1 className="text-center text-4xl font-semibold tracking-tight">EduCore</h1>
      <Panel title={challenge ? 'Two-factor code' : 'Sign in'}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {challenge ? (
            <TextField label="6-digit code from your authenticator app" value={code} onChange={setCode} autoComplete="one-time-code" required />
          ) : (
            <>
              <TextField label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="username" required />
              <TextField label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
            </>
          )}
          <Button type="submit" disabled={busy}>{busy ? 'Please wait…' : challenge ? 'Verify' : 'Sign in'}</Button>
          {challenge && (
            <Button variant="secondary" onClick={() => { setChallenge(null); setCode(''); setError('') }}>Back</Button>
          )}
          <p role="alert" className="font-semibold empty:hidden">{error}</p>
        </form>
      </Panel>
      {demo.length > 0 && !challenge && (
        <Panel title="Quick sign-in (testing)">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {demo.map((role) => (
                <Button key={role} variant="secondary" disabled={busy} onClick={() => quick(role)}>{DEMO_LABELS[role]}</Button>
              ))}
            </div>
            <p className="text-sm">Development build: signs in as a demo account without a password.</p>
          </div>
        </Panel>
      )}
    </main>
  )
}
