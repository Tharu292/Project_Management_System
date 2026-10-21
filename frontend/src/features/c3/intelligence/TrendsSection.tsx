import { useState } from 'react'
import { getTrends } from '../api/c3Api'
import type { Trends } from '../api/types'
import { useLoad } from '../api/useLoad'
import BarChart from '../components/BarChart'
import LineChart from '../components/LineChart'
import StateView from '../components/StateView'
import FilterChips from '../ui/FilterChips'
import Icon from '../ui/Icon'
import { panelClass, quietButtonClass, sectionTitleClass } from '../ui/styles'
import { CATEGORY_COLORS, compactNumber, share, wholeNumber } from './format'

type Measure = 'papers' | 'shareOfCs'

function TrendsView({ trends }: { trends: Trends }) {
  const [measure, setMeasure] = useState<Measure>('papers')
  const [showTable, setShowTable] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)
  const lastFull = trends.source.lastFullYear
  // The newest year is incomplete, so it is left out of the chart (it stays in the data).
  const complete = trends.series.map((s) => ({ ...s, points: s.points.filter((p) => !p.incomplete) }))
  const years = complete[0]?.points.map((p) => p.year) ?? []
  const format = measure === 'papers' ? compactNumber : (v: number) => share(v, 0)
  const byGrowth = [...trends.categories].sort((a, b) => b.growthMultiple - a.growthMultiple)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips label="Measure" value={measure} onChange={setMeasure} options={[
            { value: 'papers', label: 'Papers per year' },
            { value: 'shareOfCs', label: 'Share of all CS papers' },
          ]} />
          <button type="button" className={quietButtonClass} onClick={() => setShowTable(!showTable)}>
            <Icon name={showTable ? 'trend' : 'table'} className="size-4" />
            {showTable ? 'Show chart' : 'Show table'}
          </button>
        </div>
        <div className="mt-5">
          {showTable ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">
                  {measure === 'papers' ? 'Papers per year' : 'Share of all CS papers'} by category
                </caption>
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                    <th scope="col" className="py-2 pr-4">Year</th>
                    {complete.map((s) => (
                      <th key={s.category} scope="col" className="py-2 pr-4">{s.category}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {years.map((year) => (
                    <tr key={year} className="border-t border-slate-100">
                      <th scope="row" className="py-1.5 pr-4 text-left font-medium text-slate-800">{year}</th>
                      {complete.map((s) => {
                        const point = s.points.find((p) => p.year === year)
                        return (
                          <td key={s.category} className="py-1.5 pr-4 text-slate-700">
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
              highlight={highlight}
              onHighlight={setHighlight}
              series={complete.map((s) => ({
                key: s.category,
                label: `${s.category} ${s.name}`,
                color: CATEGORY_COLORS[s.category] ?? '#52514e',
                points: s.points.map((p) => ({ x: p.year, y: measure === 'papers' ? p.papers : p.shareOfCs })),
              }))}
            />
          )}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          {trends.basis} Data up to {trends.source.latestSubmission}; {lastFull + 1} is incomplete and not shown.
          {!showTable && ' Select an area in the legend to highlight it.'}
        </p>
      </div>
      <div className={panelClass}>
        <h3 className="font-semibold text-slate-900">Growth since {trends.indexBaseYear}</h3>
        <p className="mt-1 text-xs text-slate-500">
          Papers in {lastFull} compared with {trends.indexBaseYear}, as a multiple.
        </p>
        <div className="mt-5">
          <BarChart
            ariaLabel={`Growth of papers per year from ${trends.indexBaseYear} to ${lastFull}, by arXiv category`}
            series={[{ key: 'growth', label: 'Growth multiple', color: '#6250d6' }]}
            rows={byGrowth.map((c) => ({
              key: c.code,
              label: `${c.code} ${c.name}`,
              color: CATEGORY_COLORS[c.code],
              values: [{ value: c.growthMultiple, text: `×${c.growthMultiple.toFixed(1)}` }],
            }))}
          />
        </div>
        <ul className="mt-6 space-y-1 border-t border-slate-100 pt-4 text-xs text-slate-500">
          {byGrowth.map((c) => (
            <li key={c.code}>
              {c.code}: {wholeNumber(c.papersBaseYear)} → {wholeNumber(c.papersLastFullYear)} papers; {share(c.shareOfCsLastFullYear)} of CS papers in {lastFull}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function TrendsSection() {
  const { state, reload } = useLoad(getTrends, 'trends')
  return (
    <section id="trends" aria-labelledby="trends-heading" className="scroll-mt-16">
      <h2 id="trends-heading" className={sectionTitleClass}>
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
