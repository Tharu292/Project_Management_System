import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import FormField from '../../../components/FormField'
import { predictTopic } from '../api/c3Api'
import type { Prediction } from '../api/types'
import { TextAreaField } from '../components/fields'
import { formError } from '../display'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import { panel, panelClass, sectionTitleClass, violetButtonClass } from '../ui/styles'
import { CATEGORY_COLORS } from './format'

const MIN_WORDS = 30

function wordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

/** The result shows the category and the order of the others. Decision scores are deliberately not shown. */
function Result({ prediction }: { prediction: Prediction }) {
  const others = prediction.ranking.slice(1)
  const color = CATEGORY_COLORS[prediction.category] ?? '#6250d6'
  return (
    <section className={panel + ' overflow-hidden'} aria-label="Classification result">
      <div className="border-b border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6">
        <p className="text-xs font-semibold tracking-wider text-violet-700 uppercase">Closest research area</p>
        <p className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900">
          <span aria-hidden="true" className="inline-block size-3.5 rounded-full ring-4 ring-white" style={{ backgroundColor: color }} />
          {prediction.categoryName}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          arXiv category {prediction.category} · model {prediction.modelVersion}
        </p>
      </div>
      <div className="space-y-5 p-6">
        <div>
          <p className="text-sm font-semibold text-slate-900">Other areas, from closer to further</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700 marker:font-semibold marker:text-slate-400">
            {others.map((r) => (
              <li key={r.category}>
                {r.categoryName} ({r.category})
              </li>
            ))}
          </ol>
        </div>
        <details className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold text-slate-800">Why is there no confidence percentage?</summary>
          <p className="mt-2">
            A Linear SVM gives each area a decision score that only ranks the areas for this text. The scores are not
            probabilities, so turning them into a percentage would be misleading. The ranking above is what the model
            actually supports.
          </p>
        </details>
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Icon name="alert" className="size-4" />
            Limitations
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900/90">
            {prediction.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default function ClassifySection() {
  const [title, setTitle] = useState('')
  const [abstract, setAbstract] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setPrediction(null)
    try {
      setPrediction(await predictTopic(title, abstract))
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setBusy(false)
    }
  }

  const words = wordCount(abstract)
  return (
    <section id="classify" aria-labelledby="classify-heading" className="scroll-mt-16">
      <h2 id="classify-heading" className={sectionTitleClass}>
        Research topic classification
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Enter a paper’s or proposal’s title and abstract. The trained model suggests which of five computer-science
        research areas it is closest to. Nothing you enter is stored.
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit} className={panelClass + ' space-y-4'} aria-label="Classify a paper">
          {error && <Alert tone="error">{error.message}</Alert>}
          <FormField id="paper-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)}
            maxLength={300} required error={error?.fields.title} />
          <TextAreaField id="paper-abstract" label="Abstract" rows={9} value={abstract}
            onChange={(e) => setAbstract(e.target.value)} required error={error?.fields.abstract}
            hint={`${words} ${words === 1 ? 'word' : 'words'}; at least ${MIN_WORDS} needed. PDF upload is planned for a later version.`} />
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={'h-full rounded-full transition-all ' + (words >= MIN_WORDS ? 'bg-emerald-500' : 'bg-violet-400')}
              style={{ width: `${Math.min(words / MIN_WORDS, 1) * 100}%` }} />
          </div>
          <button type="submit" className={violetButtonClass} disabled={busy}>
            <Icon name="sparkles" className="size-4" />
            {busy ? 'Classifying…' : 'Classify'}
          </button>
        </form>
        <div>
          {prediction ? (
            <Result prediction={prediction} />
          ) : (
            <EmptyState icon="sparkles" title="The result appears here">
              The closest of the five research areas, the order of the others, and what the model cannot tell you.
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  )
}
