import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import FormField from '../../../components/FormField'
import { analyseOpportunities, getOpportunityEvaluation } from '../api/c3Api'
import type { CoverageAssessment, OpportunityAnalysis, OpportunityDirection, OpportunityEvaluation, PaperRef } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { TextAreaField } from '../components/fields'
import { formError } from '../display'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import { panel, panelClass, sectionTitleClass, violetButtonClass, type Tone } from '../ui/styles'
import { CATEGORY_COLORS } from './format'

const COVERAGE: Record<CoverageAssessment, { label: string; tone: Tone }> = {
  dataset_coverage: { label: 'Likely a dataset-coverage effect', tone: 'slate' },
  limited_evidence: { label: 'Limited evidence', tone: 'amber' },
  relatively_low: { label: 'Relatively low coverage', tone: 'violet' },
  moderate: { label: 'Moderate coverage', tone: 'indigo' },
  well_covered: { label: 'Well covered', tone: 'green' },
}

const FACTOR_LABELS: Record<string, string> = {
  relevance: 'Relevance to your text',
  low_coverage: 'Lower coverage in the corpus',
  growth: 'Growth from the older to the recent period',
  neighbour_support: 'Support among the 50 most similar papers',
}

const per100 = (share: number) => (share * 100).toFixed(2)

function PaperLink({ paper }: { paper: PaperRef }) {
  return (
    <span className="min-w-0">
      <a href={paper.url} target="_blank" rel="noreferrer noopener" className="font-medium text-indigo-700 hover:underline">
        {paper.title}
      </a>
      <span className="block text-xs text-slate-500">
        arXiv {paper.arxivId} · {paper.year} · {paper.primaryCategory}
      </span>
    </span>
  )
}

function DirectionCard({ direction, windows }: { direction: OpportunityDirection; windows: OpportunityAnalysis['windows'] }) {
  const coverage = COVERAGE[direction.coverage.assessment]
  const e = direction.evidence
  return (
    <li className={`${panel} p-5`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-semibold text-white">
          {direction.rank}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-slate-900">
            {direction.topics.map((t) => t.label).join('  ×  ')}
          </h4>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={coverage.tone} icon="info">{coverage.label}</Badge>
            {direction.topics.some((t) => t.lowerCoherence) && <Badge tone="amber" icon="alert">Includes a lower-coherence topic</Badge>}
          </div>
        </div>
        <span className="text-right text-xs text-slate-500">
          <span className="block text-lg font-semibold text-slate-900 tabular-nums">{direction.score.toFixed(2)}</span>
          ranking score
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-700">{direction.summary}</p>
      <p className="mt-1 text-xs text-slate-500">{direction.coverage.note}</p>
      <details className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Why this direction?</summary>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Score factors (relative to the other candidates)</p>
            <ul className="mt-2 space-y-2" aria-label={`Score factors for direction ${direction.rank}`}>
              {Object.entries(direction.factors).map(([name, value]) => (
                <li key={name} className="text-sm">
                  <span className="flex justify-between gap-2 text-slate-700">
                    <span>{FACTOR_LABELS[name] ?? name} <span className="text-slate-400">× {direction.weights[name]}</span></span>
                    <span className="font-medium tabular-nums">{value.toFixed(2)}</span>
                  </span>
                  <span aria-hidden="true" className="mt-1 block h-1.5 rounded-full bg-slate-200">
                    <span className="block h-1.5 rounded-full bg-violet-500" style={{ width: `${value * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              <dt>Papers {windows.recent.join('–')}</dt><dd className="text-right tabular-nums">{e.recentPapers} ({per100(e.recentShare)} per 100)</dd>
              <dt>Papers {windows.older.join('–')}</dt><dd className="text-right tabular-nums">{e.olderPapers} ({per100(e.olderShare)} per 100)</dd>
              <dt>All years in the corpus</dt><dd className="text-right tabular-nums">{e.corpusPapersCombining}</dd>
              <dt>Among your 50 most similar papers</dt><dd className="text-right tabular-nums">{e.similarPapersCombining}</dd>
              <dt>Other CS categories, {windows.recent.join('–')}</dt>
              <dd className="text-right tabular-nums">{e.otherCsCategoriesPapers} ({per100(e.otherCsCategoriesShare)} per 100)</dd>
            </dl>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Supporting papers (real arXiv papers combining both topics)</p>
            <ol className="mt-2 space-y-2 text-sm" aria-label={`Supporting papers for direction ${direction.rank}`}>
              {direction.supportingPapers.map((p) => (
                <li key={p.arxivId}><PaperLink paper={p} /></li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-slate-500">
              Topic terms: {direction.topics.map((t) => t.topTerms.join(', ')).join(' | ')}
            </p>
          </div>
        </div>
      </details>
    </li>
  )
}

function Analysis({ result }: { result: OpportunityAnalysis }) {
  return (
    <div className="mt-6 space-y-6" aria-label="Research opportunity analysis" role="region">
      <div className="grid gap-4 md:grid-cols-3">
        <div className={panelClass}>
          <p className="text-xs font-semibold tracking-wider text-violet-700 uppercase">Predicted area</p>
          {result.classification ? (
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[result.classification.category] }} />
              {result.classification.categoryName}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">The classifier is not available.</p>
          )}
          {result.classification && <p className="text-xs text-slate-500">{result.classification.category} · topic classifier</p>}
        </div>
        <div className={panelClass}>
          <p className="text-xs font-semibold tracking-wider text-violet-700 uppercase">Topic combinations checked</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{result.candidatesConsidered}</p>
          <p className="text-xs text-slate-500">{result.directions.length} with enough evidence are ranked below</p>
        </div>
        <div className={panelClass}>
          <p className="text-xs font-semibold tracking-wider text-violet-700 uppercase">Comparison periods</p>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {result.windows.older.join('–')} vs {result.windows.recent.join('–')}
          </p>
          <p className="text-xs text-slate-500">
            {result.windows.olderPapers.toLocaleString('en-GB')} and {result.windows.recentPapers.toLocaleString('en-GB')} papers in the corpus
          </p>
        </div>
      </div>

      <section aria-labelledby="directions-heading">
        <h3 id="directions-heading" className="font-semibold text-slate-900">Potential research directions</h3>
        <p className="mt-1 text-sm text-slate-500">
          Topic combinations close to your text, ranked by a documented score. They are suggestions grounded in the corpus,
          not claims that a topic is unexplored.
        </p>
        {result.directions.length === 0 ? (
          <div className="mt-3"><EmptyState icon="search" title="No combination has enough evidence">Try a longer or more specific abstract.</EmptyState></div>
        ) : (
          <ol className="mt-3 space-y-3" aria-label="Potential research directions">
            {result.directions.map((d) => <DirectionCard key={d.rank} direction={d} windows={result.windows} />)}
          </ol>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={panelClass} aria-labelledby="topics-heading">
          <h3 id="topics-heading" className="font-semibold text-slate-900">Topics discovered in your text</h3>
          <p className="mt-1 text-xs text-slate-500">From the NMF topic model; weight combines your text and its most similar papers.</p>
          <ul className="mt-4 space-y-3" aria-label="Discovered topics">
            {result.topicProfile.map((t) => (
              <li key={t.topicId}>
                <span className="flex justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-900">{t.label}{t.lowerCoherence && <span className="ml-2 text-xs text-amber-700">(lower coherence)</span>}</span>
                  <span className="text-slate-500 tabular-nums">{t.weight.toFixed(2)}</span>
                </span>
                <span aria-hidden="true" className="mt-1 block h-1.5 rounded-full bg-slate-100">
                  <span className="block h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(t.weight / (result.topicProfile[0]?.weight || 1), 1) * 100}%` }} />
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{t.topTerms.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={panelClass} aria-labelledby="similar-heading">
          <h3 id="similar-heading" className="font-semibold text-slate-900">Most similar published papers</h3>
          <p className="mt-1 text-xs text-slate-500">TF-IDF cosine similarity (0 to 1) over the corpus of arXiv papers.</p>
          <ol className="mt-4 space-y-3" aria-label="Similar papers">
            {result.similarPapers.map((p) => (
              <li key={p.arxivId} className="flex gap-3 text-sm">
                <span className="w-6 shrink-0 text-xs font-semibold text-slate-400 tabular-nums">{p.rank}</span>
                <PaperLink paper={p} />
                <span className="ml-auto shrink-0 text-xs text-slate-500 tabular-nums">{p.similarity?.toFixed(3)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {result.insufficientEvidence.length > 0 && (
        <section className={panelClass} aria-labelledby="insufficient-heading">
          <h3 id="insufficient-heading" className="font-semibold text-slate-900">Combinations with too little evidence to judge</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {result.insufficientEvidence.map((c) => (
              <li key={c.topics.map((t) => t.topicId).join('-')}>
                {c.topics.map((t) => t.label).join('  ×  ')}: {c.recentPapers} recent and {c.olderPapers} older papers
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className={panelClass}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Method and limitations</summary>
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
          {Object.entries(result.method).map(([k, v]) => (
            <div key={k} className="contents"><dt className="font-medium text-slate-700 capitalize">{k}</dt><dd className="text-slate-600">{v}</dd></div>
          ))}
        </dl>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900/90">
          {result.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </details>
    </div>
  )
}

function EvaluationSummary({ evaluation }: { evaluation: OpportunityEvaluation }) {
  const r = evaluation.retrieval
  const rec = evaluation.recommendations
  const chosen = evaluation.topicModel.selection.find((s) => s.k === evaluation.topicModel.chosenK)
  const back = rec.temporal_backtest_of_growth_signal
  return (
    <details className={panelClass}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">How this analysis was evaluated</summary>
      <ul className="mt-3 space-y-2 text-sm text-slate-700" aria-label="Opportunity analysis evaluation">
        <li>
          <span className="font-medium">Retrieval (known-item search, {r.queries} held-out queries):</span> Recall@10{' '}
          {r.known_item_search.recall_at_10.toFixed(3)}, MRR {r.known_item_search.mrr.toFixed(3)}. Searching by a paper’s
          title alone; there are no human relevance labels for wider relevance.
        </li>
        <li>
          <span className="font-medium">Category agreement of the 10 nearest papers:</span>{' '}
          {r.category_agreement_at_10.mean.toFixed(3)} against {r.category_agreement_at_10.expected_for_random_neighbours.toFixed(3)} for
          random papers (a proxy only).
        </li>
        <li>
          <span className="font-medium">Topic model:</span> {evaluation.topicModel.chosenK} topics, held-out NPMI coherence{' '}
          {chosen?.mean_npmi.toFixed(3)}, diversity {chosen?.diversity_top25.toFixed(2)}.
        </li>
        <li>
          <span className="font-medium">Recommendations:</span> {(rec.groundedness_share_with_3plus_supporting_papers * 100).toFixed(0)} in 100
          directions have at least 3 supporting papers; stability under word removal{' '}
          {rec.stability_mean_jaccard_top5_after_dropping_20pct_words?.toFixed(2)} (Jaccard).
        </li>
        <li>
          <span className="font-medium">Growth backtest:</span> earlier and later topic-pair growth correlate with Spearman ρ{' '}
          {back.spearman_rho.toFixed(2)} over {back.pairs} pairs.
        </li>
        <li className="font-medium text-amber-900">
          Expert review: {rec.expert_review.done ? 'done' : 'not yet done'}. {rec.status}
        </li>
      </ul>
    </details>
  )
}

export default function OpportunitiesSection() {
  const [title, setTitle] = useState('')
  const [abstract, setAbstract] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null)
  const [result, setResult] = useState<OpportunityAnalysis | null>(null)
  const evaluation = useLoad(getOpportunityEvaluation, 'opportunity-evaluation')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await analyseOpportunities(title, abstract))
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="opportunities" aria-labelledby="opportunities-heading" className="scroll-mt-16">
      <h2 id="opportunities-heading" className={sectionTitleClass}>
        Research opportunities and potential gaps
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Finds published papers close to your idea, the topics it combines, and how much the corpus has covered those
        combinations over time, then ranks potential directions with the evidence behind each one. Low coverage in this
        corpus is not proof of a research gap.
      </p>
      <form onSubmit={submit} className={panelClass + ' mt-4 space-y-4'} aria-label="Find research opportunities">
        {error && <Alert tone="error">{error.message}</Alert>}
        <FormField id="opportunity-title" label="Research title" value={title} onChange={(e) => setTitle(e.target.value)}
          maxLength={300} required error={error?.fields.title} />
        <TextAreaField id="opportunity-abstract" label="Research abstract" rows={6} value={abstract}
          onChange={(e) => setAbstract(e.target.value)} required error={error?.fields.abstract}
          hint="At least 30 words. Nothing you enter is stored." />
        <button type="submit" className={violetButtonClass} disabled={busy}>
          <Icon name="search" className="size-4" />
          {busy ? 'Analysing…' : 'Find research opportunities'}
        </button>
      </form>
      {result && <Analysis result={result} />}
      <div className="mt-4">
        <StateView state={evaluation.state} retry={evaluation.reload} loadingText="Loading the evaluation…">
          {(data) => <EvaluationSummary evaluation={data} />}
        </StateView>
      </div>
    </section>
  )
}
