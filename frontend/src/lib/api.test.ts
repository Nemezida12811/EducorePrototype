import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, demoAccounts, demoLogin, login, logout, onSignedOut } from './api'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const user = { id: 'u1', email: 'student1@educore.example', firstName: 'S', lastName: 'One', role: 'student', twoFactorEnabled: false }
const tokens = { accessToken: 'acc-1', refreshToken: 'ref-1', user }

const fetchMock = vi.fn<typeof fetch>()

beforeEach(async () => {
  await new Promise((r) => setTimeout(r, 5)) // api.ts clears its shared in-flight refresh on a timer; let the previous test's one expire
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  sessionStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

describe('demo sign-in', () => {
  it('lists the roles the server offers', async () => {
    fetchMock.mockResolvedValue(json({ items: [{ role: 'student', email: 'x' }, { role: 'admin', email: 'y' }] }))
    expect(await demoAccounts()).toEqual(['student', 'admin'])
    expect(String(fetchMock.mock.calls[0]![0])).toBe('/api/v1/auth/demo-accounts')
  })

  it('returns no roles when the feature is off (404) or the server is unreachable', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'not_found', message: 'Demo sign-in not found' }, 404))
    expect(await demoAccounts()).toEqual([])
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await demoAccounts()).toEqual([])
  })

  it('posts the role, keeps the refresh token and returns the user', async () => {
    fetchMock.mockResolvedValue(json(tokens))
    expect(await demoLogin('teacher')).toEqual(user)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe('/api/v1/auth/demo-login')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ role: 'teacher' })
    expect(sessionStorage.getItem('educore.rt')).toBe('ref-1')
  })

  it('surfaces the server error', async () => {
    fetchMock.mockResolvedValue(json({ error: 'not_found', message: 'Demo account not found' }, 404))
    await expect(demoLogin('admin')).rejects.toMatchObject({ status: 404, message: 'Demo account not found' })
  })
})

describe('session', () => {
  it('login stores the refresh token and sends the access token on the next request', async () => {
    fetchMock.mockResolvedValueOnce(json(tokens)).mockResolvedValueOnce(json({ ok: true }))
    expect(await login(user.email, 'pw')).toEqual({ user })
    await api('/users/me')
    const headers = new Headers(fetchMock.mock.calls[1]![1]?.headers)
    expect(headers.get('authorization')).toBe('Bearer acc-1')
    expect(sessionStorage.getItem('educore.rt')).toBe('ref-1')
  })

  it('login reports a two-factor challenge instead of a user', async () => {
    fetchMock.mockResolvedValue(json({ twoFactorRequired: true, challengeToken: 'chal' }))
    expect(await login(user.email, 'pw')).toEqual({ twoFactorRequired: true, challengeToken: 'chal' })
    expect(sessionStorage.getItem('educore.rt')).toBeNull()
  })

  it('wrong credentials throw an ApiError with the server message', async () => {
    fetchMock.mockResolvedValue(json({ error: 'unauthorized', message: 'Invalid e-mail or password' }, 401))
    const err = await login('a@b.sk', 'bad').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 401, code: 'unauthorized', message: 'Invalid e-mail or password' })
  })

  it('refreshes once and retries when the access token expired, even for parallel requests', async () => {
    fetchMock.mockResolvedValueOnce(json(tokens)) // login
    await login(user.email, 'pw')
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/auth/refresh')) return json({ accessToken: 'acc-2', refreshToken: 'ref-2' })
      const auth = new Headers(init?.headers).get('authorization')
      return auth === 'Bearer acc-2' ? json({ ok: true }) : json({ error: 'unauthorized', message: 'expired' }, 401)
    })
    await Promise.all([api('/courses'), api('/grades/me')])
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh'))
    expect(refreshCalls).toHaveLength(1)
    expect(sessionStorage.getItem('educore.rt')).toBe('ref-2')
  })

  it('signs out locally when the refresh token is rejected', async () => {
    fetchMock.mockResolvedValueOnce(json(tokens))
    await login(user.email, 'pw')
    const out = vi.fn()
    const off = onSignedOut(out)
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input) => (String(input).endsWith('/auth/refresh') ? json({ error: 'unauthorized', message: 'no' }, 401) : json({ error: 'unauthorized', message: 'expired' }, 401)))
    await expect(api('/courses')).rejects.toBeInstanceOf(ApiError)
    expect(out).toHaveBeenCalled()
    expect(sessionStorage.getItem('educore.rt')).toBeNull()
    off()
  })

  it('logout clears the stored session even if the server call fails', async () => {
    fetchMock.mockResolvedValueOnce(json(tokens))
    await login(user.email, 'pw')
    fetchMock.mockReset()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await logout().catch(() => undefined)
    expect(sessionStorage.getItem('educore.rt')).toBeNull()
  })
})
