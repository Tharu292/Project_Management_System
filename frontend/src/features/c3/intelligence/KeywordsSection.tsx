import { useState } from 'react'
import { getEmergingTopics } from '../api/c3Api'
import type { EmergingTopics, Keyword } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { cardClass } from '../display'
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

function KeywordsView({ topics }: { topics: EmergingTopics }) {
  const [selected, setSelected] = useState(topics.categories[0]?.code ?? '')
  const category = topics.categories.find((c) => c.code === selected) ?? topics.categories[0]
  const base = topics.basePeriod.join('–')
  const recent = topics.recentPeriod.join('–')
  if (!category) return null
  const color = CATEGORY_COLORS[category.code] ?? '#52514e'

  return (
    <div className={cardClass}>
      <div role="group" aria-label="Category" className="flex flex-wrap gap-2">
        {topics.categories.map((c) => (
          <button key={c.code} type="button" aria-pressed={c.code === category.code} onClick={() => setSelected(c.code)}
            className={
              'rounded-lg border px-3 py-1.5 text-sm font-medium ' +
              (c.code === category.code ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-300 text-slate-700')
            }>
            {c.code} {c.name}
          </button>
        ))}
      </div>
      <ol className="mt-4 divide-y divide-slate-100" aria-label={`Rising keywords in ${category.code}`}>
        {category.keywords.map((k) => {
          const latest = k.yearly[k.yearly.length - 1]
          return (
            <li key={k.term} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
              <span className="w-6 text-sm text-slate-500 tabular-nums">{k.rank}</span>
              <span className="min-w-48 flex-1">
                <span className="font-medium text-slate-900">{k.label}</span>
                {k.similarTerms.length > 0 && (
                  <span className="block text-xs text-slate-500">also counted as: {k.similarTerms.join(', ')}</span>
                )}
              </span>
              <span className="text-sm text-slate-700 tabular-nums">
                {share(k.baseShare)} → {share(k.recentShare)} of papers
              </span>
              <span className="w-20 text-right text-sm font-medium text-green-800 tabular-nums">
                {k.changePercentagePoints > 0 ? '+' : ''}
                {k.changePercentagePoints.toFixed(1)} pts
              </span>
              <Sparkline keyword={k} color={color} />
              {latest && (
                <span className="sr-only">
                  In {latest.year}, {latest.papersWithTerm} of {latest.papers} papers mentioned it.
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-slate-500">
        Share of {category.code} papers whose title or abstract contains the term, {base} compared with {recent}. Only
        terms in at least {share(topics.minimumShare, 0)} of recent papers are listed. {topics.basis}
      </p>
    </div>
  )
}

export default function KeywordsSection() {
  const { state, reload } = useLoad(getEmergingTopics, 'emerging-topics')
  return (
    <section aria-labelledby="keywords-heading">
      <h2 id="keywords-heading" className="text-lg font-semibold text-slate-900">
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
