import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getToken } from '../../../auth/tokenStorage'
import type { User } from '../../../auth/types'
import { ME, renderSignedInAt } from '../../../test/appHarness'
import {
  TEST_TOKEN,
  apiError,
  deferred,
  groupAlpha,
  groupBeta,
  json,
  mockBackend,
  staff,
  staffGroups,
  student,
  studentGroups,
} from '../../../test/mockBackend'
import type { GroupContribution, MyGroup, StudentContribution } from '../api/types'
import { DEMO_BANNER_TEXT } from '../demo/demoMode'
import {
  CONTRIBUTION,
  STUDENT_CONTRIBUTION,
  completeSnapshot,
  groupContribution,
  memberComplete,
  memberNotCalculated,
  memberPartial,
  nothingCalculated,
  otherConfig,
  partialSnapshot,
  studentContribution,
  threeSnapshots,
} from '../test/c4Fixtures'

const MY_GROUPS = 'GET /api/v1/c4/me/groups'
const GROUP = groupAlpha.projectId
const NOT_A_MARK = 'A Contribution Indicator is not an academic mark'

type Handler = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllEnvs()
})

function open(path: string, account: User, groups: MyGroup[], routes: Record<string, Handler>) {
  const backend = mockBackend({
    [ME]: () => json(200, account),
    [MY_GROUPS]: () => json(200, groups),
    ...routes,
  })
  renderSignedInAt(path)
  return { backend, user: userEvent.setup() }
}

function openDashboard(response: GroupContribution | Handler, account: User = student, groups: MyGroup[] = studentGroups) {
  return open(`/groups/${GROUP}/contribution`, account, groups, {
    [CONTRIBUTION(GROUP)]: typeof response === 'function' ? response : () => json(200, response),
  })
}

function openStudent(response: StudentContribution | Handler, studentId = memberComplete.studentId, account: User = student) {
  return open(`/groups/${GROUP}/contribution/${studentId}`, account, account === student ? studentGroups : staffGroups, {
    [STUDENT_CONTRIBUTION(GROUP, studentId)]: typeof response === 'function' ? response : () => json(200, response),
  })
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole('row', { name: new RegExp(name) })
}

function requestedPaths(backend: ReturnType<typeof mockBackend>): string[] {
  return [...new Set(backend.calls.map((call) => call.path))]
}

describe('contribution dashboard', () => {
  it('shows each member’s stored indicator and category scores, from the backend', async () => {
    const { backend } = openDashboard(groupContribution)

    const table = within(await screen.findByRole('table', { name: /Contribution Indicators and category scores/ }))
    expect(table.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Student',
      'Indicator',
      'Development',
      'Task completion',
      'Collaboration',
      'Evidence',
    ])
    const complete = within(rowOf('Test Member Complete'))
    expect(complete.getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '71.3',
      '67.5',
      '80.0',
      '50.0',
      'Complete evidence',
    ])

    const call = backend.callsTo(CONTRIBUTION(GROUP))[0]
    expect(call.headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
    expect(backend.callsTo(CONTRIBUTION(GROUP))).toHaveLength(1)
    expect(backend.calls.every((request) => request.method === 'GET')).toBe(true)
  })

  it('always says that a Contribution Indicator is not a mark', async () => {
    openDashboard(groupContribution)

    const notice = await screen.findByRole('complementary', { name: 'About the Contribution Indicator' })
    expect(notice.textContent).toContain(NOT_A_MARK)
    expect(notice.textContent).toContain('never becomes a mark automatically')
    expect(document.body.textContent).not.toMatch(/grade|GPA|pass mark/i)
  })

  it('shows "Not calculated yet" for a member without a snapshot, and no number or bar', async () => {
    openDashboard(groupContribution)
    await screen.findByRole('table', { name: /Contribution Indicators and category scores/ })

    const waiting = within(rowOf('Test Member Waiting'))
    expect(waiting.getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Not calculated yet'])
    expect(rowOf('Test Member Waiting').textContent).not.toMatch(/\d/)

    const chart = within(screen.getByRole('figure', { name: 'Contribution Indicators in this group' }))
    expect(chart.getAllByRole('img')).toHaveLength(2)
    expect(chart.queryByRole('img', { name: /Test Member Waiting/ })).toBeNull()
    expect(chart.getByText('Not calculated yet')).toBeDefined()
  })

  it('shows "Evidence unavailable" for a score that has no evidence, never zero', async () => {
    openDashboard(groupContribution)
    await screen.findByRole('table', { name: /Contribution Indicators and category scores/ })

    const partial = within(rowOf('Test Member Partial'))
    const cells = partial.getAllByRole('cell').map((cell) => cell.textContent)
    expect(cells[2]).toBe('Evidence unavailable')
    expect(cells[2]).not.toMatch(/\d/)
    expect(cells[4]).toBe('Partial evidenceUnavailable: Task management')
  })

  it('marks indicators that rest on partial evidence and warns against comparing them as equals', async () => {
    openDashboard(groupContribution)

    const chart = within(await screen.findByRole('figure', { name: 'Contribution Indicators in this group' }))
    expect(chart.getByRole('img', { name: 'Test Member Partial: 61.8 out of 100, based on partial evidence' })).toBeDefined()
    expect(chart.getByRole('img', { name: 'Test Member Complete: 71.3 out of 100' })).toBeDefined()
    expect(chart.getByText('partial evidence')).toBeDefined()
    expect(screen.getByText(/should not be compared with\s+complete ones as though they were equally reliable/)).toBeDefined()
  })

  it('gives no comparability warning when every indicator is complete', async () => {
    openDashboard({ ...groupContribution, members: [memberComplete, memberNotCalculated] })

    await screen.findByRole('figure', { name: 'Contribution Indicators in this group' })
    expect(screen.queryByText(/equally reliable/)).toBeNull()
  })

  it('draws each bar to the stored value on a fixed 0 to 100 scale', async () => {
    openDashboard(groupContribution)

    const bar = await screen.findByRole('img', { name: 'Test Member Complete: 71.3 out of 100' })
    const rects = bar.querySelectorAll('rect')
    expect(rects[0].getAttribute('width')).toBe('100')
    expect(rects[1].getAttribute('width')).toBe('71.25')
  })

  it('keeps members in the backend’s order and does not rank them', async () => {
    openDashboard({ ...groupContribution, members: [memberPartial, memberNotCalculated, memberComplete] })
    const table = within(await screen.findByRole('table', { name: /Contribution Indicators and category scores/ }))

    expect(table.getAllByRole('rowheader').map((header) => header.textContent)).toEqual([
      'Test Member Partial',
      'Test Member Waiting',
      'Test Member Complete',
    ])
    expect(screen.queryByText(/rank|position|1st|top contributor/i)).toBeNull()
  })

  it('says "Not calculated yet" for the whole group when nothing is stored, and still lists members and weights', async () => {
    openDashboard(nothingCalculated)

    expect(await screen.findByText('No Contribution Indicator has been calculated for this group.', { exact: false })).toBeDefined()
    expect(screen.queryByRole('figure', { name: 'Contribution Indicators in this group' })).toBeNull()
    const table = screen.getByRole('table', { name: /Contribution Indicators and category scores/ })
    expect(within(table).getAllByRole('rowheader')).toHaveLength(2)
    expect(table.textContent).not.toMatch(/\d/)
    expect(screen.getByRole('region', { name: 'How the indicator is weighted' })).toBeDefined()
  })

  it('shows the agreed weights and multipliers when the backend sends them', async () => {
    openDashboard(groupContribution)

    const weights = within(await screen.findByRole('region', { name: 'How the indicator is weighted' }))
    expect(weights.getByRole('group', { name: 'Development weights' }).textContent).toBe('Development40%Commits30%Pull requests10%')
    expect(weights.getByRole('group', { name: 'Task completion weights' }).textContent).toBe(
      'Task completion40%Completed assigned tasks40%',
    )
    expect(weights.getByRole('group', { name: 'Collaboration weights' }).textContent).toBe(
      'Collaboration20%Issue comments10%Pull-request reviews10%',
    )
    const multipliers = within(weights.getByRole('table', { name: /How much a pull request counts in each state/ }))
    expect(multipliers.getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual([
      'Merged× 1',
      'Open× 0.6',
      'Closed without merging× 0.3',
    ])
    expect(weights.getByText('Provisional research assumption')).toBeDefined()
    expect(weights.getByText(/are being tested and are not a validated result/)).toBeDefined()
    expect(weights.getByText(/Weights version 1\./)).toBeDefined()
  })

  it('reads every weight and multiplier from the response: a different configuration shows different figures', async () => {
    openDashboard({ ...groupContribution, scoringConfig: otherConfig })

    const weights = within(await screen.findByRole('region', { name: 'How the indicator is weighted' }))
    expect(weights.getByRole('group', { name: 'Development weights' }).textContent).toBe('Development25%Commits5%Pull requests20%')
    expect(weights.getByRole('group', { name: 'Task completion weights' }).textContent).toBe(
      'Task completion55%Completed assigned tasks55%',
    )
    const multipliers = within(weights.getByRole('table', { name: /How much a pull request counts in each state/ }))
    expect(multipliers.getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual([
      'Merged× 0.9',
      'Open× 0.45',
      'Closed without merging× 0.15',
    ])
    expect(weights.getByText(/Weights version 9\./)).toBeDefined()
    // Nothing is provisional in this version, so nothing is labelled as such.
    expect(weights.queryByText('Provisional research assumption')).toBeNull()
    expect(weights.queryByText('30%')).toBeNull()
  })

  it('shows a loading state, then the data', async () => {
    const pending = deferred()
    openDashboard(() => pending.promise)

    expect((await screen.findByText('Loading contribution…')).closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByRole('table')).toBeNull()

    pending.resolve(json(200, groupContribution))
    expect(await screen.findByRole('table', { name: /Contribution Indicators and category scores/ })).toBeDefined()
  })

  it.each([
    ['a server error', () => json(500, { message: 'ContributionDataFormatException: snapshot 123' }), 'Something went wrong. Please try again.'],
    ['a refusal', () => apiError(403, 'You do not have permission to do this.'), 'You do not have permission to do this.'],
  ])('shows an error for %s, with no figures and no substitute data', async (_case, response, message) => {
    openDashboard(response)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Contribution could not be loaded')
    expect(alert.textContent).toContain(message)
    expect(document.body.textContent).not.toContain('ContributionDataFormatException')
    expect(document.body.textContent).not.toContain('Demonstration')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('figure')).toBeNull()
    expect(getToken()).toBe(TEST_TOKEN)
    // The notice that this is not a mark is there even when the data is not.
    expect(screen.getByText(NOT_A_MARK)).toBeDefined()
  })

  it('reports an unreachable server and loads the data on retry', async () => {
    let attempts = 0
    const { user } = openDashboard(() => {
      attempts += 1
      if (attempts === 1) throw new TypeError('Failed to fetch')
      return json(200, groupContribution)
    })

    expect((await screen.findByRole('alert')).textContent).toContain('Cannot reach the server.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('table', { name: /Contribution Indicators and category scores/ })).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('is the same for a supervisor and an evaluator of the group, with no wellbeing and no marks', async () => {
    for (const [group, groups] of [
      [groupAlpha, staffGroups],
      [groupBeta, staffGroups],
    ] as const) {
      const backend = mockBackend({
        [ME]: () => json(200, staff),
        [MY_GROUPS]: () => json(200, groups),
        [CONTRIBUTION(group.projectId)]: () => json(200, groupContribution),
      })
      const view = renderSignedInAt(`/groups/${group.projectId}/contribution`)

      expect(await screen.findByRole('table', { name: /Contribution Indicators and category scores/ })).toBeDefined()
      expect(document.body.textContent).not.toMatch(/wellbeing|reflection|emotion/i)
      expect(document.body.textContent).not.toMatch(/feedback|markPercent/i)
      expect(requestedPaths(backend)).toEqual([
        '/api/v1/auth/me',
        '/api/v1/c4/me/groups',
        `/api/v1/c4/projects/${group.projectId}/contribution`,
      ])
      view.unmount()
      sessionStorage.clear()
    }
  })

  it('ignores anything in a response that is not part of the contract', async () => {
    const leaky = {
      ...groupContribution,
      members: groupContribution.members.map((member) => ({
        ...member,
        email: 'someone@my.sliit.lk',
        registrationNumber: 'IT99999999',
        wellbeingStatus: 'COULD_BE_BETTER',
        markPercent: 42.42,
      })),
    }
    openDashboard(leaky as GroupContribution)
    await screen.findByRole('table', { name: /Contribution Indicators and category scores/ })

    const page = document.body.innerHTML
    for (const leaked of ['someone@my.sliit.lk', 'IT99999999', 'COULD_BE_BETTER', '42.42']) {
      expect(page).not.toContain(leaked)
    }
  })

  it('stores nothing but the access token in the browser', async () => {
    openDashboard(groupContribution)
    await screen.findByRole('table', { name: /Contribution Indicators and category scores/ })

    expect(Object.keys(sessionStorage)).toHaveLength(1)
    expect(localStorage.length).toBe(0)
  })
})

describe('student contribution detail', () => {
  it('opens from the group table and shows the latest stored calculation', async () => {
    const { backend, user } = open(`/groups/${GROUP}/contribution`, student, studentGroups, {
      [CONTRIBUTION(GROUP)]: () => json(200, groupContribution),
      [STUDENT_CONTRIBUTION(GROUP, memberComplete.studentId)]: () =>
        json(200, studentContribution(memberComplete, [completeSnapshot()])),
    })

    await user.click(await screen.findByRole('link', { name: 'Contribution details of Test Member Complete' }))

    expect(await screen.findByRole('heading', { name: 'Contribution of Test Member Complete' })).toBeDefined()
    expect(within(screen.getByRole('group', { name: 'Contribution Indicator' })).getByText('71.3')).toBeDefined()
    expect(screen.getByRole('group', { name: 'Period covered' }).textContent).toContain('1 Sept 2026 to 28 Sept 2026')
    expect(screen.getByRole('group', { name: 'Period covered' }).textContent).toContain('Cumulative from the project start.')
    expect(within(screen.getByRole('group', { name: 'Calculated on' })).getByText('29 Sept 2026')).toBeDefined()
    expect(within(screen.getByRole('group', { name: 'Evidence' })).getByText('Complete evidence')).toBeDefined()
    expect(screen.getByText(NOT_A_MARK)).toBeDefined()
    expect(backend.callsTo(STUDENT_CONTRIBUTION(GROUP, memberComplete.studentId))).toHaveLength(1)

    await user.click(screen.getByRole('link', { name: /Group contribution/ }))
    expect(await screen.findByRole('table', { name: /Contribution Indicators and category scores/ })).toBeDefined()
  })

  it('shows the five metrics with their weights, recorded counts and team-relative scores', async () => {
    openStudent(studentContribution(memberComplete, [completeSnapshot()]))

    const table = within(await screen.findByRole('table', { name: 'Categories and metrics' }))
    const row = (name: string) => within(table.getByRole('row', { name: new RegExp(`^${name}`) })).getAllByRole('cell').map((cell) => cell.textContent)
    expect(row('Development')).toEqual(['40%', '', '67.5'])
    expect(row('Commits')).toEqual(['30%', '7', '70.0'])
    expect(row('Pull requests')).toEqual(['10%', '3', '60.0'])
    expect(row('Task completion')).toEqual(['40%', '', '80.0'])
    expect(row('Completed assigned tasks')).toEqual(['40%', '4', '80.0'])
    expect(row('Collaboration')).toEqual(['20%', '', '50.0'])
    expect(row('Pull-request reviews')).toEqual(['10%', '2', '100.0'])
  })

  it('shows a verified zero as "0" with its explanation', async () => {
    openStudent(studentContribution(memberComplete, [completeSnapshot()]))

    const table = within(await screen.findByRole('table', { name: 'Categories and metrics' }))
    const cells = within(table.getByRole('row', { name: /^Issue comments/ })).getAllByRole('cell')
    expect(cells[1].textContent).toBe('0Verified: no activity recorded.')
    expect(cells[2].textContent).toBe('0.0')
    expect(cells[1].textContent).not.toMatch(/unavailable/i)
  })

  it('shows unavailable evidence as unavailable, with its reason and no number', async () => {
    openStudent(studentContribution(memberPartial, [partialSnapshot()]), memberPartial.studentId)

    const table = within(await screen.findByRole('table', { name: 'Categories and metrics' }))
    const metric = within(table.getByRole('row', { name: /^Completed assigned tasks/ })).getAllByRole('cell')
    expect(metric[1].textContent).toBe('UnavailableTask data is not connected yet. It is not counted as zero.')
    expect(metric[1].textContent).not.toMatch(/\d/)
    expect(metric[2].textContent).toBe('Evidence unavailable')
    const category = within(table.getByRole('row', { name: /^Task completion/ })).getAllByRole('cell')
    expect(category[2].textContent).toBe('Evidence unavailable')

    expect(within(screen.getByRole('group', { name: 'Evidence' })).getByText('Partial evidence')).toBeDefined()
    expect(screen.getByRole('group', { name: 'Evidence' }).textContent).toContain('Unavailable: Task management')
    expect(screen.getByText(/rests on partial evidence/)).toBeDefined()
    expect(screen.getByText(/it is not\s+counted as zero/)).toBeDefined()
  })

  it('shows how many pull requests are in each state beside the multiplier from the configuration', async () => {
    openStudent({ ...studentContribution(memberComplete, [completeSnapshot()]), scoringConfig: otherConfig })

    const states = within(await screen.findByRole('table', { name: /Number of pull requests in each state/ }))
    expect(states.getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual([
      'Merged2× 0.9',
      'Open1× 0.45',
      'Closed without merging0× 0.15',
    ])
    expect(screen.getAllByText('Each pull request is counted once, in its latest state.').length).toBeGreaterThan(0)
  })

  it('says pull-request evidence is unavailable instead of showing counts when it could not be collected', async () => {
    const githubDown = partialSnapshot({
      pullRequestStates: null,
      developmentScore: null,
      metrics: {
        ...partialSnapshot().metrics,
        PULL_REQUEST: { state: 'UNAVAILABLE', count: null, normalised: null, reason: 'GITHUB_UNREACHABLE' },
      },
      coverage: {
        GITHUB: { status: 'UNAVAILABLE', reason: 'GITHUB_UNREACHABLE' },
        TASKS: { status: 'UNAVAILABLE', reason: 'TASKS_NOT_CONNECTED' },
      },
      unavailableSources: ['GITHUB', 'TASKS'],
    })
    openStudent(studentContribution(memberPartial, [githubDown]), memberPartial.studentId)

    expect(await screen.findByText(/Pull-request evidence could not be collected/)).toBeDefined()
    expect(screen.queryByRole('table', { name: /Number of pull requests in each state/ })).toBeNull()
    expect(screen.getByRole('group', { name: 'Evidence' }).textContent).toContain('Unavailable: GitHub, Task management')
    expect(screen.getByText('GitHub could not be reached. It is not counted as zero.')).toBeDefined()
  })

  it('shows "Not calculated yet" and nothing else for a student without a snapshot', async () => {
    openStudent(studentContribution(memberNotCalculated, []), memberNotCalculated.studentId)

    expect(await screen.findByRole('heading', { name: 'Contribution of Test Member Waiting' })).toBeDefined()
    expect(screen.getByText('Not calculated yet')).toBeDefined()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('figure')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Contribution Indicator' })).toBeNull()
    expect(screen.getByText(NOT_A_MARK)).toBeDefined()
  })

  it('notes when a calculation used an older version of the weights', async () => {
    openStudent(studentContribution(memberComplete, [completeSnapshot({ scoringConfigVersion: 4 })]))

    expect(await screen.findByText(/This calculation used weights version 4\./)).toBeDefined()
  })

  it('reports a student who is not in the group, using the backend’s 404', async () => {
    const unknown = '99999999-9999-4999-8999-999999999999'
    openStudent(() => apiError(404, 'Student not found in this project.'), unknown)

    expect(await screen.findByText('This student is not in this group')).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('link', { name: /Group contribution/ })).toBeDefined()
  })

  it('shows an error with retry when the calculation cannot be loaded', async () => {
    let attempts = 0
    const { user } = openStudent(() => (++attempts === 1 ? json(500, {}) : json(200, studentContribution(memberComplete, [completeSnapshot()]))))

    expect((await screen.findByRole('alert')).textContent).toContain('Contribution could not be loaded')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Contribution of Test Member Complete' })).toBeDefined()
  })

  it('offers a teammate no itemised evidence: only aggregate figures and no evidence links', async () => {
    openStudent(studentContribution(memberComplete, [completeSnapshot()]))
    await screen.findByRole('table', { name: 'Categories and metrics' })

    const links = screen.getAllByRole('link').map((link) => link.textContent)
    expect(links.filter((text) => /evidence|commit|pull request|github\.com/i.test(text ?? ''))).toEqual(['GitHub evidence'])
    expect(document.querySelector('a[href*="github.com"]')).toBeNull()
    expect(document.body.textContent).not.toMatch(/sha|#\d+/i)
  })
})

describe('contribution trend', () => {
  it('is drawn only from stored snapshots, oldest to newest, with a table of the same values', async () => {
    openStudent(studentContribution(memberComplete, threeSnapshots))

    const figure = within(await screen.findByRole('figure', { name: 'Stored Contribution Indicators over time' }))
    const chart = figure.getByRole('img', { name: /Contribution Indicator at 3 stored calculations, from 14 Sept 2026 to 28 Sept 2026/ })
    const points = chart.querySelectorAll('circle')
    expect(points).toHaveLength(3)
    // Higher indicators sit higher on the chart (a smaller y), left to right in time order.
    const ys = [...points].map((point) => Number(point.getAttribute('cy')))
    const xs = [...points].map((point) => Number(point.getAttribute('cx')))
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    expect(ys[0]).toBeGreaterThan(ys[1])
    expect(ys[1]).toBeGreaterThan(ys[2])

    const rows = figure.getAllByRole('row').slice(1).map((row) => row.textContent)
    expect(rows).toEqual([
      '28 Sept 202671.3Complete evidence',
      '21 Sept 202655.5Partial evidenceUnavailable: Task management',
      '14 Sept 202640.8Complete evidence',
    ])
  })

  it('draws a point resting on partial evidence hollow', async () => {
    openStudent(studentContribution(memberComplete, threeSnapshots))

    const chart = await screen.findByRole('img', { name: /Contribution Indicator at 3 stored calculations/ })
    const classes = [...chart.querySelectorAll('circle')].map((point) => point.getAttribute('class') ?? '')
    expect(classes[0]).toContain('fill-indigo-600')
    expect(classes[1]).toContain('fill-white')
    expect(classes[2]).toContain('fill-indigo-600')
    expect(screen.getByText(/hollow points on partial evidence/)).toBeDefined()
  })

  it('shows no trend from a single snapshot', async () => {
    openStudent(studentContribution(memberComplete, [completeSnapshot()]))

    expect(await screen.findByText(/Not enough history for a trend\./)).toBeDefined()
    expect(screen.queryByRole('figure', { name: 'Stored Contribution Indicators over time' })).toBeNull()
    expect(document.querySelector('circle')).toBeNull()
  })

  it('leaves a gap for a snapshot without an indicator instead of joining across it', async () => {
    const withGap = [threeSnapshots[0], partialSnapshot({ periodEnd: '2026-09-21', indicator: null }), threeSnapshots[2]]
    openStudent(studentContribution(memberComplete, withGap))

    const chart = await screen.findByRole('img', { name: /Contribution Indicator at 3 stored calculations/ })
    expect(chart.querySelectorAll('circle')).toHaveLength(2)
    expect(chart.querySelector('path')?.getAttribute('d')).toBe('')
    expect(screen.getAllByText('Evidence unavailable').length).toBeGreaterThan(0)
  })
})

describe('contribution access from the frontend', () => {
  it.each([
    ['a group the user is not in', `/groups/99999999-9999-4999-8999-999999999999/contribution`],
    ['a student page of a group the user is not in', `/groups/99999999-9999-4999-8999-999999999999/contribution/${memberComplete.studentId}`],
  ])('requests nothing for %s', async (_case, path) => {
    const { backend } = open(path, student, studentGroups, {})

    expect(await screen.findByText('This group is not available to you')).toBeDefined()
    expect(requestedPaths(backend)).toEqual(['/api/v1/auth/me', '/api/v1/c4/me/groups'])
  })

  it('never requests wellbeing or assessment data from a contribution page', async () => {
    const { backend, user } = open(`/groups/${GROUP}/contribution`, student, studentGroups, {
      [CONTRIBUTION(GROUP)]: () => json(200, groupContribution),
      [STUDENT_CONTRIBUTION(GROUP, memberPartial.studentId)]: () => json(200, studentContribution(memberPartial, [partialSnapshot()])),
    })
    await user.click(await screen.findByRole('link', { name: 'Contribution details of Test Member Partial' }))
    await screen.findByRole('table', { name: 'Categories and metrics' })

    for (const path of requestedPaths(backend)) {
      expect(path).not.toMatch(/wellbeing|reflection|assessment|marks/)
    }
    await waitFor(() => expect(backend.calls.every((call) => call.method === 'GET')).toBe(true))
  })
})

describe('contribution in demonstration mode', () => {
  it('shows labelled demonstration data under the banner and calls no contribution endpoint', async () => {
    vi.stubEnv('VITE_C4_DEMO_DATA', 'true')
    const backend = mockBackend({ [ME]: () => json(200, student) })
    const user = userEvent.setup()
    renderSignedInAt('/groups')

    await user.click(await screen.findByRole('link', { name: 'Open Demonstration group A' }))
    await user.click(within(await screen.findByRole('navigation', { name: 'Group sections' })).getByRole('link', { name: 'Contribution' }))

    expect(await screen.findByRole('link', { name: 'Contribution details of Demo Student One (C4-DEMO)' })).toBeDefined()
    expect(screen.getByText(DEMO_BANNER_TEXT)).toBeDefined()
    expect(screen.getByText(NOT_A_MARK)).toBeDefined()
    expect(requestedPaths(backend)).toEqual(['/api/v1/auth/me'])
  })

  it('is not used when the flag is off, even if the request fails', async () => {
    openDashboard(() => json(500, {}))

    await screen.findByRole('alert')
    expect(screen.queryByText(DEMO_BANNER_TEXT)).toBeNull()
    expect(document.body.textContent).not.toContain('C4-DEMO')
    expect(document.body.textContent).not.toContain('Demo Student')
  })
})
