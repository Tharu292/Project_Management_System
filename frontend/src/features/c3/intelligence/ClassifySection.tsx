import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import { actionButtonClass } from '../../../components/AppShell'
import FormField from '../../../components/FormField'
import { predictTopic } from '../api/c3Api'
import type { Prediction } from '../api/types'
import { TextAreaField } from '../components/fields'
import { cardClass, formError } from '../display'

function wordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

/** The result shows the category and the order of the others. Decision scores are deliberately not shown. */
function Result({ prediction }: { prediction: Prediction }) {
  const others = prediction.ranking.slice(1)
  return (
    <section className={cardClass + ' mt-4'} aria-label="Classification result">
      <p className="text-xs font-semibold tracking-wide text-indigo-700 uppercase">Closest research area</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{prediction.categoryName}</p>
      <p className="text-sm text-slate-600">
        arXiv category {prediction.category} · model {prediction.modelVersion}
      </p>
      <div className="mt-4">
        <p className="text-sm font-medium text-slate-800">Other areas, from closer to further</p>
        <ol className="mt-1 list-decimal pl-5 text-sm text-slate-700">
          {others.map((r) => (
            <li key={r.category}>
              {r.categoryName} ({r.category})
            </li>
          ))}
        </ol>
      </div>
      <details className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <summary className="cursor-pointer font-medium text-slate-800">Why is there no confidence percentage?</summary>
        <p className="mt-2">
          A Linear SVM gives each area a decision score that only ranks the areas for this text. The scores are not
          probabilities, so turning them into a percentage would be misleading. The ranking above is what the model
          actually supports.
        </p>
      </details>
      <div className="mt-4">
        <p className="text-sm font-medium text-slate-800">Limitations</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {prediction.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
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
    <section aria-labelledby="classify-heading">
      <h2 id="classify-heading" className="text-lg font-semibold text-slate-900">
        Research topic classification
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Enter a paper’s or proposal’s title and abstract. The trained model suggests which of five computer-science
        research areas it is closest to. Nothing you enter is stored.
      </p>
      <form onSubmit={submit} className={cardClass + ' mt-4 space-y-3'} aria-label="Classify a paper">
        {error && <Alert tone="error">{error.message}</Alert>}
        <FormField id="paper-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)}
          maxLength={300} required error={error?.fields.title} />
        <TextAreaField id="paper-abstract" label="Abstract" rows={7} value={abstract}
          onChange={(e) => setAbstract(e.target.value)} required error={error?.fields.abstract}
          hint={`${words} ${words === 1 ? 'word' : 'words'}; at least 30 needed. PDF upload is planned for a later version.`} />
        <button type="submit" className={actionButtonClass} disabled={busy}>
          {busy ? 'Classifying…' : 'Classify'}
        </button>
      </form>
      {prediction && <Result prediction={prediction} />}
    </section>
  )
}
