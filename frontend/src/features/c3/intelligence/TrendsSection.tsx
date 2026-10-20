import { useState } from 'react'
import { secondaryButtonClass } from '../../../components/AppShell'
import { getTrends } from '../api/c3Api'
import type { Trends } from '../api/types'
import { useLoad } from '../api/useLoad'
import LineChart from '../components/LineChart'
import StateView from '../components/StateView'
import { cardClass } from '../display'
import { CATEGORY_COLORS, compactNumber, share, wholeNumber } from './format'

type Measure = 'papers' | 'shareOfCs'

function TrendsView({ trends }: { trends: Trends }) {
  const [measure, setMeasure] = useState<Measure>('papers')
  const [showTable, setShowTable] = useState(false)
  const lastFull = trends.source.lastFullYear
  // The newest year is incomplete, so it is left out of the chart (it stays in the data).
  const complete = trends.series.map((s) => ({ ...s, points: s.points.filter((p) => !p.incomplete) }))
  const years = complete[0]?.points.map((p) => p.year) ?? []
  const format = measure === 'papers' ? compactNumber : (v: number) => share(v, 0)

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Measure" className="flex gap-2">
            {(
              [
                ['papers', 'Papers per year'],
                ['shareOfCs', 'Share of all CS papers'],
              ] as [Measure, string][]
            ).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={measure === value} onClick={() => setMeasure(value)}
                className={
                  'rounded-lg border px-3 py-1.5 text-sm font-medium ' +
                  (measure === value ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-300 text-slate-700')
                }>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className={secondaryButtonClass} onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Show chart' : 'Show table'}
          </button>
        </div>
        <div className="mt-4">
          {showTable ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">
                  {measure === 'papers' ? 'Papers per year' : 'Share of all CS papers'} by category
                </caption>
                <thead>
                  <tr className="text-left text-slate-600">
                    <th scope="col" className="py-1 pr-4">Year</th>
                    {complete.map((s) => (
                      <th key={s.category} scope="col" className="py-1 pr-4">{s.category}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {years.map((year) => (
                    <tr key={year} className="border-t border-slate-100">
                      <th scope="row" className="py-1 pr-4 text-left font-medium text-slate-800">{year}</th>
                      {complete.map((s) => {
                        const point = s.points.find((p) => p.year === year)
                        return (
                          <td key={s.category} className="py-1 pr-4 text-slate-700">
                            {point ? (measure === 'papers' ? wholeNumber(point.papers) : share(point.shareOfCs)) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <LineChart
              ariaLabel={`${measure === 'papers' ? 'Papers per year' : 'Share of all CS papers'} by arXiv category, ${years[0]}–${lastFull}. Use "Show table" for the values.`}
              formatY={format}
              series={complete.map((s) => ({
                key: s.category,
                label: `${s.category} ${s.name}`,
                color: CATEGORY_COLORS[s.category] ?? '#52514e',
                points: s.points.map((p) => ({ x: p.year, y: measure === 'papers' ? p.papers : p.shareOfCs })),
              }))}
            />
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {trends.basis} Data up to {trends.source.latestSubmission}; {lastFull + 1} is incomplete and not shown.
        </p>
      </div>
      <div className={cardClass + ' overflow-x-auto'}>
        <table className="min-w-full text-sm">
          <caption className="mb-2 text-left font-semibold text-slate-900">
            Growth since {trends.indexBaseYear}
          </caption>
          <thead>
            <tr className="text-left text-slate-600">
              <th scope="col" className="py-1 pr-4">Category</th>
              <th scope="col" className="py-1 pr-4">Papers {trends.indexBaseYear}</th>
              <th scope="col" className="py-1 pr-4">Papers {lastFull}</th>
              <th scope="col" className="py-1 pr-4">Growth</th>
              <th scope="col" className="py-1 pr-4">Share of CS {lastFull}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {trends.categories.map((c) => (
              <tr key={c.code} className="border-t border-slate-100">
                <th scope="row" className="py-1 pr-4 text-left font-medium text-slate-800">
                  <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[c.code] }} />
                  {c.code} {c.name}
                </th>
                <td className="py-1 pr-4">{wholeNumber(c.papersBaseYear)}</td>
                <td className="py-1 pr-4">{wholeNumber(c.papersLastFullYear)}</td>
                <td className="py-1 pr-4">×{c.growthMultiple.toFixed(1)}</td>
                <td className="py-1 pr-4">{share(c.shareOfCsLastFullYear)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function TrendsSection() {
  const { state, reload } = useLoad(getTrends, 'trends')
  return (
    <section aria-labelledby="trends-heading">
      <h2 id="trends-heading" className="text-lg font-semibold text-slate-900">
        Historical research trends
      </h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">
        arXiv papers per year in the five areas the model knows, counted from the full Cornell arXiv metadata snapshot.
      </p>
      <StateView state={state} retry={reload} loadingText="Loading trends…">
        {(trends) => <TrendsView trends={trends} />}
      </StateView>
    </section>
  )
}
