import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './Login'

const auth = vi.hoisted(() => ({ signIn: vi.fn(), verifyCode: vi.fn(), demoSignIn: vi.fn() }))
const api = vi.hoisted(() => ({ demoAccounts: vi.fn() }))

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../lib/api', async (original) => ({ ...(await original<typeof import('../lib/api')>()), ...api }))

beforeEach(() => {
  vi.resetAllMocks()
  api.demoAccounts.mockResolvedValue([])
})

describe('sign-in form', () => {
  it('signs in with the typed e-mail (trimmed) and password', async () => {
    auth.signIn.mockResolvedValue('ok')
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('E-mail'), '  student1@educore.example ')
    await userEvent.type(screen.getByLabelText('Password'), 'secret-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth.signIn).toHaveBeenCalledWith('student1@educore.example', 'secret-password')
  })

  it('shows the error when the credentials are rejected', async () => {
    auth.signIn.mockRejectedValue(new Error('Invalid e-mail or password'))
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.sk')
    await userEvent.type(screen.getByLabelText('Password'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Invalid e-mail or password/)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  it('asks for the two-factor code when the account has 2FA on, then verifies it', async () => {
    auth.signIn.mockResolvedValue({ challengeToken: 'chal-1' })
    auth.verifyCode.mockResolvedValue(undefined)
    render(<LoginPage />)
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.sk')
    await userEvent.type(screen.getByLabelText('Password'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await userEvent.type(await screen.findByLabelText(/6-digit code/), ' 123456 ')
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }))
    expect(auth.verifyCode).toHaveBeenCalledWith('chal-1', '123456')
  })
})

describe('quick sign-in (testing)', () => {
  it('shows no buttons when the server does not offer demo accounts', async () => {
    render(<LoginPage />)
    await waitFor(() => expect(api.demoAccounts).toHaveBeenCalled())
    expect(screen.queryByText(/Quick sign-in/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('shows one button per offered role', async () => {
    api.demoAccounts.mockResolvedValue(['student', 'teacher', 'admin'])
    render(<LoginPage />)
    for (const name of ['Student', 'Teacher', 'Admin']) expect(await screen.findByRole('button', { name })).toBeInTheDocument()
  })

  it('only shows the roles the server offers', async () => {
    api.demoAccounts.mockResolvedValue(['student'])
    render(<LoginPage />)
    expect(await screen.findByRole('button', { name: 'Student' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Teacher' })).not.toBeInTheDocument()
  })

  it.each([['Student', 'student'], ['Teacher', 'teacher'], ['Admin', 'admin']])('%s button signs in as %s', async (label, role) => {
    api.demoAccounts.mockResolvedValue(['student', 'teacher', 'admin'])
    auth.demoSignIn.mockResolvedValue(undefined)
    render(<LoginPage />)
    await userEvent.click(await screen.findByRole('button', { name: label }))
    expect(auth.demoSignIn).toHaveBeenCalledWith(role)
  })

  it('shows the error and re-enables the buttons when demo sign-in fails', async () => {
    api.demoAccounts.mockResolvedValue(['admin'])
    auth.demoSignIn.mockRejectedValue(new Error('Demo account not found'))
    render(<LoginPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Admin' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Demo account not found/)
    expect(screen.getByRole('button', { name: 'Admin' })).toBeEnabled()
  })

  it('hides the buttons during the two-factor step', async () => {
    api.demoAccounts.mockResolvedValue(['admin'])
    auth.signIn.mockResolvedValue({ challengeToken: 'c' })
    render(<LoginPage />)
    await screen.findByRole('button', { name: 'Admin' })
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.sk')
    await userEvent.type(screen.getByLabelText('Password'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByLabelText(/6-digit code/)
    expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument()
  })
})
