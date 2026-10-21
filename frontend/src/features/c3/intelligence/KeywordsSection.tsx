import { useState } from 'react'
import { getEmergingTopics } from '../api/c3Api'
import type { EmergingTopics, Keyword } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { focusRing, panelClass, sectionTitleClass } from '../ui/styles'
import { CATEGORY_COLORS, share } from './format'

/** A tiny one-line trend of a keyword's yearly share, drawn in its category's colour. */
function Sparkline({ keyword, color }: { keyword: Keyword; color: string }) {
  const values = keyword.yearly.map((p) => p.share)
  const max = Math.max(...values, 0.0001)
  const points = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 96 + 2},${30 - (v / max) * 26}`).join(' ')
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-24" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** The measured share of papers in the two periods, as two thin bars on one scale. */
function ShareBars({ keyword, color, scale }: { keyword: Keyword; color: string; scale: number }) {
  return (
    <span aria-hidden="true" className="block w-32 space-y-1">
      <span className="block h-1.5 rounded-r-full bg-slate-100">
        <span className="block h-1.5 rounded-r-full bg-slate-400" style={{ width: `${(keyword.baseShare / scale) * 100}%` }} />
      </span>
      <span className="block h-1.5 rounded-r-full bg-slate-100">
        <span className="block h-1.5 rounded-r-full" style={{ width: `${(keyword.recentShare / scale) * 100}%`, backgroundColor: color }} />
      </span>
    </span>
  )
}

function KeywordsView({ topics }: { topics: EmergingTopics }) {
  const [selected, setSelected] = useState(topics.categories[0]?.code ?? '')
  const category = topics.categories.find((c) => c.code === selected) ?? topics.categories[0]
  const base = topics.basePeriod.join('–')
  const recent = topics.recentPeriod.join('–')
  if (!category) return null
  const color = CATEGORY_COLORS[category.code] ?? '#52514e'
  const scale = Math.max(...category.keywords.map((k) => Math.max(k.baseShare, k.recentShare)), 0.0001)

  return (
    <div className={panelClass}>
      <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
        {topics.categories.map((c) => {
          const active = c.code === category.code
          return (
            <button key={c.code} type="button" aria-pressed={active} onClick={() => setSelected(c.code)}
              className={
                'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition ' + focusRing + ' ' +
                (active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')
              }>
              <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.code] }} />
              {c.code} {c.name}
            </button>
          )
        })}
      </div>
      <div className="mt-5 hidden grid-cols-[2rem_minmax(0,1fr)_8rem_10rem_5rem_6rem] gap-4 border-b border-slate-100 pb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase md:grid">
        <span>#</span>
        <span>Keyword</span>
        <span>{base} → {recent}</span>
        <span>Share of papers</span>
        <span className="text-right">Change</span>
        <span>Yearly trend</span>
      </div>
      <ol className="divide-y divide-slate-100" aria-label={`Rising keywords in ${category.code}`}>
        {category.keywords.map((k) => {
          const latest = k.yearly[k.yearly.length - 1]
          return (
            <li key={k.term} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-3 md:grid-cols-[2rem_minmax(0,1fr)_8rem_10rem_5rem_6rem]">
              <span className="inline-flex size-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600 tabular-nums">
                {k.rank}
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-slate-900">{k.label}</span>
                {k.similarTerms.length > 0 && (
                  <span className="block truncate text-xs text-slate-500">also counted as: {k.similarTerms.join(', ')}</span>
                )}
              </span>
              <span className="col-start-2 text-sm text-slate-700 tabular-nums md:col-start-auto">
                {share(k.baseShare)} → {share(k.recentShare)}
              </span>
              <span className="col-start-2 md:col-start-auto"><ShareBars keyword={k} color={color} scale={scale} /></span>
              <span className="col-start-2 text-sm font-semibold text-emerald-700 tabular-nums md:col-start-auto md:text-right">
                {k.changePercentagePoints > 0 ? '+' : ''}
                {k.changePercentagePoints.toFixed(1)} pts
              </span>
              <span className="col-start-2 md:col-start-auto"><Sparkline keyword={k} color={color} /></span>
              {latest && (
                <span className="sr-only">
                  In {latest.year}, {latest.papersWithTerm} of {latest.papers} papers mentioned it.
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-4 text-xs text-slate-500">
        Share of {category.code} papers whose title or abstract contains the term, {base} (grey bar) compared with {recent}
        {' '}(coloured bar). Only terms in at least {share(topics.minimumShare, 0)} of recent papers are listed. {topics.basis}
      </p>
    </div>
  )
}

export default function KeywordsSection() {
  const { state, reload } = useLoad(getEmergingTopics, 'emerging-topics')
  return (
    <section id="keywords" aria-labelledby="keywords-heading" className="scroll-mt-16">
      <h2 id="keywords-heading" className={sectionTitleClass}>
        Historically rising keywords
      </h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">
        The terms whose share of papers grew most in each area. This describes past publications; it is not a forecast
        and does not identify research gaps.
      </p>
      <StateView state={state} retry={reload} loadingText="Loading keywords…">
        {(topics) => <KeywordsView topics={topics} />}
      </StateView>
    </section>
  )
}
