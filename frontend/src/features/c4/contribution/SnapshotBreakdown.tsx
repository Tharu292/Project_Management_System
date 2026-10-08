import type { ScoringConfigView, SnapshotView } from '../api/types'
import MetricValue from '../components/MetricValue'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  EVIDENCE_UNAVAILABLE,
  METRICS_BY_CATEGORY,
  METRIC_LABELS,
  PULL_REQUEST_STATE_LABELS,
  PULL_REQUEST_STATE_ORDER,
  categoryScore,
  formatScore,
  percent,
  toMetric,
} from './contributionText'

const headerCell = 'px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase'
const cell = 'px-3 py-2.5 align-top text-sm text-slate-800'

/**
 * One snapshot in detail: the three category scores, the five metrics behind
 * them, and how the pull requests divide by state. All of it is aggregate:
 * there is no list of individual commits, pull requests or tasks here.
 */
export default function SnapshotBreakdown({ snapshot, config }: { snapshot: SnapshotView; config: ScoringConfigView }) {
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <caption className="px-3 pt-3 text-left text-base font-semibold text-slate-900">
            Categories and metrics
          </caption>
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className={headerCell}>
                Metric
              </th>
              <th scope="col" className={headerCell}>
                Weight
              </th>
              <th scope="col" className={headerCell}>
                Recorded
              </th>
              <th scope="col" className={headerCell}>
                Score relative to team
              </th>
            </tr>
          </thead>
          {CATEGORY_ORDER.map((category) => {
            const score = categoryScore(snapshot, category)
            return (
              <tbody key={category} className="divide-y divide-slate-200">
                <tr className="bg-slate-50/60">
                  <th scope="rowgroup" className={`${cell} text-left font-semibold text-slate-900`}>
                    {CATEGORY_LABELS[category]}
                  </th>
                  <td className={`${cell} font-semibold`}>{percent(config.categoryWeights[category])}</td>
                  <td className={cell} />
                  <td className={`${cell} font-semibold`}>
                    {score === null ? (
                      <span className="font-normal text-slate-500">{EVIDENCE_UNAVAILABLE}</span>
                    ) : (
                      formatScore(score)
                    )}
                  </td>
                </tr>
                {METRICS_BY_CATEGORY[category].map((type) => {
                  const metric = snapshot.metrics[type]
                  return (
                    <tr key={type}>
                      <th scope="row" className={`${cell} pl-6 text-left font-normal`}>
                        {METRIC_LABELS[type]}
                      </th>
                      <td className={cell}>{percent(config.metricWeights[type])}</td>
                      <td className={cell}>
                        <MetricValue metric={toMetric(metric)} />
                      </td>
                      <td className={cell}>
                        {metric.normalised === null ? (
                          <span className="text-slate-500">{EVIDENCE_UNAVAILABLE}</span>
                        ) : (
                          formatScore(metric.normalised)
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            )
          })}
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-base font-semibold text-slate-900">Pull requests by state</h4>
        {snapshot.pullRequestStates === null ? (
          <p className="mt-2 text-sm text-slate-500">
            {EVIDENCE_UNAVAILABLE}. Pull-request evidence could not be collected for this calculation.
          </p>
        ) : (
          <>
            <table className="mt-2 w-full max-w-md text-sm">
              <caption className="sr-only">Number of pull requests in each state, and how much each state counts</caption>
              <thead>
                <tr className="text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  <th scope="col" className="py-1 pr-4">
                    State
                  </th>
                  <th scope="col" className="py-1 pr-4">
                    Pull requests
                  </th>
                  <th scope="col" className="py-1">
                    Counts as
                  </th>
                </tr>
              </thead>
              <tbody>
                {PULL_REQUEST_STATE_ORDER.map((state) => (
                  <tr key={state} className="border-t border-slate-200">
                    <th scope="row" className="py-1.5 pr-4 text-left font-normal text-slate-700">
                      {PULL_REQUEST_STATE_LABELS[state]}
                    </th>
                    <td className="py-1.5 pr-4 font-medium text-slate-900">{snapshot.pullRequestStates?.[state]}</td>
                    <td className="py-1.5 text-slate-700">× {config.pullRequestStateMultipliers[state]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">Each pull request is counted once, in its latest state.</p>
          </>
        )}
      </div>
    </div>
  )
}
