import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { apiRequest } from './api/client'
import { getToken, setToken } from './auth/tokenStorage'
import { TEST_PASSWORD, TEST_TOKEN, apiError, deferred, json, mockBackend, student } from './test/mockBackend'

const LOGIN = 'POST /api/v1/auth/login'
const REGISTER = 'POST /api/v1/auth/register/student'
const ME = 'GET /api/v1/auth/me'

const loginSuccess = () => json(200, { accessToken: TEST_TOKEN, tokenType: 'Bearer', expiresIn: 3600, user: student })

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function spyOnConsole() {
  return (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {}),
  )
}

function everythingLogged(spies: ReturnType<typeof spyOnConsole>): string {
  return JSON.stringify(spies.flatMap((spy) => spy.mock.calls))
}

async function fillLogin(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
}

async function fillRegistration(user: ReturnType<typeof userEvent.setup>, overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    'First name': 'Test',
    'Last name': 'Student',
    'Student email': student.email,
    'Registration number': 'it00000000',
    Password: TEST_PASSWORD,
    'Confirm password': TEST_PASSWORD,
    ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    await user.type(screen.getByLabelText(label), value)
  }
}

describe('login', () => {
  it('signs in, stores the token in sessionStorage and shows the dashboard', async () => {
    const backend = mockBackend({ [LOGIN]: loginSuccess })
    const user = userEvent.setup()
    renderAt('/login')

    await fillLogin(user, student.email, TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(screen.getByText(student.email)).toBeDefined()
    expect(backend.callsTo(LOGIN)[0].body).toEqual({ email: student.email, password: TEST_PASSWORD })
    expect(getToken()).toBe(TEST_TOKEN)
    expect(localStorage.length).toBe(0)
  })

  it('shows the backend’s generic message for invalid credentials and stays signed out', async () => {
    mockBackend({ [LOGIN]: () => apiError(401, 'Invalid email or password.') })
    const user = userEvent.setup()
    renderAt('/login')

    await fillLogin(user, student.email, 'Wrong-Passw0rd')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password.')
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(getToken()).toBeNull()
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(student.email)
  })

  it('disables the form while signing in so it cannot be submitted twice', async () => {
    const pending = deferred()
    const backend = mockBackend({ [LOGIN]: () => pending.promise })
    const user = userEvent.setup()
    renderAt('/login')

    await fillLogin(user, student.email, TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const busyButton = await screen.findByRole('button', { name: 'Signing in…' })
    expect((busyButton as HTMLButtonElement).disabled).toBe(true)
    await user.click(busyButton)
    await user.type(screen.getByLabelText('Password'), '{Enter}')
    expect(backend.callsTo(LOGIN)).toHaveLength(1)

    pending.resolve(loginSuccess())
    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(backend.callsTo(LOGIN)).toHaveLength(1)
  })

  it('never stores or logs the password, the token or the Authorization header', async () => {
    const spies = spyOnConsole()
    mockBackend({ [LOGIN]: loginSuccess, [ME]: () => json(200, student) })
    const user = userEvent.setup()
    renderAt('/login')

    await fillLogin(user, student.email, TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findByRole('heading', { name: 'Welcome, Test' })
    await apiRequest('/api/v1/auth/me', { auth: true })

    const stored = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage })
    expect(stored).not.toContain(TEST_PASSWORD)
    expect(Object.keys(sessionStorage)).toHaveLength(1)
    const logged = everythingLogged(spies)
    expect(logged).not.toContain(TEST_PASSWORD)
    expect(logged).not.toContain(TEST_TOKEN)
    expect(logged).not.toContain('Bearer')
    expect(document.body.innerHTML).not.toContain(TEST_TOKEN)
    expect(document.body.innerHTML).not.toContain(TEST_PASSWORD)
  })
})

describe('student registration', () => {
  it('sends exactly the backend’s fields, then goes to login without signing in', async () => {
    const backend = mockBackend({ [REGISTER]: () => json(201, student) })
    const user = userEvent.setup()
    renderAt('/register')

    await fillRegistration(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('Account created. Sign in to continue.')
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(student.email)
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')

    expect(backend.callsTo(REGISTER)[0].body).toEqual({
      firstName: 'Test',
      lastName: 'Student',
      email: student.email,
      registrationNumber: 'it00000000',
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    })
    expect(getToken()).toBeNull()
    expect(sessionStorage.length).toBe(0)
    expect(backend.callsTo(LOGIN)).toHaveLength(0)
    expect(backend.callsTo(ME)).toHaveLength(0)
  })

  it('shows the backend’s invalid-domain error on the email field', async () => {
    mockBackend({
      [REGISTER]: () =>
        apiError(400, 'Validation failed.', { email: 'Email must be a @my.sliit.lk student address.' }),
    })
    const user = userEvent.setup()
    renderAt('/register')

    await fillRegistration(user, { 'Student email': 'someone@gmail.com' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Email must be a @my.sliit.lk student address.')).toBeDefined()
    const emailInput = screen.getByLabelText('Student email')
    expect(emailInput.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Create a student account' })).toBeDefined()
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
    expect(getToken()).toBeNull()
  })

  it('reports a duplicate account', async () => {
    mockBackend({ [REGISTER]: () => apiError(409, 'An account with this email already exists.') })
    const user = userEvent.setup()
    renderAt('/register')

    await fillRegistration(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect((await screen.findByRole('alert')).textContent).toBe('An account with this email already exists.')
    expect(screen.getByRole('heading', { name: 'Create a student account' })).toBeDefined()
  })

  it('stops mismatched passwords before calling the backend', async () => {
    const backend = mockBackend({})
    const user = userEvent.setup()
    renderAt('/register')

    await fillRegistration(user, { 'Confirm password': 'Different-Passw0rd' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Passwords do not match.')).toBeDefined()
    expect(backend.calls).toHaveLength(0)
  })

  it('tells students which email domain is required and offers no role or staff fields', () => {
    mockBackend({})
    renderAt('/register')

    expect(screen.getByText('Must be your @my.sliit.lk student address.')).toBeDefined()
    expect(screen.queryByLabelText(/role|account type|staff/i)).toBeNull()
  })
})

describe('session', () => {
  it('restores the user from /auth/me after a reload', async () => {
    setToken(TEST_TOKEN)
    const backend = mockBackend({ [ME]: () => json(200, student) })
    renderAt('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(backend.callsTo(ME)[0].headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
    expect(getToken()).toBe(TEST_TOKEN)
  })

  it('shows a loading state, not the login page, while the session is being checked', async () => {
    setToken(TEST_TOKEN)
    const pending = deferred()
    mockBackend({ [ME]: () => pending.promise })
    renderAt('/dashboard')

    expect(screen.getByRole('status').textContent).toContain('Checking your session')
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull()
    expect(screen.queryByRole('heading', { name: /Welcome/ })).toBeNull()

    pending.resolve(json(200, student))
    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull()
  })

  it('clears an invalid or expired token and returns to login', async () => {
    setToken('expired.or.tampered')
    mockBackend({ [ME]: () => apiError(401, 'Authentication is required.') })
    renderAt('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(getToken()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('does not call the backend on startup when there is no token', async () => {
    const backend = mockBackend({})
    renderAt('/login')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(backend.calls).toHaveLength(0)
  })

  it('logout removes the token, clears the user and protects the dashboard again', async () => {
    setToken(TEST_TOKEN)
    const backend = mockBackend({ [ME]: () => json(200, student) })
    const user = userEvent.setup()
    renderAt('/dashboard')
    await screen.findByRole('heading', { name: 'Welcome, Test' })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(getToken()).toBeNull()
    expect(sessionStorage.length).toBe(0)
    expect(screen.queryByText(student.email)).toBeNull()
    expect(backend.calls.every((call) => call.path === '/api/v1/auth/me')).toBe(true)
  })

  it('a 401 on a later request signs the user out; a 403 does not', async () => {
    setToken(TEST_TOKEN)
    let meCalls = 0
    mockBackend({
      [ME]: () => (++meCalls === 1 ? json(200, student) : apiError(401, 'Authentication is required.')),
      'GET /api/v1/forbidden': () => apiError(403, 'You do not have permission to do this.'),
    })
    renderAt('/dashboard')
    await screen.findByRole('heading', { name: 'Welcome, Test' })

    await expect(apiRequest('/api/v1/forbidden', { auth: true })).rejects.toMatchObject({ status: 403 })
    expect(getToken()).toBe(TEST_TOKEN)
    expect(screen.getByRole('heading', { name: 'Welcome, Test' })).toBeDefined()

    await expect(apiRequest('/api/v1/auth/me', { auth: true })).rejects.toMatchObject({ status: 401 })
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(getToken()).toBeNull()
  })
})

describe('routing', () => {
  it('redirects a signed-out visitor from a protected route to login', async () => {
    mockBackend({})
    renderAt('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: /Welcome/ })).toBeNull()
  })

  it('sends the root path and unknown paths through the same protection', async () => {
    mockBackend({})
    renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
  })

  it('after login returns the user to the protected page they asked for', async () => {
    mockBackend({ [LOGIN]: loginSuccess })
    const user = userEvent.setup()
    renderAt('/dashboard?tab=overview')
    await screen.findByRole('heading', { name: 'Sign in' })

    await fillLogin(user, student.email, TEST_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
  })

  it('never follows a return destination that points outside the app', async () => {
    for (const from of ['https://evil.example/', '//evil.example', '/\\evil.example', 'javascript:alert(1)', 42]) {
      setToken(TEST_TOKEN)
      mockBackend({ [ME]: () => json(200, student) })
      const view = render(
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { from } }]}>
          <App />
        </MemoryRouter>,
      )

      expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
      view.unmount()
    }
  })

  it('sends an already signed-in user away from login and register', async () => {
    setToken(TEST_TOKEN)
    mockBackend({ [ME]: () => json(200, student) })
    renderAt('/register')

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Create a student account' })).toBeNull())
  })
})
