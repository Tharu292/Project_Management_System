import type { ScoringConfigView } from '../api/types'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  METRICS_BY_CATEGORY,
  METRIC_LABELS,
  PULL_REQUEST_STATE_LABELS,
  PULL_REQUEST_STATE_ORDER,
  percent,
} from './contributionText'

const PROVISIONAL_MULTIPLIERS = 'PULL_REQUEST_STATE_MULTIPLIERS'

/**
 * How the indicator is weighted. Every figure is read from the scoring
 * configuration the backend returned; none is written in this component.
 */
export default function WeightsPanel({ config }: { config: ScoringConfigView }) {
  const multipliersProvisional = config.provisional.includes(PROVISIONAL_MULTIPLIERS)

  return (
    <section aria-labelledby="weights-heading" className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 id="weights-heading" className="text-base font-semibold text-slate-900">
        How the indicator is weighted
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Weights version {config.version}. Weights are configurable and may change as the research is validated.
      </p>

      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {CATEGORY_ORDER.map((category) => (
          <div key={category} role="group" aria-label={`${CATEGORY_LABELS[category]} weights`}>
            <p className="flex items-baseline justify-between gap-2 border-b border-slate-200 pb-1">
              <span className="text-sm font-semibold text-slate-900">{CATEGORY_LABELS[category]}</span>
              <span className="text-sm font-semibold text-slate-900">{percent(config.categoryWeights[category])}</span>
            </p>
            <ul className="mt-2 space-y-1">
              {METRICS_BY_CATEGORY[category].map((metric) => (
                <li key={metric} className="flex items-baseline justify-between gap-2 text-sm text-slate-700">
                  <span>{METRIC_LABELS[metric]}</span>
                  <span>{percent(config.metricWeights[metric])}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3">
        <table className="w-full max-w-md text-sm">
          <caption className="text-left text-sm font-semibold text-slate-900">
            How much a pull request counts in each state
            {multipliersProvisional && (
              <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                Provisional research assumption
              </span>
            )}
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">State</th>
              <th scope="col">Multiplier</th>
            </tr>
          </thead>
          <tbody>
            {PULL_REQUEST_STATE_ORDER.map((state) => (
              <tr key={state}>
                <th scope="row" className="py-0.5 text-left font-normal text-slate-700">
                  {PULL_REQUEST_STATE_LABELS[state]}
                </th>
                <td className="py-0.5 text-right text-slate-700">× {config.pullRequestStateMultipliers[state]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          Each pull request is counted once, in its latest state.
          {multipliersProvisional && ' These multipliers are being tested and are not a validated result.'}
        </p>
      </div>
    </section>
  )
}
