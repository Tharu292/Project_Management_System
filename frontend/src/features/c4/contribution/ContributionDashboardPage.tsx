import { useCallback } from 'react'
import Alert from '../../../components/Alert'
import { secondaryButtonClass } from '../../../components/AppShell'
import { loadGroupContribution } from '../api/contributionData'
import { useLoad } from '../api/useLoad'
import StateBlock from '../components/StateBlock'
import { useCurrentGroup } from '../groups/MyGroupsContext'
import MemberContributionTable from './MemberContributionTable'
import NotAMarkNotice from './NotAMarkNotice'
import TeamComparisonChart from './TeamComparisonChart'
import WeightsPanel from './WeightsPanel'
import { NOT_CALCULATED } from './contributionText'

/**
 * The team comparison: each member's stored Contribution Indicator and
 * category scores. It shows only what the backend has stored. Until something
 * has been calculated it says so; it never fills the page with numbers of
 * its own.
 */
export default function ContributionDashboardPage() {
  const group = useCurrentGroup()
  const loader = useCallback(() => loadGroupContribution(group.projectId), [group.projectId])
  const { state, retry } = useLoad(loader)

  return (
    <section aria-labelledby="contribution-heading">
      <h2 id="contribution-heading" className="text-lg font-semibold text-slate-900">
        Contribution
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Contribution Indicators and category scores for the members of this group.
      </p>
      <div className="mt-4">
        <NotAMarkNotice />
      </div>

      <div className="mt-6 space-y-6">
        {state.status === 'loading' && <StateBlock kind="loading" title="Loading contribution…" />}

        {state.status === 'error' && (
          <StateBlock
            kind="error"
            title="Contribution could not be loaded"
            action={
              <button type="button" onClick={retry} className={secondaryButtonClass}>
                Try again
              </button>
            }
          >
            {state.message}
          </StateBlock>
        )}

        {state.status === 'ready' && state.data.members.length === 0 && (
          <StateBlock kind="empty" title="This group has no students yet" />
        )}

        {state.status === 'ready' && state.data.members.length > 0 && (
          <>
            {state.data.members.every((member) => !member.calculated) ? (
              <StateBlock kind="empty" title={NOT_CALCULATED}>
                No Contribution Indicator has been calculated for this group. Figures appear here once evidence has
                been collected and scored; until then nothing is shown in their place.
              </StateBlock>
            ) : (
              <>
                {state.data.members.some((member) => member.snapshot?.partial) && (
                  <Alert tone="info">
                    Some indicators are based on partial evidence. They are marked, and should not be compared with
                    complete ones as though they were equally reliable.
                  </Alert>
                )}
                <TeamComparisonChart members={state.data.members} />
              </>
            )}
            <MemberContributionTable projectId={group.projectId} members={state.data.members} />
            <WeightsPanel config={state.data.scoringConfig} />
          </>
        )}
      </div>
    </section>
  )
}
