import type { SnapshotView } from '../api/types'
import CoverageBadge from '../components/CoverageBadge'
import { EVIDENCE_UNAVAILABLE, formatDate, formatScore, unavailableSourceNames } from './contributionText'

const WIDTH = 600
const HEIGHT = 200
const PADDING = { top: 16, right: 16, bottom: 28, left: 36 }

/** At least this many stored snapshots are needed before anything is called a trend. */
export const MINIMUM_SNAPSHOTS_FOR_TREND = 2

/**
 * The stored indicators of one student over time, oldest to newest. It plots
 * only snapshots that really exist: nothing is interpolated, smoothed or
 * projected, and a snapshot without an indicator leaves a gap. Points resting
 * on partial evidence are drawn hollow. The table underneath carries the same
 * figures for anyone who cannot use the chart.
 */
export default function ContributionTrendChart({ history }: { history: SnapshotView[] }) {
  const oldestFirst = [...history].reverse()

  if (oldestFirst.length < MINIMUM_SNAPSHOTS_FOR_TREND) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
        Not enough history for a trend. A trend appears once at least two calculations have been stored.
      </p>
    )
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const x = (index: number) => PADDING.left + (plotWidth * index) / (oldestFirst.length - 1)
  const y = (score: number) => PADDING.top + plotHeight * (1 - Math.max(0, Math.min(100, score)) / 100)
  const points = oldestFirst
    .map((snapshot, index) => ({ snapshot, index }))
    .filter(
      (point): point is { snapshot: SnapshotView & { indicator: number }; index: number } =>
        point.snapshot.indicator !== null,
    )

  // A line joins neighbouring snapshots only; a snapshot without an indicator breaks it.
  const segments: string[] = []
  for (let i = 1; i < points.length; i++) {
    if (points[i].index === points[i - 1].index + 1) {
      segments.push(
        `M ${x(points[i - 1].index)} ${y(points[i - 1].snapshot.indicator)} L ${x(points[i].index)} ${y(points[i].snapshot.indicator)}`,
      )
    }
  }

  return (
    <figure aria-labelledby="trend-caption">
      <figcaption id="trend-caption" className="text-sm font-semibold text-slate-900">
        Stored Contribution Indicators over time
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Contribution Indicator at ${oldestFirst.length} stored calculations, from ${formatDate(oldestFirst[0].periodEnd)} to ${formatDate(oldestFirst[oldestFirst.length - 1].periodEnd)}. The table below gives each value.`}
        className="mt-2 w-full"
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(tick)} y2={y(tick)} className="stroke-slate-200" />
            <text x={PADDING.left - 6} y={y(tick) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {tick}
            </text>
          </g>
        ))}
        <path d={segments.join(' ')} fill="none" className="stroke-indigo-600" strokeWidth="2" />
        {points.map(({ snapshot, index }) => (
          <circle
            key={snapshot.periodEnd + snapshot.computedAt}
            cx={x(index)}
            cy={y(snapshot.indicator)}
            r="4"
            className={snapshot.partial ? 'fill-white stroke-indigo-600' : 'fill-indigo-600 stroke-indigo-600'}
            strokeWidth="2"
          />
        ))}
        <text x={PADDING.left} y={HEIGHT - 8} className="fill-slate-500 text-[11px]">
          {formatDate(oldestFirst[0].periodEnd)}
        </text>
        <text x={WIDTH - PADDING.right} y={HEIGHT - 8} textAnchor="end" className="fill-slate-500 text-[11px]">
          {formatDate(oldestFirst[oldestFirst.length - 1].periodEnd)}
        </text>
      </svg>
      <p className="mt-1 text-xs text-slate-500">
        Filled points rest on complete evidence; hollow points on partial evidence. Each calculation covers the
        project from its start to the date shown.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">Stored Contribution Indicators, newest first</caption>
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
              <th scope="col" className="py-1 pr-4">
                Calculated to
              </th>
              <th scope="col" className="py-1 pr-4">
                Indicator
              </th>
              <th scope="col" className="py-1">
                Evidence
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((snapshot) => (
              <tr key={snapshot.periodEnd + snapshot.computedAt} className="border-t border-slate-200">
                <th scope="row" className="py-1.5 pr-4 text-left font-normal whitespace-nowrap text-slate-700">
                  {formatDate(snapshot.periodEnd)}
                </th>
                <td className="py-1.5 pr-4 text-slate-900">
                  {snapshot.indicator === null ? (
                    <span className="text-slate-500">{EVIDENCE_UNAVAILABLE}</span>
                  ) : (
                    <span className="font-medium">{formatScore(snapshot.indicator)}</span>
                  )}
                </td>
                <td className="py-1.5">
                  <CoverageBadge partial={snapshot.partial} unavailableSources={unavailableSourceNames(snapshot)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
