import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Metric } from '../api/types'
import CoverageBadge from './CoverageBadge'
import GroupTabs from './GroupTabs'
import MetricValue from './MetricValue'
import PageHeader from './PageHeader'
import PrivacyNotice from './PrivacyNotice'
import StatCard from './StatCard'
import StateBlock from './StateBlock'

describe('MetricValue', () => {
  it('shows a value with its unit', () => {
    render(<MetricValue metric={{ state: 'VALUE', value: 7 }} unit="commits" />)

    expect(screen.getByText('7 commits')).toBeDefined()
    expect(screen.queryByText(/unavailable|verified/i)).toBeNull()
  })

  it('shows a verified zero as zero and says it was verified', () => {
    render(<MetricValue metric={{ state: 'VERIFIED_ZERO' }} unit="commits" />)

    expect(screen.getByText('0 commits')).toBeDefined()
    expect(screen.getByText('Verified: no activity recorded.')).toBeDefined()
    expect(screen.queryByText(/unavailable/i)).toBeNull()
  })

  it('shows unavailable evidence as unavailable, with no number and never as zero', () => {
    const { container } = render(
      <MetricValue metric={{ state: 'UNAVAILABLE', reason: 'The repository could not be read.' }} unit="commits" />,
    )

    expect(screen.getByText('Unavailable')).toBeDefined()
    expect(screen.getByText(/The repository could not be read\. It is not counted as zero\./)).toBeDefined()
    expect(container.textContent).not.toMatch(/\d/)
    expect(container.textContent).not.toContain('commits')
  })

  it('never renders a verified zero and unavailable evidence the same way', () => {
    const texts = (['VERIFIED_ZERO', 'UNAVAILABLE'] as const).map((state) => {
      const metric: Metric = state === 'VERIFIED_ZERO' ? { state } : { state }
      const view = render(<MetricValue metric={metric} />)
      const text = view.container.textContent
      view.unmount()
      return text
    })

    expect(texts[0]).not.toBe(texts[1])
    expect(texts[1]).toContain('could not be collected')
  })
})

describe('CoverageBadge', () => {
  it('says in words when the evidence is complete', () => {
    render(<CoverageBadge partial={false} />)

    expect(screen.getByText('Complete evidence')).toBeDefined()
    expect(screen.queryByText(/partial|unavailable/i)).toBeNull()
  })

  it('says in words when the evidence is partial and names what is missing', () => {
    render(<CoverageBadge partial unavailableSources={['Tasks', 'GitHub']} />)

    expect(screen.getByText('Partial evidence')).toBeDefined()
    expect(screen.getByText('Unavailable: Tasks, GitHub')).toBeDefined()
  })
})

describe('StateBlock', () => {
  it('announces loading politely and an error immediately', () => {
    const loading = render(<StateBlock kind="loading" title="Loading…" />)
    expect(screen.getByRole('status').textContent).toContain('Loading…')
    loading.unmount()

    render(<StateBlock kind="error" title="It failed">Details</StateBlock>)
    expect(screen.getByRole('alert').textContent).toContain('It failed')
    expect(screen.getByRole('alert').textContent).toContain('Details')
  })

  it.each(['empty', 'unavailable', 'unauthorized'] as const)('shows the %s state without an alert', (kind) => {
    render(
      <StateBlock kind={kind} title="Nothing here" action={<button type="button">Next step</button>}>
        Why
      </StateBlock>,
    )

    expect(screen.getByText('Nothing here')).toBeDefined()
    expect(screen.getByText('Why')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Next step' })).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('PageHeader, StatCard and GroupTabs', () => {
  it('PageHeader has one level-one heading and shows its extras', () => {
    render(<PageHeader title="A page" subtitle="About it" meta={<span>CODE-1</span>} actions={<button type="button">Do</button>} />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'A page' })).toBeDefined()
    expect(screen.getByText('About it')).toBeDefined()
    expect(screen.getByText('CODE-1')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Do' })).toBeDefined()
  })

  it('StatCard announces its label with its value', () => {
    render(<StatCard label="Your role" value="Student" hint="In this group" />)

    const card = screen.getByRole('group', { name: 'Your role' })
    expect(within(card).getByText('Student')).toBeDefined()
    expect(within(card).getByText('In this group')).toBeDefined()
  })

  it('GroupTabs is a labelled navigation that marks the current section', () => {
    render(
      <MemoryRouter initialEntries={['/groups/1/contribution']}>
        <GroupTabs
          tabs={[
            { to: '/groups/1', label: 'Overview', end: true },
            { to: '/groups/1/contribution', label: 'Contribution' },
          ]}
        />
      </MemoryRouter>,
    )

    const tabs = within(screen.getByRole('navigation', { name: 'Group sections' }))
    expect(tabs.getAllByRole('link')).toHaveLength(2)
    expect(tabs.getByRole('link', { name: 'Contribution' }).getAttribute('aria-current')).toBe('page')
    expect(tabs.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBeNull()
  })
})

describe('PrivacyNotice', () => {
  it('states that private wellbeing is visible only to the student and never affects marks', () => {
    render(<PrivacyNotice variant="private-wellbeing" />)

    const notice = screen.getByRole('complementary', { name: 'Privacy' })
    expect(notice.textContent).toContain('visible only to you')
    expect(notice.textContent).toContain('Supervisors, co-supervisors, evaluators, administrators and other students cannot see them')
    expect(notice.textContent).toContain('never affect your Contribution Indicator, your marks or any evaluation')
  })

  it('states that the team summary is opt-in, limited to three values, and hidden from staff', () => {
    render(<PrivacyNotice variant="group-wellbeing" />)

    const notice = screen.getByRole('complementary', { name: 'Privacy' })
    expect(notice.textContent).toContain('Sharing is off by default')
    expect(notice.textContent).toContain('status, score and trend')
    expect(notice.textContent).toContain('Staff and administrators cannot see this page')
    expect(notice.textContent).toContain('not a diagnosis')
  })
})
