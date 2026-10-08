import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getToken } from '../../auth/tokenStorage'
import type { User } from '../../auth/types'
import { ADMIN_USERS, LOGIN, ME, renderAt, renderSignedInAt, signIn } from '../../test/appHarness'
import {
  TEST_PASSWORD,
  TEST_TOKEN,
  admin,
  adminUserList,
  apiError,
  deferred,
  flaggedStaff,
  groupAlpha,
  groupBeta,
  json,
  loginResponse,
  mockBackend,
  staff,
  staffGroups,
  student,
  studentGroups,
} from '../../test/mockBackend'
import type { MyGroup } from './api/types'
import { DEMO_BANNER_TEXT } from './demo/demoMode'

const MY_GROUPS = 'GET /api/v1/c4/me/groups'

const COMMON_SECTIONS = ['Contribution', 'Team progress', 'GitHub evidence', 'Assessment portfolio']
const WELLBEING_SECTIONS = ['Team wellbeing', 'My wellbeing']

afterEach(() => {
  vi.unstubAllEnvs()
})

function open(path: string, account: User, groups: MyGroup[] | (() => Response | Promise<Response>)) {
  const backend = mockBackend({
    [ME]: () => json(200, account),
    [MY_GROUPS]: typeof groups === 'function' ? groups : () => json(200, groups),
  })
  renderSignedInAt(path)
  return { backend, user: userEvent.setup() }
}

function sectionTabs(): string[] {
  return within(screen.getByRole('navigation', { name: 'Group sections' }))
    .getAllByRole('link')
    .map((link) => link.textContent ?? '')
}

function requestedPaths(backend: ReturnType<typeof mockBackend>): string[] {
  return [...new Set(backend.calls.map((call) => call.path))]
}

describe('my groups', () => {
  it('lists the student’s own groups with their role, from the backend', async () => {
    const { backend } = open('/groups', student, studentGroups)

    expect(await screen.findByRole('heading', { name: 'My groups' })).toBeDefined()
    const list = within(await screen.findByRole('list', { name: 'Your groups' }))
    expect(list.getAllByRole('listitem')).toHaveLength(1)
    expect(list.getByRole('heading', { name: 'Test project Alpha' })).toBeDefined()
    expect(list.getByText('TEST-ALPHA')).toBeDefined()
    expect(list.getByText('Student')).toBeDefined()
    expect(list.getByText('Active')).toBeDefined()

    const call = backend.callsTo(MY_GROUPS)[0]
    expect(call.headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
    expect(call.body).toBeUndefined()
    expect(backend.callsTo(MY_GROUPS)).toHaveLength(1)
  })

  it('lists each of a staff member’s groups with the role held there', async () => {
    open('/groups', staff, staffGroups)

    const items = within(await screen.findByRole('list', { name: 'Your groups' })).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Supervisor')).toBeDefined()
    expect(within(items[0]).queryByText('Evaluator')).toBeNull()
    expect(within(items[1]).getByText('Evaluator')).toBeDefined()
    expect(within(items[1]).getByText('Completed')).toBeDefined()
  })

  it('tells active, completed and archived groups apart in words, on the list and inside the group', async () => {
    const { user } = open('/groups', staff, [
      { ...groupAlpha, roles: ['SUPERVISOR'], status: 'ACTIVE' },
      { ...groupBeta, status: 'COMPLETED' },
      { ...groupBeta, projectId: 'cccccccc-3333-4333-8333-cccccccccccc', projectCode: 'TEST-GAMMA', title: 'Test project Gamma', status: 'ARCHIVED' },
    ])

    const items = within(await screen.findByRole('list', { name: 'Your groups' })).getAllByRole('listitem')
    expect(items.map((item) => within(item).getByText(/^(Active|Completed|Archived)$/).textContent)).toEqual([
      'Active',
      'Completed',
      'Archived',
    ])

    await user.click(screen.getByRole('link', { name: 'Open Test project Gamma' }))
    expect(
      within(await screen.findByRole('group', { name: 'Project status' })).getByText('Archived'),
    ).toBeDefined()
  })

  it('offers no way to change anything: every control is a link, apart from logging out', async () => {
    const { backend, user } = open('/groups', student, studentGroups)
    await screen.findByRole('list', { name: 'Your groups' })
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Log out'])
    expect(document.querySelector('form, input, select, textarea')).toBeNull()

    await user.click(screen.getByRole('link', { name: 'Open Test project Alpha' }))
    await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Log out'])
    expect(document.querySelector('form, input, select, textarea')).toBeNull()
    expect(backend.calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('shows a loading state until the backend answers', async () => {
    const pending = deferred()
    open('/groups', student, () => pending.promise)

    expect((await screen.findByText('Loading your groups…')).closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('list', { name: 'Your groups' })).toBeNull()

    pending.resolve(json(200, studentGroups))
    expect(await screen.findByRole('list', { name: 'Your groups' })).toBeDefined()
    expect(screen.queryByText('Loading your groups…')).toBeNull()
  })

  it('shows an empty state for a user with no groups', async () => {
    open('/groups', student, [])

    expect(await screen.findByText('You are not in any project group yet')).toBeDefined()
    expect(screen.queryByRole('list', { name: 'Your groups' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each([
    ['a server error', () => json(500, { message: 'org.postgresql.util.PSQLException' }), 'Something went wrong. Please try again.'],
    ['a refusal', () => apiError(403, 'You do not have permission to do this.'), 'You do not have permission to do this.'],
  ])('shows an error state for %s and never substitutes other data', async (_case, response, message) => {
    open('/groups', student, response)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Your groups could not be loaded')
    expect(alert.textContent).toContain(message)
    expect(document.body.textContent).not.toContain('PSQLException')
    expect(document.body.textContent).not.toContain('Demonstration')
    expect(screen.queryByRole('list', { name: 'Your groups' })).toBeNull()
    expect(getToken()).toBe(TEST_TOKEN)
  })

  it('reports an unreachable server and loads the groups on retry', async () => {
    let attempts = 0
    const { user } = open('/groups', student, () => {
      attempts += 1
      if (attempts === 1) throw new TypeError('Failed to fetch')
      return json(200, studentGroups)
    })

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Cannot reach the server. Check your connection and try again.',
    )

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('list', { name: 'Your groups' })).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('returns to sign-in when the session has ended', async () => {
    open('/groups', student, () => apiError(401, 'Authentication is required.'))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(getToken()).toBeNull()
  })
})

describe('opening a group', () => {
  it('opens a group from the list and shows the user’s role and the sections open to them', async () => {
    const { user } = open('/groups', student, studentGroups)

    await user.click(await screen.findByRole('link', { name: 'Open Test project Alpha' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })).toBeDefined()
    expect(within(screen.getByRole('group', { name: 'Your role' })).getByText('Student')).toBeDefined()
    expect(within(screen.getByRole('group', { name: 'Project code' })).getByText('TEST-ALPHA')).toBeDefined()
    expect(within(screen.getByRole('group', { name: 'Project status' })).getByText('Active')).toBeDefined()
    const sections = within(screen.getByRole('list', { name: 'Sections available to you' })).getAllByRole('link')
    expect(sections).toHaveLength(7)

    await user.click(screen.getByRole('link', { name: /My groups/ }))
    expect(await screen.findByRole('heading', { name: 'My groups' })).toBeDefined()
  })

  it('offers a student the contribution, wellbeing and results sections, and no assessment sections', async () => {
    open(`/groups/${groupAlpha.projectId}`, student, studentGroups)
    await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })

    expect(sectionTabs()).toEqual(['Overview', ...COMMON_SECTIONS, ...WELLBEING_SECTIONS, 'My results'])
    expect(screen.queryByRole('link', { name: /assessment$/i })).toBeNull()
  })

  it('offers a supervisor the supervisor assessment, and no wellbeing or evaluator sections', async () => {
    open(`/groups/${groupAlpha.projectId}`, staff, staffGroups)
    await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })

    expect(sectionTabs()).toEqual(['Overview', ...COMMON_SECTIONS, 'Supervisor assessment'])
    expect(screen.queryByRole('link', { name: /wellbeing/i })).toBeNull()
    expect(screen.queryByText(/wellbeing/i)).toBeNull()
    expect(screen.queryByRole('link', { name: /evaluator/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /my results/i })).toBeNull()
  })

  it('offers a co-supervisor the same sections as a supervisor', async () => {
    open(`/groups/${groupAlpha.projectId}`, staff, [{ ...groupAlpha, roles: ['CO_SUPERVISOR'] }])
    await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })

    expect(sectionTabs()).toEqual(['Overview', ...COMMON_SECTIONS, 'Supervisor assessment'])
    expect(within(screen.getByRole('group', { name: 'Your role' })).getByText('Co-supervisor')).toBeDefined()
  })

  it('offers an evaluator the evaluator assessment, and no wellbeing or supervisor sections', async () => {
    open(`/groups/${groupBeta.projectId}`, staff, staffGroups)
    await screen.findByRole('heading', { level: 1, name: 'Test project Beta' })

    expect(sectionTabs()).toEqual(['Overview', ...COMMON_SECTIONS, 'Evaluator assessment'])
    expect(screen.queryByText(/wellbeing/i)).toBeNull()
    expect(screen.queryByRole('link', { name: /supervisor/i })).toBeNull()
  })

  it('uses the role held in each group, not one role for every group', async () => {
    const { user } = open(`/groups/${groupAlpha.projectId}`, staff, staffGroups)
    await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })
    expect(sectionTabs()).toContain('Supervisor assessment')

    await user.click(screen.getByRole('link', { name: /My groups/ }))
    await user.click(await screen.findByRole('link', { name: 'Open Test project Beta' }))

    await screen.findByRole('heading', { level: 1, name: 'Test project Beta' })
    expect(sectionTabs()).toContain('Evaluator assessment')
    expect(sectionTabs()).not.toContain('Supervisor assessment')
  })

  it('offers no marking at all to someone recorded as both supervising and evaluating the group', async () => {
    open(`/groups/${groupAlpha.projectId}`, staff, [{ ...groupAlpha, roles: ['SUPERVISOR', 'EVALUATOR'] }])
    await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })

    expect(sectionTabs()).toEqual(['Overview', ...COMMON_SECTIONS])
    expect(screen.getByRole('alert').textContent).toContain('both supervising and evaluating')
  })

  it.each([
    ['another group’s id', '99999999-9999-4999-8999-999999999999'],
    ['something that is not an id', 'not-a-group'],
  ])('reports %s as unavailable without asking the backend about it', async (_case, groupId) => {
    const { backend } = open(`/groups/${groupId}/contribution`, student, studentGroups)

    expect(await screen.findByText('This group is not available to you')).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Group sections' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to my groups' })).toBeDefined()
    expect(requestedPaths(backend)).toEqual(['/api/v1/auth/me', '/api/v1/c4/me/groups'])
  })
})

describe('section guards', () => {
  it.each(['team-wellbeing', 'wellbeing', 'results'])(
    'sends a supervisor who opens the student-only section "%s" back to the overview',
    async (section) => {
      const { backend } = open(`/groups/${groupAlpha.projectId}/${section}`, staff, staffGroups)

      expect((await screen.findByRole('alert')).textContent).toBe('That section is not available to you in this group.')
      expect(screen.getByRole('list', { name: 'Sections available to you' })).toBeDefined()
      expect(screen.queryByRole('region', { name: /wellbeing/i })).toBeNull()
      expect(screen.queryByText('Private to you')).toBeNull()
      // Nothing about wellbeing was requested: only the session and the group list.
      expect(requestedPaths(backend)).toEqual(['/api/v1/auth/me', '/api/v1/c4/me/groups'])
    },
  )

  it('sends an evaluator who opens a wellbeing section back to the overview', async () => {
    open(`/groups/${groupBeta.projectId}/wellbeing`, staff, staffGroups)

    expect((await screen.findByRole('alert')).textContent).toBe('That section is not available to you in this group.')
    expect(screen.queryByText('Private to you')).toBeNull()
  })

  it('keeps the two assessment sides apart', async () => {
    // A supervisor cannot open the evaluator side of the group they supervise.
    const first = open(`/groups/${groupAlpha.projectId}/assessment/evaluator`, staff, staffGroups)
    expect((await screen.findByRole('alert')).textContent).toBe('That section is not available to you in this group.')
    expect(screen.queryByRole('heading', { name: 'Evaluator assessment' })).toBeNull()
    expect(requestedPaths(first.backend)).toEqual(['/api/v1/auth/me', '/api/v1/c4/me/groups'])
  })

  it('does not let an evaluator open the supervisor side', async () => {
    open(`/groups/${groupBeta.projectId}/assessment/supervisor`, staff, staffGroups)

    expect((await screen.findByRole('alert')).textContent).toBe('That section is not available to you in this group.')
    expect(screen.queryByRole('heading', { name: 'Supervisor assessment' })).toBeNull()
  })

  it.each(['assessment/supervisor', 'assessment/evaluator'])('does not let a student open "%s"', async (section) => {
    open(`/groups/${groupAlpha.projectId}/${section}`, student, studentGroups)

    expect((await screen.findByRole('alert')).textContent).toBe('That section is not available to you in this group.')
  })

  it('lets each role open the sections it is offered', async () => {
    const { user } = open(`/groups/${groupAlpha.projectId}`, staff, staffGroups)
    await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })

    await user.click(within(screen.getByRole('navigation', { name: 'Group sections' })).getByRole('link', { name: 'Supervisor assessment' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Supervisor assessment' })).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports an unknown section instead of guessing', async () => {
    open(`/groups/${groupAlpha.projectId}/marks-for-everyone`, student, studentGroups)

    expect(await screen.findByText('There is no such section')).toBeDefined()
  })
})

describe('sections that are not built yet', () => {
  it('say so plainly and show no figures, marks or made-up content', async () => {
    const { backend, user } = open(`/groups/${groupAlpha.projectId}`, student, studentGroups)
    await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })
    const tabs = within(screen.getByRole('navigation', { name: 'Group sections' }))

    for (const label of [...COMMON_SECTIONS, ...WELLBEING_SECTIONS, 'My results']) {
      await user.click(tabs.getByRole('link', { name: label }))

      const section = await screen.findByRole('region', { name: label })
      expect(within(section).getByText('This section is not available yet')).toBeDefined()
      expect(section.textContent).not.toMatch(/\d/)
      expect(tabs.getByRole('link', { name: label }).getAttribute('aria-current')).toBe('page')
    }
    expect(requestedPaths(backend)).toEqual(['/api/v1/auth/me', '/api/v1/c4/me/groups'])
    expect(backend.callsTo(MY_GROUPS)).toHaveLength(1)
  })

  it('tell a student who can see their wellbeing information', async () => {
    const { user } = open(`/groups/${groupAlpha.projectId}/wellbeing`, student, studentGroups)

    const privateNotice = await screen.findByRole('complementary', { name: 'Privacy' })
    expect(privateNotice.textContent).toContain('Private to you')
    expect(privateNotice.textContent).toContain('Supervisors, co-supervisors, evaluators, administrators')

    await user.click(within(screen.getByRole('navigation', { name: 'Group sections' })).getByRole('link', { name: 'Team wellbeing' }))
    const groupNotice = await screen.findByRole('complementary', { name: 'Privacy' })
    expect(groupNotice.textContent).toContain('Sharing is off by default')
    expect(groupNotice.textContent).toContain('status, score and trend')
  })

  it('keep nothing but the access token in browser storage', async () => {
    const { user } = open(`/groups/${groupAlpha.projectId}/wellbeing`, student, studentGroups)
    await screen.findByRole('complementary', { name: 'Privacy' })
    await user.click(within(screen.getByRole('navigation', { name: 'Group sections' })).getByRole('link', { name: 'Team wellbeing' }))

    expect(Object.keys(sessionStorage)).toHaveLength(1)
    expect(getToken()).toBe(TEST_TOKEN)
    expect(localStorage.length).toBe(0)
  })
})

describe('who gets Component 4 navigation', () => {
  it('gives students and staff a main menu with Dashboard and My Groups', async () => {
    for (const [account, groups] of [
      [student, studentGroups],
      [staff, staffGroups],
    ] as const) {
      const backend = mockBackend({ [ME]: () => json(200, account), [MY_GROUPS]: () => json(200, groups) })
      const user = userEvent.setup()
      const view = renderSignedInAt('/dashboard')
      await screen.findByRole('heading', { name: 'Welcome, Test' })

      const menu = within(screen.getByRole('navigation', { name: 'Main' }))
      expect(menu.getAllByRole('link').map((link) => link.textContent)).toEqual(['Dashboard', 'My Groups'])
      expect(menu.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page')
      expect(screen.queryByRole('navigation', { name: 'Administration' })).toBeNull()
      // The dashboard itself does not load groups.
      expect(backend.callsTo(MY_GROUPS)).toHaveLength(0)

      await user.click(menu.getByRole('link', { name: 'My Groups' }))
      expect(await screen.findByRole('heading', { name: 'My groups' })).toBeDefined()
      expect(
        within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'My Groups' }).getAttribute('aria-current'),
      ).toBe('page')
      view.unmount()
      sessionStorage.clear()
    }
  })

  it('adds a My groups link to the existing dashboard without replacing it', async () => {
    const { user } = open('/dashboard', student, studentGroups)

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
    expect(screen.getByText(student.email)).toBeDefined()
    expect(screen.getByText('You are signed in. Project features will appear here.')).toBeDefined()

    await user.click(screen.getByRole('link', { name: 'Open my groups' }))
    expect(await screen.findByRole('heading', { name: 'My groups' })).toBeDefined()
  })

  it('still lands a student on the dashboard after signing in, not on My groups', async () => {
    mockBackend({ [LOGIN]: () => loginResponse(student) })
    const user = userEvent.setup()
    renderAt('/login')

    await signIn(user, student.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeDefined()
  })

  it('logs out from a Component 4 page', async () => {
    const { user } = open('/groups', student, studentGroups)
    await screen.findByRole('list', { name: 'Your groups' })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
    expect(getToken()).toBeNull()
    expect(screen.queryByText('Test project Alpha')).toBeNull()
  })

  it('shows administrators no Component 4 navigation and keeps their menu as it was', async () => {
    const backend = mockBackend({ [ME]: () => json(200, admin), [ADMIN_USERS]: () => json(200, adminUserList) })
    renderSignedInAt('/dashboard')
    await screen.findByRole('heading', { name: 'Welcome, System' })

    const menu = within(screen.getByRole('navigation', { name: 'Administration' }))
    expect(menu.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Admin Dashboard',
      'User Management',
      'Create Staff',
    ])
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
    expect(screen.queryByRole('link', { name: /my groups/i })).toBeNull()
    expect(backend.callsTo(MY_GROUPS)).toHaveLength(0)
  })

  it.each(['/groups', `/groups/${groupAlpha.projectId}`, `/groups/${groupAlpha.projectId}/wellbeing`])(
    'sends an administrator who opens %s to the admin dashboard without requesting any group',
    async (path) => {
      const backend = mockBackend({
        [ME]: () => json(200, admin),
        [ADMIN_USERS]: () => json(200, adminUserList),
        [MY_GROUPS]: () => json(200, studentGroups),
      })
      renderSignedInAt(path)

      expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeDefined()
      expect(backend.callsTo(MY_GROUPS)).toHaveLength(0)
      expect(screen.queryByText('Test project Alpha')).toBeNull()
    },
  )

  it.each(['/groups', `/groups/${groupAlpha.projectId}/contribution`])(
    'sends a signed-out visitor from %s to sign-in',
    async (path) => {
      const backend = mockBackend({})
      renderAt(path)

      expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeDefined()
      expect(backend.calls).toHaveLength(0)
    },
  )

  it('returns a user to the group page they asked for after signing in', async () => {
    mockBackend({ [LOGIN]: () => loginResponse(student), [MY_GROUPS]: () => json(200, studentGroups) })
    const user = userEvent.setup()
    renderAt(`/groups/${groupAlpha.projectId}`)
    await screen.findByRole('heading', { name: 'Sign in' })

    await signIn(user, student.email, TEST_PASSWORD)

    expect(await screen.findByRole('heading', { level: 1, name: 'Test project Alpha' })).toBeDefined()
  })

  it('keeps a user who must change their password out of Component 4', async () => {
    const backend = mockBackend({ [ME]: () => json(200, flaggedStaff), [MY_GROUPS]: () => json(200, staffGroups) })
    renderSignedInAt('/groups')

    expect(await screen.findByRole('heading', { name: 'Change your password' })).toBeDefined()
    expect(backend.callsTo(MY_GROUPS)).toHaveLength(0)
  })
})

describe('demonstration mode', () => {
  it('is off by default: the backend is asked and no banner is shown', async () => {
    const { backend } = open('/groups', student, studentGroups)

    await screen.findByRole('list', { name: 'Your groups' })

    expect(backend.callsTo(MY_GROUPS)).toHaveLength(1)
    expect(screen.queryByText(DEMO_BANNER_TEXT)).toBeNull()
    expect(document.body.textContent).not.toContain('Demonstration')
  })

  it('when switched on in development shows labelled demonstration data and does not call the backend for it', async () => {
    vi.stubEnv('VITE_C4_DEMO_DATA', 'true')
    const backend = mockBackend({ [ME]: () => json(200, student) })
    renderSignedInAt('/groups')

    expect(await screen.findByRole('heading', { name: 'Demonstration group A' })).toBeDefined()
    expect(screen.getByText(DEMO_BANNER_TEXT)).toBeDefined()
    expect(screen.getByText('C4-DEMO-A')).toBeDefined()
    expect(backend.callsTo(MY_GROUPS)).toHaveLength(0)
  })

  it('keeps the banner on every Component 4 page while it is on', async () => {
    vi.stubEnv('VITE_C4_DEMO_DATA', 'true')
    mockBackend({ [ME]: () => json(200, staff) })
    const user = userEvent.setup()
    renderSignedInAt('/groups')

    await user.click(await screen.findByRole('link', { name: 'Open Demonstration group B' }))
    await screen.findByRole('heading', { level: 1, name: 'Demonstration group B' })
    expect(screen.getByText(DEMO_BANNER_TEXT)).toBeDefined()

    await user.click(within(screen.getByRole('navigation', { name: 'Group sections' })).getByRole('link', { name: 'Contribution' }))
    await screen.findByRole('region', { name: 'Contribution' })
    expect(screen.getByText(DEMO_BANNER_TEXT)).toBeDefined()
    expect(sectionTabs()).not.toContain('My wellbeing')
  })

  it.each(['TRUE', '1', 'yes', ''])('stays off when the flag is "%s" rather than exactly "true"', async (value) => {
    vi.stubEnv('VITE_C4_DEMO_DATA', value)
    const { backend } = open('/groups', student, studentGroups)

    await screen.findByRole('heading', { name: 'Test project Alpha' })

    expect(backend.callsTo(MY_GROUPS)).toHaveLength(1)
    expect(screen.queryByText(DEMO_BANNER_TEXT)).toBeNull()
  })

  it('is never used as a fallback when the backend fails', async () => {
    const { user } = open('/groups', student, () => json(500, {}))

    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined())

    expect(document.body.textContent).not.toContain('Demonstration')
    expect(document.body.textContent).not.toContain('C4-DEMO')
    expect(screen.queryByRole('list', { name: 'Your groups' })).toBeNull()
  })
})
