import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../../../auth/types'
import { ME, renderSignedInAt } from '../../../test/appHarness'
import { apiError, groupAlpha, json, mockBackend, staff, staffGroups, student, studentGroups } from '../../../test/mockBackend'
import type { MyGroup, TeamProgress } from '../api/types'
import { DEMO_BANNER_TEXT } from '../demo/demoMode'
import { PROGRESS, progressAvailable, progressUnavailable } from '../test/c4Fixtures'

const MY_GROUPS = 'GET /api/v1/c4/me/groups'
const GROUP = groupAlpha.projectId

afterEach(() => {
  vi.unstubAllEnvs()
})

function openProgress(
  response: TeamProgress | (() => Response),
  account: User = student,
  groups: MyGroup[] = studentGroups,
) {
  const backend = mockBackend({
    [ME]: () => json(200, account),
    [MY_GROUPS]: () => json(200, groups),
    [PROGRESS(GROUP)]: typeof response === 'function' ? response : () => json(200, response),
  })
  renderSignedInAt(`/groups/${GROUP}/progress`)
  return { backend, user: userEvent.setup() }
}

describe('team progress', () => {
  it('says truthfully that task progress is unavailable while the task component is not connected', async () => {
    const { backend } = openProgress(progressUnavailable)

    const section = await screen.findByRole('region', { name: 'Team progress' })
    expect(await within(section).findByText('Task progress is not available yet')).toBeDefined()
    expect(section.textContent).toContain('Task data is not connected yet.')
    expect(section.textContent).toContain('Until then no figures are shown.')
    expect(section.textContent).not.toMatch(/\d/)
    expect(within(section).queryByRole('table')).toBeNull()
    expect(within(section).queryByRole('img')).toBeNull()
    expect(within(section).queryByRole('alert')).toBeNull()
    expect(backend.callsTo(PROGRESS(GROUP))).toHaveLength(1)
    expect(backend.calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('gives a neutral explanation for a reason it does not know', async () => {
    openProgress({ ...progressUnavailable, unavailableReason: 'SOMETHING_NEW' })

    expect(await screen.findByText(/This evidence could not be collected \(SOMETHING_NEW\)\./)).toBeDefined()
  })

  it('shows overall and per-member task counts when the task component supplies them', async () => {
    openProgress(progressAvailable)

    expect(within(await screen.findByRole('group', { name: 'Tasks assigned' })).getByText('9')).toBeDefined()
    expect(within(screen.getByRole('group', { name: 'Tasks completed' })).getByText('5')).toBeDefined()
    expect(screen.getByRole('img', { name: 'Whole team: 5 of 9 assigned tasks completed' })).toBeDefined()

    const table = within(screen.getByRole('table', { name: 'Assigned and completed tasks of each group member' }))
    const row = (name: string) => within(table.getByRole('row', { name: new RegExp(`^${name}`) })).getAllByRole('cell')
    expect(row('Test Member Complete').slice(0, 2).map((cell) => cell.textContent)).toEqual(['6', '5'])
    expect(table.getByRole('img', { name: 'Test Member Complete: 5 of 6 assigned tasks completed' })).toBeDefined()
    expect(table.getByRole('img', { name: 'Test Member Partial: 0 of 3 assigned tasks completed' })).toBeDefined()
  })

  it('shows a member with no assigned tasks as a verified zero, not as missing data', async () => {
    openProgress(progressAvailable)

    const table = within(await screen.findByRole('table', { name: 'Assigned and completed tasks of each group member' }))
    const cells = within(table.getByRole('row', { name: /^Test Member Waiting/ })).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent)).toEqual(['0', '0', 'No tasks assigned (verified)'])
    expect(table.queryByRole('img', { name: /Test Member Waiting/ })).toBeNull()
  })

  it('draws a progress bar to the share of tasks completed', async () => {
    openProgress(progressAvailable)

    const bar = await screen.findByRole('img', { name: 'Test Member Partial: 0 of 3 assigned tasks completed' })
    expect(bar.querySelectorAll('rect')[1].getAttribute('width')).toBe('0')
    const half = screen.getByRole('img', { name: 'Test Member Complete: 5 of 6 assigned tasks completed' })
    expect(Number(half.querySelectorAll('rect')[1].getAttribute('width'))).toBeCloseTo(83.33, 1)
  })

  it('offers no way to create, assign or complete a task', async () => {
    openProgress(progressAvailable)
    await screen.findByRole('table', { name: 'Assigned and completed tasks of each group member' })

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Log out'])
    expect(document.querySelector('form, input, select, textarea')).toBeNull()
  })

  it('shows an error with retry and no figures when progress cannot be loaded', async () => {
    let attempts = 0
    const { user } = openProgress(() => (++attempts === 1 ? apiError(403, 'You do not have permission to do this.') : json(200, progressAvailable)))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Progress could not be loaded')
    expect(alert.textContent).toContain('You do not have permission to do this.')
    expect(screen.queryByRole('table')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('table', { name: 'Assigned and completed tasks of each group member' })).toBeDefined()
  })

  it('is the same page for assigned staff, with no wellbeing content', async () => {
    openProgress(progressUnavailable, staff, staffGroups)

    expect(await screen.findByText('Task progress is not available yet')).toBeDefined()
    expect(document.body.textContent).not.toMatch(/wellbeing|reflection/i)
  })

  it('shows labelled demonstration progress only in demonstration mode', async () => {
    vi.stubEnv('VITE_C4_DEMO_DATA', 'true')
    const backend = mockBackend({ [ME]: () => json(200, student) })
    const user = userEvent.setup()
    renderSignedInAt('/groups')

    await user.click(await screen.findByRole('link', { name: 'Open Demonstration group A' }))
    await user.click(within(await screen.findByRole('navigation', { name: 'Group sections' })).getByRole('link', { name: 'Team progress' }))

    expect(await screen.findByText('Demo Student One (C4-DEMO)')).toBeDefined()
    expect(screen.getByText(DEMO_BANNER_TEXT)).toBeDefined()
    expect(backend.calls.map((call) => call.path)).toEqual(['/api/v1/auth/me'])
  })
})
