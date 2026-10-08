import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getToken } from './auth/tokenStorage'
import type { AdminUser } from './auth/types'
import {
  ADMIN_USERS,
  CREATE_STAFF,
  ME,
  everythingLogged,
  fillFields,
  inputValue,
  renderSignedInAt,
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
  disabledStudent,
  json,
  mockBackend,
  newStaffAccount,
  staff,
  student,
} from './test/mockBackend'

type Routes = Parameters<typeof mockBackend>[0]

const enabledPath = (id: string) => `PATCH /api/v1/admin/users/${id}/enabled`
const userPath = (id: string) => `GET /api/v1/admin/users/${id}`

function openAsAdmin(path: string, routes: Routes = {}) {
  const backend = mockBackend({ [ME]: () => json(200, admin), [ADMIN_USERS]: () => json(200, adminUserList), ...routes })
  const user = userEvent.setup()
  renderSignedInAt(path)
  return { backend, user }
}

function rowFor(name: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(`^${name}`) })
}

function visibleNames(): string[] {
  return screen
    .getAllByRole('rowheader')
    .map((cell) => cell.querySelector('span')?.textContent ?? '')
}

describe('admin dashboard', () => {
  it('shows who is signed in and counts taken from the user list the backend returned', async () => {
    const { backend } = openAsAdmin('/admin/dashboard')

    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeDefined()
    expect(screen.getByText(`Signed in as System Administrator (${admin.email}), system administrator.`)).toBeDefined()

    const expected: Record<string, string> = {
      'Total users': '5',
      Students: '2',
      Staff: '3',
      Enabled: '4',
      Disabled: '1',
      'Password change pending': '1',
    }
    for (const [label, value] of Object.entries(expected)) {
      const card = await screen.findByRole('group', { name: label })
      expect(within(card).getByRole('definition').textContent).toBe(value)
    }
    expect(backend.callsTo(ADMIN_USERS)).toHaveLength(1)
    expect(backend.callsTo(ADMIN_USERS)[0].headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
  })

  it('follows the data: a different list gives different counts', async () => {
    openAsAdmin('/admin/dashboard', { [ADMIN_USERS]: () => json(200, adminUserList.slice(0, 2)) })

    const total = await screen.findByRole('group', { name: 'Total users' })
    expect(within(total).getByRole('definition').textContent).toBe('2')
    expect(within(screen.getByRole('group', { name: 'Disabled' })).getByRole('definition').textContent).toBe('0')
  })

  it('offers navigation to user management, staff creation and logout', async () => {
    const { user } = openAsAdmin('/admin/dashboard')
    await screen.findByRole('heading', { name: 'Admin dashboard' })

    const navigation = within(screen.getByRole('navigation', { name: 'Administration' }))
    expect(navigation.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Admin Dashboard',
      'User Management',
      'Create Staff',
    ])
    expect(navigation.getByRole('link', { name: 'Admin Dashboard' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Create staff account' })).toBeDefined()

    await user.click(navigation.getByRole('link', { name: 'User Management' }))
    expect(await screen.findByRole('heading', { name: 'User management' })).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(getToken()).toBeNull()
  })

  it('does not claim project access or show invented figures', async () => {
    openAsAdmin('/admin/dashboard')
    await screen.findByRole('group', { name: 'Total users' })

    expect(screen.getByText(/does not make you a member of any research project/)).toBeDefined()
    expect(screen.queryByText(/projects?:|active projects|submissions/i)).toBeNull()
  })

  it('shows a loading state, then an error with a working retry', async () => {
    const first = deferred()
    let attempts = 0
    openAsAdmin('/admin/dashboard', {
      [ADMIN_USERS]: () => (++attempts === 1 ? first.promise : json(200, adminUserList)),
    })
    const user = userEvent.setup()

    expect(await screen.findByText('Loading accounts…')).toBeDefined()
    first.resolve(json(500, { message: 'org.postgresql.util.PSQLException' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Something went wrong. Please try again.')
    expect(document.body.textContent).not.toContain('PSQLException')
    expect(screen.queryByRole('group', { name: 'Total users' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('group', { name: 'Total users' })).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows an empty state when the backend returns no accounts', async () => {
    openAsAdmin('/admin/dashboard', { [ADMIN_USERS]: () => json(200, []) })

    expect(await screen.findByText('There are no accounts yet.')).toBeDefined()
    expect(screen.queryByRole('group', { name: 'Total users' })).toBeNull()
  })
})

describe('user management', () => {
  it('lists every account with the safe fields the backend returns', async () => {
    openAsAdmin('/admin/users')

    expect(await screen.findByRole('table', { name: 'User accounts' })).toBeDefined()
    expect(visibleNames()).toEqual([
      'System Administrator',
      'Test Student',
      'Test Lecturer',
      'Former Member',
      'New Lecturer',
    ])
    expect(screen.getByRole('status').textContent).toBe('Showing 5 of 5 users')

    const studentRow = within(rowFor('Test Student'))
    expect(studentRow.getByText(student.email)).toBeDefined()
    expect(studentRow.getAllByText('Student').length).toBeGreaterThan(0)
    expect(studentRow.getByText('IT00000000')).toBeDefined()
    expect(studentRow.getByText('Enabled')).toBeDefined()
    expect(studentRow.getByText('2 Oct 2026')).toBeDefined()

    expect(within(rowFor('Former Member')).getByText('Disabled')).toBeDefined()
    expect(within(rowFor('New Lecturer')).getByText('Password change pending')).toBeDefined()
    expect(within(rowFor('New Lecturer')).getByText('STF-0002')).toBeDefined()
    expect(within(rowFor('System Administrator')).getAllByText('Administrator').length).toBeGreaterThan(0)
    expect(within(rowFor('System Administrator')).getByText('Not set')).toBeDefined()
  })

  it('never shows password, hash, token or security-version data, even if the backend sent some', async () => {
    const leaky = adminUserList.map((account) => ({
      ...account,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuv',
      securityVersion: 7,
    }))
    openAsAdmin('/admin/users', { [ADMIN_USERS]: () => json(200, leaky) })
    await screen.findByRole('table', { name: 'User accounts' })

    const page = document.body.innerHTML
    expect(page).not.toContain('$2a$')
    expect(page).not.toContain(TEST_TOKEN)
    expect(page.toLowerCase()).not.toContain('securityversion')
    expect(screen.queryByText(/security version|hash/i)).toBeNull()
  })

  it('searches the fetched list by name, email, registration number and staff ID', async () => {
    const { backend, user } = openAsAdmin('/admin/users')
    await screen.findByRole('table', { name: 'User accounts' })
    const search = screen.getByLabelText('Search users')

    await user.type(search, 'lecturer')
    expect(visibleNames()).toEqual(['Test Lecturer', 'New Lecturer'])
    expect(screen.getByRole('status').textContent).toBe('Showing 2 of 5 users')

    await user.clear(search)
    await user.type(search, '  IT1111 ')
    expect(visibleNames()).toEqual(['Former Member'])

    await user.clear(search)
    await user.type(search, 'stf-0002')
    expect(visibleNames()).toEqual(['New Lecturer'])

    await user.clear(search)
    await user.type(search, 'ADMIN@SLIIT')
    expect(visibleNames()).toEqual(['System Administrator'])

    await user.clear(search)
    expect(visibleNames()).toHaveLength(5)
    expect(backend.callsTo(ADMIN_USERS)).toHaveLength(1)
  })

  it('filters by account type and status, and says so when nothing matches', async () => {
    const { user } = openAsAdmin('/admin/users')
    await screen.findByRole('table', { name: 'User accounts' })

    await user.selectOptions(screen.getByLabelText('Account type'), 'STUDENT')
    expect(visibleNames()).toEqual(['Test Student', 'Former Member'])

    await user.selectOptions(screen.getByLabelText('Status'), 'DISABLED')
    expect(visibleNames()).toEqual(['Former Member'])

    await user.selectOptions(screen.getByLabelText('Account type'), 'STAFF')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('No users match the current search and filters.')).toBeDefined()
    expect(screen.getByRole('status').textContent).toBe('Showing 0 of 5 users')

    await user.selectOptions(screen.getByLabelText('Status'), 'PASSWORD_PENDING')
    expect(visibleNames()).toEqual(['New Lecturer'])

    await user.selectOptions(screen.getByLabelText('Status'), 'ENABLED')
    expect(visibleNames()).toEqual(['System Administrator', 'Test Lecturer', 'New Lecturer'])
  })

  it('shows loading, error with retry, and empty states', async () => {
    let attempts = 0
    const { user } = openAsAdmin('/admin/users', {
      [ADMIN_USERS]: () => {
        attempts += 1
        if (attempts === 1) return apiError(403, 'You do not have permission to do this.')
        return json(200, [])
      },
    })

    expect((await screen.findByRole('alert')).textContent).toBe('You do not have permission to do this.')
    expect(screen.queryByRole('table')).toBeNull()
    expect(getToken()).toBe(TEST_TOKEN)

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('There are no accounts yet.')).toBeDefined()
    expect(screen.queryByLabelText('Search users')).toBeNull()
  })

  it('offers no way to disable an administrator account', async () => {
    openAsAdmin('/admin/users')
    await screen.findByRole('table', { name: 'User accounts' })

    const adminRow = within(rowFor('System Administrator'))
    expect(adminRow.queryByRole('button')).toBeNull()
    expect(adminRow.getByText('Administrator accounts cannot be disabled here')).toBeDefined()
    expect(adminRow.getByRole('link', { name: 'View System Administrator' })).toBeDefined()
    expect(screen.queryByRole('button', { name: /System Administrator/ })).toBeNull()
  })

  it('asks for confirmation, and cancelling changes nothing', async () => {
    const { backend, user } = openAsAdmin('/admin/users')
    await screen.findByRole('table', { name: 'User accounts' })

    await user.click(screen.getByRole('button', { name: 'Disable Test Student' }))
    const dialog = screen.getByRole('dialog', { name: 'Disable Test Student?' })
    expect(within(dialog).getByText(/will be signed out immediately/)).toBeDefined()
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }))

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Disable Test Student' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(backend.calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
  })

  it('disables an account after confirmation and reloads the list', async () => {
    let users: AdminUser[] = adminUserList
    const { backend, user } = openAsAdmin('/admin/users', {
      [ADMIN_USERS]: () => json(200, users),
      [enabledPath(student.id)]: () => {
        users = users.map((account) => (account.id === student.id ? { ...account, enabled: false } : account))
        return json(200, users.find((account) => account.id === student.id))
      },
    })
    await screen.findByRole('table', { name: 'User accounts' })

    await user.click(screen.getByRole('button', { name: 'Disable Test Student' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable account' }))

    expect(await screen.findByText('Test Student has been disabled.')).toBeDefined()
    const call = backend.callsTo(enabledPath(student.id))[0]
    expect(call.body).toEqual({ enabled: false })
    expect(call.headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
    await waitFor(() => expect(backend.callsTo(ADMIN_USERS)).toHaveLength(2))
    expect(await within(rowFor('Test Student')).findByText('Disabled')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Enable Test Student' })).toBeDefined()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('enables a disabled account after confirmation', async () => {
    let users: AdminUser[] = adminUserList
    const { backend, user } = openAsAdmin('/admin/users', {
      [ADMIN_USERS]: () => json(200, users),
      [enabledPath(disabledStudent.id)]: () => {
        users = users.map((account) => (account.id === disabledStudent.id ? { ...account, enabled: true } : account))
        return json(200, users.find((account) => account.id === disabledStudent.id))
      },
    })
    await screen.findByRole('table', { name: 'User accounts' })

    await user.click(screen.getByRole('button', { name: 'Enable Former Member' }))
    const dialog = screen.getByRole('dialog', { name: 'Enable Former Member?' })
    await user.click(within(dialog).getByRole('button', { name: 'Enable account' }))

    expect(await screen.findByText('Former Member has been enabled.')).toBeDefined()
    expect(backend.callsTo(enabledPath(disabledStudent.id))[0].body).toEqual({ enabled: true })
    expect(await screen.findByRole('button', { name: 'Disable Former Member' })).toBeDefined()
  })

  it('keeps the dialog open with the backend’s reason when the change is refused, and sends it only once', async () => {
    const pending = deferred()
    const { backend, user } = openAsAdmin('/admin/users', { [enabledPath(staff.id)]: () => pending.promise })
    await screen.findByRole('table', { name: 'User accounts' })

    await user.click(screen.getByRole('button', { name: 'Disable Test Lecturer' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Disable account' }))

    const busy = (await within(dialog).findByRole('button', { name: 'Disabling…' })) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    await user.click(busy)
    expect(backend.callsTo(enabledPath(staff.id))).toHaveLength(1)

    pending.resolve(apiError(403, 'Administrator accounts cannot be enabled or disabled through this operation.'))
    expect((await within(dialog).findByRole('alert')).textContent).toBe(
      'Administrator accounts cannot be enabled or disabled through this operation.',
    )
    expect(within(rowFor('Test Lecturer')).getByText('Enabled')).toBeDefined()
    expect(screen.queryByText(/has been disabled/)).toBeNull()
  })

  it('opens one user’s details from the list, using the single-user endpoint', async () => {
    const { backend, user } = openAsAdmin('/admin/users', { [userPath(newStaffAccount.id)]: () => json(200, newStaffAccount) })
    await screen.findByRole('table', { name: 'User accounts' })

    await user.click(screen.getByRole('link', { name: 'View New Lecturer' }))

    expect(await screen.findByRole('heading', { name: 'New Lecturer' })).toBeDefined()
    expect(screen.getByText(newStaffAccount.email)).toBeDefined()
    expect(screen.getByText('STF-0002')).toBeDefined()
    expect(screen.getByText('Password change pending')).toBeDefined()
    expect(screen.getByText('7 Oct 2026')).toBeDefined()
    expect(screen.getByText(/Project roles are not shown here/)).toBeDefined()
    expect(backend.callsTo(userPath(newStaffAccount.id))).toHaveLength(1)

    await user.click(screen.getByRole('link', { name: /Back to user management/ }))
    expect(await screen.findByRole('heading', { name: 'User management' })).toBeDefined()
  })

  it('reports an unknown user and lets the status be changed from the details page', async () => {
    const missing = '99999999-0000-0000-0000-000000000000'
    openAsAdmin(`/admin/users/${missing}`, { [userPath(missing)]: () => apiError(404, 'User not found.') })
    expect((await screen.findByRole('alert')).textContent).toBe('User not found.')
  })

  it('changes status from the details page', async () => {
    const { user } = openAsAdmin(`/admin/users/${student.id}`, {
      [userPath(student.id)]: () => json(200, adminUserList[1]),
      [enabledPath(student.id)]: () => json(200, { ...adminUserList[1], enabled: false }),
    })
    await screen.findByRole('heading', { name: 'Test Student' })

    await user.click(screen.getByRole('button', { name: 'Disable Test Student' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Disable account' }))

    expect(await screen.findByText('Test Student has been disabled.')).toBeDefined()
    expect(screen.getByText('Disabled')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Enable Test Student' })).toBeDefined()
  })
})

describe('create staff account', () => {
  const VALID: Record<string, string> = {
    'First name': 'New',
    'Last name': 'Lecturer',
    'Staff email': newStaffAccount.email,
    'Staff ID': 'STF-0002',
    'Temporary password': TEST_PASSWORD,
    'Confirm temporary password': TEST_PASSWORD,
  }

  async function openForm(routes: Routes = {}) {
    const result = openAsAdmin('/admin/users/new-staff', routes)
    await screen.findByRole('heading', { name: 'Create staff account' })
    return result
  }

  async function submit(user: TestUser, overrides: Record<string, string> = {}) {
    await fillFields(user, { ...VALID, ...overrides })
    await user.click(screen.getByRole('button', { name: 'Create staff account' }))
  }

  it('offers only the fields the backend accepts', async () => {
    await openForm()

    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByLabelText(/role|account type|enabled|supervisor|evaluator|project/i)).toBeNull()
    expect(screen.getByText(/Must be an @sliit.lk address/)).toBeDefined()
    expect(screen.getByText(/Nothing is emailed/)).toBeDefined()
    expect(screen.getByText(/choose a new password the first time they sign in/)).toBeDefined()
  })

  it('submits the normalised payload once and confirms without revealing the password', async () => {
    const spies = spyOnConsole()
    const { backend, user } = await openForm({ [CREATE_STAFF]: () => json(201, newStaffAccount) })

    await submit(user, { 'First name': '  New ', 'Staff email': '  New.Lecturer@SLIIT.LK ', 'Staff ID': ' STF-0002 ' })

    expect(await screen.findByRole('heading', { name: 'Staff account created' })).toBeDefined()
    expect(screen.getByText(`An account for New Lecturer (${newStaffAccount.email}) has been created.`)).toBeDefined()
    expect(screen.getByText(/through a private channel/)).toBeDefined()

    const calls = backend.callsTo(CREATE_STAFF)
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toEqual({
      firstName: 'New',
      lastName: 'Lecturer',
      email: newStaffAccount.email,
      staffId: 'STF-0002',
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    })
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)

    expect(document.body.innerHTML).not.toContain(TEST_PASSWORD)
    expect(everythingLogged(spies)).not.toContain(TEST_PASSWORD)
    expect(JSON.stringify({ ...sessionStorage }) + JSON.stringify({ ...localStorage })).not.toContain(TEST_PASSWORD)
  })

  it('gives a clear next action after success', async () => {
    const { user } = await openForm({ [CREATE_STAFF]: () => json(201, newStaffAccount) })
    await submit(user)
    await screen.findByRole('heading', { name: 'Staff account created' })

    await user.click(screen.getByRole('button', { name: 'Create another staff account' }))
    expect(await screen.findByRole('heading', { name: 'Create staff account' })).toBeDefined()
    for (const label of Object.keys(VALID)) {
      expect(inputValue(label)).toBe('')
    }

    await submit(user)
    await screen.findByRole('heading', { name: 'Staff account created' })
    await user.click(screen.getByRole('link', { name: 'Go to user management' }))
    expect(await screen.findByRole('heading', { name: 'User management' })).toBeDefined()
    expect(document.body.innerHTML).not.toContain(TEST_PASSWORD)
  })

  it.each([
    ['a student address', 'someone@my.sliit.lk'],
    ['another domain', 'someone@gmail.com'],
    ['a look-alike domain', 'someone@sliit.lk.fake.com'],
    ['a look-alike prefix', 'someone@fake-sliit.lk'],
  ])('refuses %s before calling the backend', async (_case, email) => {
    const { backend, user } = await openForm()

    await submit(user, { 'Staff email': email })

    expect(await screen.findByText('Staff email must use the @sliit.lk domain.')).toBeDefined()
    expect(screen.getByLabelText('Staff email').getAttribute('aria-invalid')).toBe('true')
    expect(backend.callsTo(CREATE_STAFF)).toHaveLength(0)
  })

  it('validates required fields, the password policy and the confirmation before calling the backend', async () => {
    const { backend, user } = await openForm()

    await user.click(screen.getByRole('button', { name: 'Create staff account' }))
    expect(await screen.findByText('Enter a first name.')).toBeDefined()
    expect(screen.getByText('Enter a last name.')).toBeDefined()
    expect(screen.getByText('Enter a staff email address.')).toBeDefined()
    expect(screen.getByText('Enter a staff ID.')).toBeDefined()
    expect(screen.getByText(/Password must be at least 8 characters/)).toBeDefined()

    await submit(user, { 'Temporary password': 'OnlyLetters', 'Confirm temporary password': 'Different' })
    expect(await screen.findByText('Passwords do not match.')).toBeDefined()
    expect(screen.getByText(/at least one letter and one digit/, { selector: '[id$="-error"]' })).toBeDefined()
    expect(backend.callsTo(CREATE_STAFF)).toHaveLength(0)
  })

  it.each([
    ['email', 'An account with this email already exists.', 'Staff email'],
    ['staff ID', 'An account with this staff ID already exists.', 'Staff ID'],
  ])('reports a duplicate %s on the page and on the field', async (_case, message, label) => {
    const { user } = await openForm({ [CREATE_STAFF]: () => apiError(409, message) })

    await submit(user)

    expect((await screen.findByRole('alert')).textContent).toBe(message)
    const field = screen.getByLabelText(label)
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Create staff account' })).toBeDefined()
    // What was typed is kept, except the passwords.
    expect(inputValue('First name')).toBe('New')
    expect(inputValue('Temporary password')).toBe('')
    expect(inputValue('Confirm temporary password')).toBe('')
  })

  it('reports the combined duplicate message without guessing a field', async () => {
    const { user } = await openForm({
      [CREATE_STAFF]: () => apiError(409, 'An account with this email or staff ID already exists.'),
    })

    await submit(user)

    expect((await screen.findByRole('alert')).textContent).toBe('An account with this email or staff ID already exists.')
    expect(screen.getByLabelText('Staff email').getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByLabelText('Staff ID').getAttribute('aria-invalid')).toBeNull()
  })

  it('shows backend field errors', async () => {
    const { user } = await openForm({
      [CREATE_STAFF]: () =>
        apiError(400, 'Validation failed.', {
          staffId: 'size must be between 0 and 30',
          password: 'Password is too long. The limit is 72 bytes; accented and non-Latin characters count as more than one.',
        }),
    })

    await submit(user)

    expect(await screen.findByText('size must be between 0 and 30')).toBeDefined()
    expect(screen.getByText(/Password is too long/)).toBeDefined()
    expect(screen.getByLabelText('Temporary password').getAttribute('aria-invalid')).toBe('true')
  })

  it('cannot be submitted twice while the request is in flight', async () => {
    const pending = deferred()
    const { backend, user } = await openForm({ [CREATE_STAFF]: () => pending.promise })

    await submit(user)

    const busy = (await screen.findByRole('button', { name: 'Creating account…' })) as HTMLButtonElement
    expect(busy.disabled).toBe(true)
    await user.click(busy)
    expect(backend.callsTo(CREATE_STAFF)).toHaveLength(1)

    pending.resolve(json(201, newStaffAccount))
    expect(await screen.findByRole('heading', { name: 'Staff account created' })).toBeDefined()
    expect(backend.callsTo(CREATE_STAFF)).toHaveLength(1)
  })

  it('has show/hide controls for both password fields', async () => {
    const { user } = await openForm()
    const password = screen.getByLabelText('Temporary password') as HTMLInputElement

    expect(password.type).toBe('password')
    await user.click(screen.getByRole('button', { name: 'Show temporary password' }))
    expect(password.type).toBe('text')
    expect((screen.getByLabelText('Confirm temporary password') as HTMLInputElement).type).toBe('password')
    expect(screen.getByRole('button', { name: 'Show confirm temporary password' })).toBeDefined()
  })
})
