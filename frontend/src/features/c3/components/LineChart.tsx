import { useState, type MouseEvent } from 'react'

// A small, dependency-free line chart for the historical trends.
// Lines are 2px with ringed end dots; gridlines are hairlines; text is always
// ink, never a series colour; hovering shows every series' value for one year.

export interface ChartSeries {
  key: string
  label: string
  color: string
  points: { x: number; y: number }[]
}

const WIDTH = 720
const HEIGHT = 300
const MARGIN = { top: 12, right: 16, bottom: 28, left: 52 }
const INK_SECONDARY = '#52514e'
const MUTED = '#898781'
const GRID = '#e1e0d9'
const AXIS = '#c3c2b7'
const SURFACE = '#ffffff'

function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value / 4) ?? 10
  return Math.ceil(value / (step * magnitude)) * step * magnitude
}

export default function LineChart({
  series,
  formatY,
  ariaLabel,
}: {
  series: ChartSeries[]
  formatY: (value: number) => string
  ariaLabel: string
}) {
  const [hoverX, setHoverX] = useState<number | null>(null)
  const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b)
  if (xs.length === 0) return null
  const yMax = niceMax(Math.max(...series.flatMap((s) => s.points.map((p) => p.y))))
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom
  const xScale = (x: number) =>
    MARGIN.left + (xs.length === 1 ? plotWidth / 2 : ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * plotWidth)
  const yScale = (y: number) => MARGIN.top + plotHeight - (y / yMax) * plotHeight
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)
  const xTicks = xs.filter((_, i) => xs.length <= 10 || i % 2 === 0)

  function handleMove(event: MouseEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const svgX = MARGIN.left + ((event.clientX - box.left) / box.width) * plotWidth
    const nearest = xs.reduce((best, x) => (Math.abs(xScale(x) - svgX) < Math.abs(xScale(best) - svgX) ? x : best))
    setHoverX(nearest)
  }

  const hovered =
    hoverX === null
      ? []
      : series
          .map((s) => ({ s, point: s.points.find((p) => p.x === hoverX) }))
          .filter((item): item is { s: ChartSeries; point: { x: number; y: number } } => item.point !== undefined)
          .sort((a, b) => b.point.y - a.point.y)
  const tooltipLeft = hoverX === null ? 0 : (xScale(hoverX) / WIDTH) * 100

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={ariaLabel}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={yScale(tick)} y2={yScale(tick)}
                stroke={tick === 0 ? AXIS : GRID} strokeWidth={1} />
              <text x={MARGIN.left - 8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle" fontSize={11}
                fill={INK_SECONDARY}>
                {formatY(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((x) => (
            <text key={x} x={xScale(x)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={INK_SECONDARY}>
              {x}
            </text>
          ))}
          {hoverX !== null && (
            <line x1={xScale(hoverX)} x2={xScale(hoverX)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke={MUTED}
              strokeWidth={1} />
          )}
          {series.map((s) => (
            <g key={s.key}>
              <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                points={s.points.map((p) => `${xScale(p.x)},${yScale(p.y)}`).join(' ')} />
              {s.points.length > 0 && (
                <circle cx={xScale(s.points[s.points.length - 1].x)} cy={yScale(s.points[s.points.length - 1].y)} r={4}
                  fill={s.color} stroke={SURFACE} strokeWidth={2} />
              )}
            </g>
          ))}
          {hovered.map(({ s, point }) => (
            <circle key={s.key} cx={xScale(point.x)} cy={yScale(point.y)} r={4} fill={s.color} stroke={SURFACE}
              strokeWidth={2} />
          ))}
          <rect x={MARGIN.left} y={MARGIN.top} width={plotWidth} height={plotHeight} fill="transparent"
            onMouseMove={handleMove} onMouseLeave={() => setHoverX(null)} />
        </svg>
        {hoverX !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-2 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
            style={tooltipLeft > 60 ? { right: `${100 - tooltipLeft + 2}%` } : { left: `${tooltipLeft + 2}%` }}
          >
            <p className="font-semibold text-slate-900">{hoverX}</p>
            <ul className="mt-1 space-y-0.5">
              {hovered.map(({ s, point }) => (
                <li key={s.key} className="flex items-center gap-2 text-slate-700">
                  <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="flex-1">{s.label}</span>
                  <span className="font-medium tabular-nums">{formatY(point.y)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
