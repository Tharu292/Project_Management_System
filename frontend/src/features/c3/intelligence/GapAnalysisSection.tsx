import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import FormField from '../../../components/FormField'
import { analyseGaps, getGapEvaluation } from '../api/c3Api'
import type {
  AspectCoverage, AuthorStatement, GapAnalysis, GapEvaluation, GapPaper, GapUncertainty, InferredGap, PotentialGap,
} from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { TextAreaField } from '../components/fields'
import { formError } from '../display'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import { panel, panelClass, sectionTitleClass, violetButtonClass, type Tone } from '../ui/styles'

const per100 = (share: number) => (share * 100).toFixed(1)

const RULE_LABELS: Record<InferredGap['rule'], string> = {
  anchored: 'In your text, rare in close abstracts',
  area: 'Rarer than in the wider area',
  'anchored+area': 'In your text and rarer than in the wider area',
}

function PaperLinks({ papers }: { papers?: GapPaper[] }) {
  if (!papers || papers.length === 0) return <span className="text-xs text-slate-500">No close abstract mentions it.</span>
  return (
    <ul className="space-y-1 text-xs">
      {papers.map((p) => (
        <li key={p.arxivId}>
          <a href={p.url} target="_blank" rel="noreferrer noopener" className="text-indigo-700 hover:underline">{p.title}</a>
          <span className="text-slate-500"> · arXiv {p.arxivId} · {p.year}</span>
        </li>
      ))}
    </ul>
  )
}

function CoverageBar({ item }: { item: AspectCoverage }) {
  return (
    <span aria-hidden="true" className="relative block h-2 rounded-full bg-slate-100">
      <span className="absolute inset-y-0 rounded-full bg-indigo-200"
        style={{ left: `${item.interval95[0] * 100}%`, width: `${(item.interval95[1] - item.interval95[0]) * 100}%` }} />
      <span className="absolute inset-y-0 left-0 rounded-full bg-indigo-600" style={{ width: `${item.share * 100}%` }} />
    </span>
  )
}

const UNCERTAINTY_TONE: Record<GapUncertainty, Tone> = { corroborated: 'violet', indicative: 'indigo', exploratory: 'slate' }

const SIGNAL_LABELS: Record<PotentialGap['signals'][number], string> = {
  author_statements: 'Author statement',
  low_coverage: 'Few close abstracts mention it',
}

function Quote({ statement }: { statement: Omit<AuthorStatement, 'aspects'> }) {
  return (
    <figure className="rounded-xl border-l-4 border-emerald-400 bg-emerald-50/50 px-4 py-3">
      <blockquote className="text-sm text-slate-800">“{statement.quote}”</blockquote>
      <figcaption className="mt-1 text-xs text-slate-500">
        <a href={statement.paper.url} target="_blank" rel="noreferrer noopener" className="font-medium text-indigo-700 hover:underline">
          {statement.paper.title}
        </a>{' '}
        · arXiv {statement.paper.arxivId} · {statement.paper.year} · {statement.typeLabel}
      </figcaption>
    </figure>
  )
}

function PotentialGaps({ result }: { result: GapAnalysis }) {
  const screening = result.potentialGapsScreening
  return (
    <section className={panelClass} aria-labelledby="potential-gaps-heading">
      <h3 id="potential-gaps-heading" className="flex items-center gap-2 font-semibold text-slate-900">
        <Icon name="flag" className="size-5 text-violet-600" /> Potential Research Gaps Identified
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Candidates to investigate, each backed by quoted author statements or coverage counts and connected to your text.
        They are signals from abstracts, not verified gaps: check the full papers and newer work, and discuss them with your supervisor.
      </p>
      {result.potentialGaps.length === 0 ? (
        <div className="mt-4"><EmptyState icon="search" title="No evidence-supported potential gaps found">
          No candidate met the evidence and relevance rules among the {result.relevantTotal} closest abstracts. This does not
          mean none exist: limitations and future work are often stated only in full papers.
        </EmptyState></div>
      ) : (
        <ol className="mt-4 space-y-4" aria-label="Potential research gaps">
          {result.potentialGaps.map((g, i) => (
            <li key={`${i}-${g.heading}`} className="rounded-xl border border-violet-100 bg-violet-50/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{g.heading}</span>
                {g.aspect && <Badge tone="slate">{g.aspect.familyLabel}</Badge>}
                <Badge tone={UNCERTAINTY_TONE[g.uncertainty]} icon="info">{g.uncertaintyLabel}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">Signals: {g.signals.map((s) => SIGNAL_LABELS[s]).join(' + ')}</p>
              <p className="mt-2 text-sm text-slate-700">{g.explanation}</p>
              {g.notes.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-amber-900" aria-label={`Cautions for ${g.heading}`}>
                  {g.notes.map((n) => (
                    <li key={n} className="flex gap-1.5"><Icon name="alert" className="mt-px size-3.5 shrink-0" />{n}</li>
                  ))}
                </ul>
              )}
              {g.statements.length > 0 && (
                <div className="mt-3 space-y-2">
                  {g.statements.map((s) => <Quote key={`${s.paper.arxivId}-${s.quote.slice(0, 24)}`} statement={s} />)}
                  {g.statementCount > g.statements.length && (
                    <p className="text-xs text-slate-500">and {g.statementCount - g.statements.length} more supporting statements</p>
                  )}
                </div>
              )}
              {g.coverage && g.statements.length === 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-700">Close abstracts that do mention it:</p>
                  <PaperLinks papers={g.coverage.examplePapers} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <details className="mt-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">How candidates were screened and what the labels mean</summary>
        <p className="mt-2">
          Of {screening.statementsConsidered} candidate statements in the closest abstracts,{' '}
          {screening.excluded.limitationOfPriorWorkOrAddressedByThePaper} describe limitations of earlier work or ones the paper says
          it addresses, {screening.excluded.limitationWithUnclearOwner} have an unclear owner and{' '}
          {screening.excluded.notConnectedToYourText} are not connected to your text. They are listed only under all author
          statements. {screening.excluded.rarerThanTheWiderAreaOnly} aspects that are only rarer than in the wider topic area
          are shown as coverage context, not as gaps.
        </p>
        <ul className="mt-2 space-y-1" aria-label="Uncertainty labels">
          {result.uncertaintyLabels.map((u) => (
            <li key={u.level}><span className="font-semibold text-slate-700">{u.label}: </span><span>{u.rule}</span></li>
          ))}
        </ul>
      </details>
    </section>
  )
}

function Result({ result }: { result: GapAnalysis }) {
  const statementGroups = Object.entries(result.authorStatements)
  const areaContext = result.inferredGaps.filter((g) => g.rule === 'area')
  return (
    <div className="mt-6 space-y-6" role="region" aria-label="Aspect-level gap analysis">
      <div className={`${panel} flex flex-wrap items-center gap-3 p-5`}>
        <Badge tone="amber" icon="info">Abstract-level evidence</Badge>
        <p className="text-sm text-slate-700">
          Based on the {result.relevantTotal} most similar abstracts, compared with {result.wideArea.papers.toLocaleString('en-GB')}{' '}
          papers in the wider area ({result.wideArea.topics.map((t) => t.label).join('; ')}).
        </p>
        {result.yourAspects.length > 0 && (
          <p className="w-full text-xs text-slate-500">
            Aspects found in your text: {result.yourAspects.map((a) => a.label).join(', ')}
          </p>
        )}
      </div>

      <PotentialGaps result={result} />

      <h3 className="pt-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">Coverage context (not gaps)</h3>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className={panelClass} aria-labelledby="well-covered-heading">
          <h3 id="well-covered-heading" className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon name="check" className="size-5 text-emerald-600" /> Well-covered aspects
          </h3>
          <p className="mt-1 text-xs text-slate-500">Mentioned in many of the closest abstracts (bar: share; light band: 95% interval).</p>
          {result.wellCovered.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No aspect is mentioned by 10 or more of the closest abstracts.</p>
          ) : (
            <ul className="mt-4 space-y-3" aria-label="Well-covered aspects">
              {result.wellCovered.map((a) => (
                <li key={a.aspectId} className="text-sm">
                  <span className="flex justify-between gap-2">
                    <span className="font-medium text-slate-900">{a.label} <span className="text-xs font-normal text-slate-500">· {a.familyLabel}</span></span>
                    <span className="text-slate-600 tabular-nums">{a.relevantPapers} of {a.relevantTotal}</span>
                  </span>
                  <span className="mt-1 block"><CoverageBar item={a} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={panelClass} aria-labelledby="inferred-heading">
          <h3 id="inferred-heading" className="flex items-center gap-2 font-semibold text-slate-900">
            <Icon name="search" className="size-5 text-slate-500" /> Less common here than in the wider area
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Aspects common in the broader topic area but rare among the closest abstracts. This usually reflects how the
            subfield differs from its neighbours, so these are context, not gaps.
          </p>
          {areaContext.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No aspect is notably rarer here than in the wider area.</p>
          ) : (
            <ol className="mt-4 space-y-3" aria-label="Area comparison">
              {areaContext.map((g) => (
                <li key={g.aspectId} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{g.label}</span>
                    <Badge tone="slate">{g.familyLabel}</Badge>
                    <Badge tone="slate">{RULE_LABELS[g.rule]}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{g.why}</p>
                  <details className="mt-2 text-xs text-slate-600">
                    <summary className="cursor-pointer font-medium text-slate-700">Counts behind this comparison</summary>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                      <dt>Closest abstracts mentioning it</dt><dd className="text-right tabular-nums">{g.relevantPapers} of {g.relevantTotal}</dd>
                      <dt>95% interval</dt><dd className="text-right tabular-nums">{per100(g.interval95[0])}–{per100(g.interval95[1])} per 100</dd>
                      <dt>Wider area</dt><dd className="text-right tabular-nums">{per100(g.areaShare)} per 100 ({g.areaPapers} papers)</dd>
                      {g.qValue !== undefined && (<><dt>Exploratory test (BH q)</dt><dd className="text-right tabular-nums">{g.qValue.toFixed(3)}</dd></>)}
                    </dl>
                    <p className="mt-2 font-medium text-slate-700">Close abstracts that do mention it:</p>
                    <PaperLinks papers={g.examplePapers} />
                  </details>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className={panelClass} aria-labelledby="authors-heading">
        <h3 id="authors-heading" className="flex items-center gap-2 font-semibold text-slate-900">
          <Icon name="document" className="size-5 text-emerald-600" /> All author statements (raw, quoted from abstracts)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Exact quotes from the original arXiv abstracts of the closest papers, grouped by an automatically assigned type that
          may be wrong. Not every statement is a gap: limitations of earlier work usually describe the problem the paper itself
          addresses.
        </p>
        {statementGroups.length === 0 ? (
          <div className="mt-4"><EmptyState icon="document" title="No author statements found">
            None of the closest abstracts contains a recognised limitation or future-work statement. Such statements are often only in the full papers.
          </EmptyState></div>
        ) : (
          <div className="mt-5 space-y-3">
            {statementGroups.map(([kind, items]) => (
              <details key={kind} className="rounded-xl bg-slate-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  {items[0].typeLabel} ({items.length})
                </summary>
                <ul className="mt-3 space-y-2" aria-label={items[0].typeLabel}>
                  {items.map((s) => <li key={`${s.paper.arxivId}-${s.quote.slice(0, 24)}`}><Quote statement={s} /></li>)}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className={panelClass} aria-labelledby="terms-heading">
        <h3 id="terms-heading" className="font-semibold text-slate-900">Your most distinctive terms in the closest abstracts</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Distinctive terms">
          {result.methodTerms.map((t) => (
            <li key={t.term} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
              <span className="text-slate-800">{t.term}</span>
              <span className="text-slate-500 tabular-nums">
                {t.relevantPapers} of {t.relevantTotal}{t.fewMentions && <span className="ml-1 text-amber-700">(few)</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <details className={panelClass}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Method and limitations</summary>
        <p className="mt-3 text-sm text-slate-700">{result.basis}</p>
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
          {Object.entries(result.method).map(([k, v]) => (
            <div key={k} className="contents"><dt className="font-medium text-slate-700">{k}</dt><dd className="text-slate-600">{v}</dd></div>
          ))}
        </dl>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900/90">
          {result.limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </details>
    </div>
  )
}

function Evaluation({ evaluation }: { evaluation: GapEvaluation }) {
  const s = evaluation.evidenceStore
  return (
    <details className={panelClass}>
      <summary className="cursor-pointer text-sm font-semibold text-slate-900">How this analysis is checked</summary>
      <ul className="mt-3 space-y-2 text-sm text-slate-700" aria-label="Gap analysis evaluation">
        <li>
          Evidence store: {s.papers.toLocaleString('en-GB')} abstracts, {s.aspects.total.toLocaleString('en-GB')} aspects
          ({s.aspects.curated} curated, {s.aspects.datasets} datasets), {s.statements.total.toLocaleString('en-GB')} candidate statements.
        </li>
        <li>
          Quotes: {s.statements.verified_exact_substrings.toLocaleString('en-GB')} of {s.statements.total.toLocaleString('en-GB')}{' '}
          checked as exact text of the original abstracts when the store was built.
        </li>
        <li className="font-medium text-amber-900">Manual review: {evaluation.manualReview.status}</li>
      </ul>
    </details>
  )
}

export default function GapAnalysisSection() {
  const [title, setTitle] = useState('')
  const [abstract, setAbstract] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null)
  const [result, setResult] = useState<GapAnalysis | null>(null)
  const evaluation = useLoad(getGapEvaluation, 'gap-evaluation')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await analyseGaps(title, abstract))
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="gaps" aria-labelledby="gaps-heading" className="scroll-mt-16">
      <h2 id="gaps-heading" className={sectionTitleClass}>Aspect-level research gap analysis</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Which aspects of your topic (evaluation settings, metrics, application domains, datasets) the closest published
        abstracts cover well or rarely, and what their authors themselves report as limitations, under-explored problems
        or future work. Abstract-level evidence only: it does not show that something has never been studied.
      </p>
      <form onSubmit={submit} className={panelClass + ' mt-4 space-y-4'} aria-label="Analyse research gaps">
        {error && <Alert tone="error">{error.message}</Alert>}
        <FormField id="gap-title" label="Gap analysis title" value={title} onChange={(e) => setTitle(e.target.value)}
          maxLength={300} required error={error?.fields.title} />
        <TextAreaField id="gap-abstract" label="Gap analysis abstract" rows={6} value={abstract}
          onChange={(e) => setAbstract(e.target.value)} required error={error?.fields.abstract}
          hint="At least 30 words. Nothing you enter is stored." />
        <button type="submit" className={violetButtonClass} disabled={busy}>
          <Icon name="search" className="size-4" />
          {busy ? 'Analysing…' : 'Analyse research gaps'}
        </button>
      </form>
      {result && <Result result={result} />}
      <div className="mt-4">
        <StateView state={evaluation.state} retry={evaluation.reload} loadingText="Loading the review status…">
          {(data) => <Evaluation evaluation={data} />}
        </StateView>
      </div>
    </section>
  )
}
