import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/Field'
import { Panel } from '../components/ui/Panel'
import { errorMessage } from '../data/actions'

/** Sign-in with an optional second step when the account has two-factor authentication on. */
export function LoginPage() {
  const { signIn, verifyCode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
    </main>
  )
}
