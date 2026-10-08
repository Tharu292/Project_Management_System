import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getToken } from './auth/tokenStorage'
import {
  ADMIN_USERS,
  CHANGE_PASSWORD,
  LOGIN,
  ME,
  everythingLogged,
  fillFields,
  inputValue,
  renderSignedInAt,
  signIn,
  spyOnConsole,
  type TestUser,
} from './test/appHarness'
import {
  TEST_PASSWORD,
  TEST_TOKEN,
  admin,
  adminUserList,
  apiError,
  deferred,
  flaggedAdmin,
  flaggedStaff,
  json,
  loginResponse,
  mockBackend,
  noContent,
  staff,
} from './test/mockBackend'

const NEW_PASSWORD = 'An0ther-Example-Passw0rd'
const HEADING = 'Change your password'

async function openForm(routes: Parameters<typeof mockBackend>[0] = {}) {
  const backend = mockBackend({ [ME]: () => json(200, flaggedStaff), ...routes })
  const user = userEvent.setup()
  renderSignedInAt('/change-password')
  await screen.findByRole('heading', { name: HEADING })
  return { backend, user }
}

async function submit(user: TestUser, current: string, next: string, confirmation: string) {
  await fillFields(user, {
    'Current password': current,
    'New password': next,
    'Confirm new password': confirmation,
  })
  await user.click(screen.getByRole('button', { name: 'Change password' }))
}

describe('change-password page', () => {
  it('explains why it is shown and what the new password needs', async () => {
    await openForm()

    expect(screen.getByText(/set up with a temporary password/)).toBeDefined()
    expect(screen.getByText(/you cannot use the rest of the system/)).toBeDefined()
    const requirements = screen.getByRole('list', { name: 'Your new password must have:' }).textContent
    expect(requirements).toContain('At least 8 characters')
    expect(requirements).toContain('At least one letter and one digit')
    expect(requirements).toContain('72 bytes')
    expect(screen.getByText(`Signed in as ${flaggedStaff.email}.`, { exact: false })).toBeDefined()
  })

  it('hides passwords by default and shows one only while its own control is on', async () => {
    const { user } = await openForm()
    const newPassword = screen.getByLabelText('New password') as HTMLInputElement
    const current = screen.getByLabelText('Current password') as HTMLInputElement
    await user.type(newPassword, NEW_PASSWORD)

    expect(newPassword.type).toBe('password')
    await user.click(screen.getByRole('button', { name: 'Show new password' }))
    expect(newPassword.type).toBe('text')
    expect(current.type).toBe('password')
    expect(screen.getByRole('button', { name: 'Hide new password' }).getAttribute('aria-pressed')).toBe('true')

    await user.click(screen.getByRole('button', { name: 'Hide new password' }))
    expect(newPassword.type).toBe('password')
    expect(newPassword.value).toBe(NEW_PASSWORD)
  })

  it.each([
    ['an empty form', '', '', '', 'Enter your current password.'],
    ['a short password', TEST_PASSWORD, 'Ab1', 'Ab1', 'Password must be at least 8 characters'],
    ['a password without a digit', TEST_PASSWORD, 'OnlyLetters', 'OnlyLetters', 'Password must be at least 8 characters and contain'],
    ['a password without a letter', TEST_PASSWORD, '1234567890', '1234567890', 'Password must be at least 8 characters and contain'],
    ['a password over 72 bytes', TEST_PASSWORD, 'Passw0rd' + 'a'.repeat(65), 'Passw0rd' + 'a'.repeat(65), 'Password is too long'],
    ['a short-looking password over 72 bytes', TEST_PASSWORD, 'Passw0rd' + 'é'.repeat(33), 'Passw0rd' + 'é'.repeat(33), 'Password is too long'],
    ['a mismatched confirmation', TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD + 'x', 'Passwords do not match.'],
    ['the current password again', TEST_PASSWORD, TEST_PASSWORD, TEST_PASSWORD, 'must be different from the current password'],
  ])('stops %s before calling the backend', async (_case, current, next, confirmation, message) => {
    const { backend, user } = await openForm()

    await submit(user, current, next, confirmation)

    expect(await screen.findByText(message, { exact: false })).toBeDefined()
    expect(backend.callsTo(CHANGE_PASSWORD)).toHaveLength(0)
    expect(screen.getByRole('heading', { name: HEADING })).toBeDefined()
    expect(getToken()).toBe(TEST_TOKEN)
  })

  it('marks the invalid field for assistive technology', async () => {
    const { user } = await openForm()

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, 'Different-Passw0rd')

    const confirmation = screen.getByLabelText('Confirm new password')
    expect(confirmation.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById(confirmation.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'Passwords do not match.',
    )
    expect(screen.getByLabelText('New password').getAttribute('aria-invalid')).toBeNull()
  })

  it('shows a wrong current password on its field, keeps the session and clears what was typed', async () => {
    const { backend, user } = await openForm({
      [CHANGE_PASSWORD]: () =>
        apiError(400, 'Validation failed.', { currentPassword: 'Current password is incorrect.' }),
    })

    await submit(user, 'Wrong-Passw0rd', NEW_PASSWORD, NEW_PASSWORD)

    expect(await screen.findByText('Current password is incorrect.')).toBeDefined()
    expect(screen.getByLabelText('Current password').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('heading', { name: HEADING })).toBeDefined()
    expect(getToken()).toBe(TEST_TOKEN)
    expect(inputValue('Current password')).toBe('')
    expect(inputValue('New password')).toBe('')
    expect(inputValue('Confirm new password')).toBe('')
    expect(backend.callsTo(CHANGE_PASSWORD)).toHaveLength(1)

    // The form can be used again straight away.
    expect((screen.getByRole('button', { name: 'Change password' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows backend validation errors on the fields they belong to', async () => {
    const { user } = await openForm({
      [CHANGE_PASSWORD]: () =>
        apiError(400, 'Validation failed.', {
          newPassword: 'New password must be different from the current password.',
          confirmPassword: 'Passwords do not match.',
        }),
    })

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)

    expect(await screen.findByText('New password must be different from the current password.')).toBeDefined()
    expect(screen.getByText('Passwords do not match.')).toBeDefined()
    expect(screen.getByRole('alert').textContent).toBe('Validation failed.')
  })

  it.each([
    ['a server error', () => json(500, { message: 'java.lang.IllegalStateException at com.example' }), 'Something went wrong. Please try again.'],
    ['an ordinary 403', () => apiError(403, 'You do not have permission to do this.'), 'You do not have permission to do this.'],
  ])('reports %s without leaving the page or exposing detail', async (_case, response, message) => {
    const { user } = await openForm({ [CHANGE_PASSWORD]: response })

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)

    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(document.body.textContent).not.toContain('IllegalStateException')
    expect(screen.getByRole('heading', { name: HEADING })).toBeDefined()
    expect(getToken()).toBe(TEST_TOKEN)
  })

  it('reports a network failure', async () => {
    const { user } = await openForm()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Cannot reach the server. Check your connection and try again.',
    )
    expect(getToken()).toBe(TEST_TOKEN)
  })

  it('returns to sign-in when the token has expired', async () => {
    const { user } = await openForm({ [CHANGE_PASSWORD]: () => apiError(401, 'Authentication is required.') })

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(getToken()).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Your session has ended. Please sign in again.')
  })

  it('disables the form while submitting so it cannot be sent twice', async () => {
    const pending = deferred()
    const { backend, user } = await openForm({ [CHANGE_PASSWORD]: () => pending.promise })

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)

    const busy = (await screen.findByRole('button', { name: 'Changing password…' })) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    expect((screen.getByLabelText('New password') as HTMLInputElement).disabled).toBe(true)
    await user.click(busy)
    expect(backend.callsTo(CHANGE_PASSWORD)).toHaveLength(1)

    pending.resolve(noContent())
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(backend.callsTo(CHANGE_PASSWORD)).toHaveLength(1)
  })
})

describe('a successful password change', () => {
  it('sends exactly the backend’s fields with the current token, then drops the session', async () => {
    const { backend, user } = await openForm({ [CHANGE_PASSWORD]: () => noContent() })

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('Password changed. Sign in with your new password.')
    const call = backend.callsTo(CHANGE_PASSWORD)[0]
    expect(call.body).toEqual({
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    })
    expect(call.headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
    expect(getToken()).toBeNull()
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(0)
    expect(inputValue('Password')).toBe('')
  })

  it('never reuses the old token: nothing authenticated is sent until the user signs in again', async () => {
    const freshToken = 'fresh.access.token'
    const { backend, user } = await openForm({
      [CHANGE_PASSWORD]: () => noContent(),
      [LOGIN]: () => json(200, { accessToken: freshToken, tokenType: 'Bearer', expiresIn: 3600, user: staff }),
    })

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)
    await screen.findByRole('heading', { name: 'Sign in' })
    const afterChange = backend.calls.length
    expect(backend.calls[afterChange - 1].path).toBe('/api/v1/auth/change-password')

    await signIn(user, staff.email, NEW_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    const later = backend.calls.slice(afterChange)
    expect(later.map((call) => `${call.method} ${call.path}`)).toEqual([LOGIN])
    expect(later[0].headers.Authorization).toBeUndefined()
    expect(later[0].body).toEqual({ email: staff.email, password: NEW_PASSWORD })
    expect(getToken()).toBe(freshToken)
    expect(JSON.stringify(backend.calls.slice(afterChange))).not.toContain(TEST_TOKEN)
    expect(screen.queryByText('Password changed. Sign in with your new password.')).toBeNull()
  })

  it('takes an administrator to the admin dashboard after signing in again', async () => {
    const backend = mockBackend({
      [ME]: () => json(200, flaggedAdmin),
      [CHANGE_PASSWORD]: () => noContent(),
      [LOGIN]: () => loginResponse(admin),
      [ADMIN_USERS]: () => json(200, adminUserList),
    })
    const user = userEvent.setup()
    renderSignedInAt('/admin/dashboard')
    await screen.findByRole('heading', { name: HEADING })
    expect(backend.callsTo(ADMIN_USERS)).toHaveLength(0)

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)
    await screen.findByRole('heading', { name: 'Sign in' })
    await signIn(user, admin.email, NEW_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeDefined()
  })

  it('never stores or logs any of the passwords', async () => {
    const spies = spyOnConsole()
    const { user } = await openForm({ [CHANGE_PASSWORD]: () => noContent() })

    await submit(user, TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)
    await screen.findByRole('heading', { name: 'Sign in' })

    const stored = JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage })
    const logged = everythingLogged(spies)
    for (const secret of [TEST_PASSWORD, NEW_PASSWORD, TEST_TOKEN]) {
      expect(stored).not.toContain(secret)
      expect(logged).not.toContain(secret)
      expect(document.body.innerHTML).not.toContain(secret)
    }
  })
})
