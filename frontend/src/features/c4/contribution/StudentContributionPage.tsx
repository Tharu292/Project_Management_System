import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import Alert from '../../../components/Alert'
import { secondaryButtonClass } from '../../../components/AppShell'
import { linkClass } from '../../../components/AuthLayout'
import { loadStudentContribution } from '../api/contributionData'
import { useLoad } from '../api/useLoad'
import CoverageBadge from '../components/CoverageBadge'
import StatCard from '../components/StatCard'
import StateBlock from '../components/StateBlock'
import { useCurrentGroup } from '../groups/MyGroupsContext'
import { sectionPath } from '../paths'
import ContributionTrendChart from './ContributionTrendChart'
import NotAMarkNotice from './NotAMarkNotice'
import SnapshotBreakdown from './SnapshotBreakdown'
import { EVIDENCE_UNAVAILABLE, NOT_CALCULATED, formatDate, formatScore, unavailableSourceNames } from './contributionText'

/**
 * One student's stored contribution: the latest calculation in detail, and
 * the earlier ones as a trend when there are any. Open to the students of the
 * group and its assigned staff. It shows aggregate figures only; itemised
 * evidence is not part of this page.
 */
export default function StudentContributionPage() {
  const group = useCurrentGroup()
  const { studentId = '' } = useParams()
  const loader = useCallback(() => loadStudentContribution(group.projectId, studentId), [group.projectId, studentId])
  const { state, retry } = useLoad(loader)
  const backToGroup = (
    <Link to={sectionPath(group.projectId, 'contribution')} className={linkClass + ' text-sm'}>
      ← Group contribution
    </Link>
  )

  if (state.status === 'loading') {
    return <StateBlock kind="loading" title="Loading contribution…" />
  }
  if (state.status === 'error' && state.httpStatus === 404) {
    return (
      <StateBlock kind="unauthorized" title="This student is not in this group" action={backToGroup}>
        Contribution can only be shown for the current students of the group.
      </StateBlock>
    )
  }
  if (state.status === 'error') {
    return (
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
    )
  }

  const { displayName, latest, history, scoringConfig } = state.data

  return (
    <section aria-labelledby="student-contribution-heading">
      <p>{backToGroup}</p>
      <h2 id="student-contribution-heading" className="mt-2 text-lg font-semibold text-slate-900">
        Contribution of {displayName}
      </h2>
      <div className="mt-4">
        <NotAMarkNotice />
      </div>

      {latest === null ? (
        <div className="mt-6">
          <StateBlock kind="empty" title={NOT_CALCULATED}>
            No Contribution Indicator has been calculated for this student. Nothing is shown in its place.
          </StateBlock>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Contribution Indicator"
              value={latest.indicator === null ? EVIDENCE_UNAVAILABLE : formatScore(latest.indicator)}
              hint="Scale 0 to 100, relative to the team. Not a mark."
            />
            <StatCard
              label="Period covered"
              value={`${formatDate(latest.periodStart)} to ${formatDate(latest.periodEnd)}`}
              hint="Cumulative from the project start."
            />
            <StatCard label="Calculated on" value={formatDate(latest.computedAt)} />
            <StatCard
              label="Evidence"
              value={<CoverageBadge partial={latest.partial} unavailableSources={unavailableSourceNames(latest)} />}
            />
          </div>

          {latest.partial && (
            <Alert tone="info">
              This indicator rests on partial evidence. Evidence that could not be collected is left out; it is not
              counted as zero. Compare it with care.
            </Alert>
          )}
          {latest.scoringConfigVersion !== scoringConfig.version && (
            <Alert tone="info">
              This calculation used weights version {latest.scoringConfigVersion}. The weights shown are the current
              version {scoringConfig.version}.
            </Alert>
          )}

          <SnapshotBreakdown snapshot={latest} config={scoringConfig} />

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-base font-semibold text-slate-900">Trend</h3>
            <div className="mt-2">
              <ContributionTrendChart history={history} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
