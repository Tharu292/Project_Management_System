// A small horizontal bar chart (grouped or single-series), with no dependency.
// Bars grow from a zero baseline with rounded ends; each bar's value is written at
// its tip in ink (never in the series colour); a legend names every series.

export interface BarSeries {
  key: string
  label: string
  color: string
}

export interface BarRow {
  key: string
  label: string
  /** One value per series, in the order of `series`. */
  values: { value: number; text: string }[]
  /** Optional colour for a single-series chart where each row has its own colour. */
  color?: string
}

export default function BarChart({
  ariaLabel,
  series,
  rows,
  max,
}: {
  ariaLabel: string
  series: BarSeries[]
  rows: BarRow[]
  max?: number
}) {
  const top = max ?? Math.max(...rows.flatMap((r) => r.values.map((v) => v.value)), 0.0001)
  return (
    <figure aria-label={ariaLabel}>
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700" aria-label="Series">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.key} className="grid gap-1.5 sm:grid-cols-[minmax(8rem,14rem)_1fr] sm:items-center sm:gap-4">
            <span className="text-sm font-medium text-slate-800">{row.label}</span>
            <span className="space-y-1.5">
              {row.values.map((v, i) => (
                <span key={series[i]?.key ?? i} className="flex items-center gap-2">
                  <span className="h-3 flex-1 rounded-r-full bg-slate-100">
                    <span
                      className="block h-3 rounded-r-full"
                      style={{
                        width: `${Math.max((v.value / top) * 100, 0.5)}%`,
                        backgroundColor: row.color ?? series[i]?.color,
                      }}
                    />
                  </span>
                  <span className="w-14 text-right text-sm font-medium text-slate-700 tabular-nums">{v.text}</span>
                  {series.length > 1 && <span className="sr-only">{series[i]?.label}</span>}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
