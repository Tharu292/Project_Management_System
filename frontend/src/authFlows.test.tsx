import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { apiRequest } from './api/client'
import { getToken } from './auth/tokenStorage'
import {
  ADMIN_USERS,
  CHANGE_REQUIRED_MESSAGE,
  LOGIN,
  ME,
  renderAt,
  renderSignedInAt,
  signIn,
} from './test/appHarness'
import {
  TEST_PASSWORD,
  TEST_TOKEN,
  admin,
  adminUserList,
  apiError,
  flaggedAdmin,
  flaggedStaff,
  json,
  loginResponse,
  mockBackend,
  staff,
  student,
} from './test/mockBackend'
import type { User } from './auth/types'

const adminBackend = { [ADMIN_USERS]: () => json(200, adminUserList) }

const HEADINGS = {
  signIn: 'Sign in',
  changePassword: 'Change your password',
  adminDashboard: 'Admin dashboard',
  userDashboard: /^Welcome, /,
}

describe('one sign-in form for every kind of account', () => {
  it('sends a student to the user dashboard, with no administration menu', async () => {
    mockBackend({ [LOGIN]: () => loginResponse(student) })
    const user = userEvent.setup()
    renderAt('/login')

    await signIn(user, student.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Administration' })).toBeNull()
    expect(screen.queryByText(/admin/i)).toBeNull()
  })

  it('sends a staff member to the same user dashboard and assumes no project role', async () => {
    const backend = mockBackend({ [LOGIN]: () => loginResponse(staff) })
    const user = userEvent.setup()
    renderAt('/login')

    await signIn(user, staff.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(screen.getByText('STF-0001')).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Administration' })).toBeNull()
    expect(screen.queryByText(/supervisor|evaluator/i)).toBeNull()
    expect(backend.callsTo(LOGIN)[0].body).toEqual({ email: staff.email, password: TEST_PASSWORD })
  })

  it('sends an administrator to the admin dashboard', async () => {
    const backend = mockBackend({ [LOGIN]: () => loginResponse(admin), ...adminBackend })
    const user = userEvent.setup()
    renderAt('/login')

    await signIn(user, admin.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: HEADINGS.adminDashboard })).toBeDefined()
    expect(screen.getByRole('navigation', { name: 'Administration' })).toBeDefined()
    expect(backend.callsTo(LOGIN)[0].body).toEqual({ email: admin.email, password: TEST_PASSWORD })
  })

  it('offers no account-type, role or project-role choice on the sign-in form', () => {
    mockBackend({})
    renderAt('/login')

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByLabelText(/role|account type|staff|admin/i)).toBeNull()
  })

  it('does not decide the destination from the email domain', async () => {
    // An @sliit.lk address with system role USER is an ordinary user, not an administrator.
    mockBackend({ [LOGIN]: () => loginResponse({ ...staff, email: 'admin@sliit.lk' }) })
    const user = userEvent.setup()
    renderAt('/login')

    await signIn(user, 'admin@sliit.lk', TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Administration' })).toBeNull()
  })

  it('shows the backend’s generic message for a disabled account', async () => {
    mockBackend({ [LOGIN]: () => apiError(401, 'Invalid email or password.') })
    const user = userEvent.setup()
    renderAt('/login')

    await signIn(user, staff.email, TEST_PASSWORD)

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password.')
    expect(getToken()).toBeNull()
  })
})

describe('a user who must change their password', () => {
  it('is sent straight to the change-password page after signing in as staff', async () => {
    const backend = mockBackend({ [LOGIN]: () => loginResponse(flaggedStaff) })
    const user = userEvent.setup()
    renderAt('/login')

    await signIn(user, flaggedStaff.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: HEADINGS.changePassword })).toBeDefined()
    expect(screen.queryByRole('heading', { name: HEADINGS.userDashboard })).toBeNull()
    expect(getToken()).toBe(TEST_TOKEN)
    expect(backend.calls).toHaveLength(1)
  })

  it('is sent to the change-password page as an administrator, and no admin data is requested', async () => {
    const backend = mockBackend({ [LOGIN]: () => loginResponse(flaggedAdmin), ...adminBackend })
    const user = userEvent.setup()
    renderAt('/login')

    await signIn(user, flaggedAdmin.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: HEADINGS.changePassword })).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Administration' })).toBeNull()
    expect(backend.callsTo(ADMIN_USERS)).toHaveLength(0)
  })

  it('goes to the change-password page even when they first asked for another page', async () => {
    mockBackend({ [LOGIN]: () => loginResponse(flaggedAdmin), ...adminBackend })
    const user = userEvent.setup()
    renderAt('/admin/users')
    await screen.findByRole('heading', { name: HEADINGS.signIn })

    await signIn(user, flaggedAdmin.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: HEADINGS.changePassword })).toBeDefined()
  })

  it.each(['/dashboard', '/admin/dashboard', '/admin/users', '/admin/users/new-staff', '/', '/nowhere'])(
    'is kept on the change-password page when a restored session opens %s',
    async (path) => {
      const backend = mockBackend({ [ME]: () => json(200, flaggedAdmin), ...adminBackend })
      renderSignedInAt(path)

      expect(await screen.findByRole('heading', { name: HEADINGS.changePassword })).toBeDefined()
      expect(screen.queryByRole('heading', { name: HEADINGS.adminDashboard })).toBeNull()
      expect(backend.callsTo(ADMIN_USERS)).toHaveLength(0)
    },
  )

  it('can still log out', async () => {
    mockBackend({ [ME]: () => json(200, flaggedStaff) })
    const user = userEvent.setup()
    renderSignedInAt('/change-password')
    await screen.findByRole('heading', { name: HEADINGS.changePassword })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: HEADINGS.signIn })).toBeDefined()
    expect(getToken()).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('is redirected as soon as the backend reports the flag, after a 403 on another request', async () => {
    let current: User = staff
    const backend = mockBackend({
      [ME]: () => json(200, current),
      'GET /api/v1/projects/x': () => apiError(403, CHANGE_REQUIRED_MESSAGE),
    })
    renderSignedInAt('/dashboard')
    await screen.findByRole('heading', { name: 'Welcome, Test' })

    current = flaggedStaff
    await expect(apiRequest('/api/v1/projects/x', { auth: true })).rejects.toMatchObject({
      status: 403,
      message: CHANGE_REQUIRED_MESSAGE,
    })

    expect(await screen.findByRole('heading', { name: HEADINGS.changePassword })).toBeDefined()
    expect(getToken()).toBe(TEST_TOKEN)
    expect(backend.callsTo(ME)).toHaveLength(2)
  })

  it('stays where they are after an ordinary 403', async () => {
    const backend = mockBackend({
      [ME]: () => json(200, staff),
      'GET /api/v1/projects/x': () => apiError(403, 'You do not have permission to do this.'),
    })
    renderSignedInAt('/dashboard')
    await screen.findByRole('heading', { name: 'Welcome, Test' })

    await expect(apiRequest('/api/v1/projects/x', { auth: true })).rejects.toMatchObject({ status: 403 })
    await waitFor(() => expect(backend.callsTo(ME)).toHaveLength(2))

    expect(screen.getByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(getToken()).toBe(TEST_TOKEN)
  })
})

describe('session restoration', () => {
  it('opens the admin dashboard for an administrator at the root path', async () => {
    mockBackend({ [ME]: () => json(200, admin), ...adminBackend })
    renderSignedInAt('/')

    expect(await screen.findByRole('heading', { name: HEADINGS.adminDashboard })).toBeDefined()
  })

  it('opens the user dashboard for a student at the root path', async () => {
    mockBackend({ [ME]: () => json(200, student) })
    renderSignedInAt('/')

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
  })

  it('renders nothing protected until the backend has answered', async () => {
    let release!: (response: Response) => void
    const answer = new Promise<Response>((resolve) => {
      release = resolve
    })
    mockBackend({ [ME]: () => answer, ...adminBackend })
    renderSignedInAt('/admin/users')

    expect(screen.getByRole('status').textContent).toContain('Checking your session')
    expect(screen.queryByRole('heading', { name: 'User management' })).toBeNull()

    release(json(200, flaggedAdmin))
    expect(await screen.findByRole('heading', { name: HEADINGS.changePassword })).toBeDefined()
  })

  it('clears an invalid token, returns to sign-in and says why', async () => {
    mockBackend({ [ME]: () => apiError(401, 'Authentication is required.') })
    renderSignedInAt('/admin/dashboard')

    expect(await screen.findByRole('heading', { name: HEADINGS.signIn })).toBeDefined()
    expect(getToken()).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Your session has ended. Please sign in again.')
  })

  it('signs out an administrator whose account stopped working mid-session', async () => {
    let listCalls = 0
    mockBackend({
      [ME]: () => json(200, admin),
      [ADMIN_USERS]: () => (++listCalls === 1 ? json(200, adminUserList) : apiError(401, 'Authentication is required.')),
    })
    const user = userEvent.setup()
    renderSignedInAt('/admin/dashboard')
    await screen.findByRole('group', { name: 'Total users' })

    await user.click(screen.getByRole('link', { name: 'User Management' }))

    expect(await screen.findByRole('heading', { name: HEADINGS.signIn })).toBeDefined()
    expect(getToken()).toBeNull()
  })
})

describe('route guards', () => {
  it.each(['/dashboard', '/change-password', '/admin', '/admin/dashboard', '/admin/users', '/admin/users/new-staff'])(
    'sends a signed-out visitor from %s to sign-in without calling the backend',
    async (path) => {
      const backend = mockBackend({})
      renderAt(path)

      expect(await screen.findByRole('heading', { name: HEADINGS.signIn })).toBeDefined()
      expect(backend.calls).toHaveLength(0)
    },
  )

  it.each([
    ['student', student],
    ['staff member', staff],
  ])('keeps a %s out of every admin page and requests no admin data', async (_label, account) => {
    for (const path of ['/admin', '/admin/dashboard', '/admin/users', '/admin/users/new-staff', `/admin/users/${admin.id}`]) {
      const backend = mockBackend({ [ME]: () => json(200, account) })
      const view = renderSignedInAt(path)

      expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
      expect(screen.getByRole('alert').textContent).toBe('You do not have permission to open that page.')
      expect(screen.queryByRole('navigation', { name: 'Administration' })).toBeNull()
      expect(backend.calls.every((call) => call.path === '/api/v1/auth/me')).toBe(true)
      view.unmount()
    }
  })

  it('does not return a non-administrator to an admin page they asked for before signing in', async () => {
    const backend = mockBackend({ [LOGIN]: () => loginResponse(staff) })
    const user = userEvent.setup()
    renderAt('/admin/users')
    await screen.findByRole('heading', { name: HEADINGS.signIn })

    await signIn(user, staff.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(backend.calls).toHaveLength(1)
  })

  it('returns an administrator to the admin page they asked for before signing in', async () => {
    mockBackend({ [LOGIN]: () => loginResponse(admin), ...adminBackend })
    const user = userEvent.setup()
    renderAt('/admin/users')
    await screen.findByRole('heading', { name: HEADINGS.signIn })

    await signIn(user, admin.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'User management' })).toBeDefined()
  })

  it.each([
    ['student', student, 'Welcome, Test'],
    ['administrator', admin, HEADINGS.adminDashboard],
  ])('sends a %s who does not need to change their password away from /change-password', async (_label, account, heading) => {
    mockBackend({ [ME]: () => json(200, account), ...adminBackend })
    renderSignedInAt('/change-password')

    expect(await screen.findByRole('heading', { name: heading })).toBeDefined()
    expect(screen.queryByRole('heading', { name: HEADINGS.changePassword })).toBeNull()
  })

  it('settles on one page for every kind of user and path, without redirect loops', async () => {
    const accounts: [User | null, string | RegExp][] = [
      [null, HEADINGS.signIn],
      [flaggedStaff, HEADINGS.changePassword],
      [flaggedAdmin, HEADINGS.changePassword],
    ]
    const paths = ['/', '/login', '/register', '/change-password', '/dashboard', '/admin', '/admin/users', '/unknown']
    for (const [account, heading] of accounts) {
      for (const path of paths) {
        if (account === null && path === '/register') continue
        const backend = mockBackend(account === null ? {} : { [ME]: () => json(200, account) })
        const view = account === null ? renderAt(path) : renderSignedInAt(path)

        expect(await screen.findByRole('heading', { name: heading })).toBeDefined()
        // One session check at most: a loop would keep re-rendering guards and re-requesting.
        expect(backend.calls.length).toBeLessThanOrEqual(1)
        view.unmount()
        sessionStorage.clear()
      }
    }
  })

  it('lets an administrator open the ordinary dashboard too, keeping the administration menu', async () => {
    mockBackend({ [ME]: () => json(200, admin) })
    renderSignedInAt('/dashboard')

    expect(await screen.findByRole('heading', { name: 'Welcome, System' })).toBeDefined()
    expect(screen.getByRole('navigation', { name: 'Administration' })).toBeDefined()
  })
})
