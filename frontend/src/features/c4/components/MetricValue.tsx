import type { Metric } from '../api/types'

interface MetricValueProps {
  metric: Metric
  /** What is being counted, for example "commits". */
  unit?: string
}

/**
 * Shows one contribution metric. A verified zero and unavailable evidence are
 * always worded differently: "0" means the source was read and shows no
 * activity; "Unavailable" means the source could not be read, and no number
 * is shown at all.
 */
export default function MetricValue({ metric, unit }: MetricValueProps) {
  if (metric.state === 'UNAVAILABLE') {
    return (
      <span className="inline-flex flex-col">
        <span className="font-semibold text-slate-500">Unavailable</span>
        <span className="text-xs text-slate-500">
          {metric.reason ?? 'This evidence could not be collected.'} It is not counted as zero.
        </span>
      </span>
    )
  }
  if (metric.state === 'VERIFIED_ZERO') {
    return (
      <span className="inline-flex flex-col">
        <span className="font-semibold text-slate-900">0{unit ? ` ${unit}` : ''}</span>
        <span className="text-xs text-slate-500">Verified: no activity recorded.</span>
      </span>
    )
  }
  return (
    <span className="font-semibold text-slate-900">
      {metric.value}
      {unit ? ` ${unit}` : ''}
    </span>
  )
}
