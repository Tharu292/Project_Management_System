import type { ModelEvaluation, ModelMetrics } from '../api/types'
import type { LoadState } from '../api/useLoad'
import BarChart from '../components/BarChart'
import StateView from '../components/StateView'
import Icon from '../ui/Icon'
import { panelClass, sectionTitleClass } from '../ui/styles'
import { score, wholeNumber } from './format'

// The same two colours as the report figures: random split, then newer papers.
const SPLIT_COLORS: Record<ModelEvaluation['name'], string> = { random: '#2a78d6', temporal: '#eb6834' }

function splitLabel(e: ModelEvaluation): string {
  return e.name === 'temporal' && e.trainYears && e.testYears
    ? `Newer papers (trained ${e.trainYears.join('–')}, tested ${e.testYears.join('–')})`
    : 'Random 80/20 split'
}

function comparison(e: ModelEvaluation): string {
  const c = e.svmVsNaiveBayes
  const p = c.pValue < 0.001 ? 'p < 0.001' : `p = ${c.pValue.toFixed(3)}`
  return (
    `${splitLabel(e)}: ${c.onlySvmCorrect} papers were right only for the SVM and ${c.onlyNaiveBayesCorrect} only for ` +
    `Naive Bayes — ${c.significantAt005 ? 'a statistically significant difference' : 'not a statistically significant difference'} (McNemar test, ${p}).`
  )
}

function MetricsView({ metrics }: { metrics: ModelMetrics }) {
  const evaluations = metrics.evaluations
  const series = evaluations.map((e) => ({ key: e.name, label: splitLabel(e), color: SPLIT_COLORS[e.name] }))
  const models = evaluations[0]?.models ?? []
  const areas = evaluations[0]?.perCategory ?? []
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className={panelClass}>
          <h3 className="font-semibold text-slate-900">Macro-F1 by model</h3>
          <p className="mt-1 text-xs text-slate-500">
            On {wholeNumber(evaluations[0]?.testSize ?? 0)} unseen test papers per evaluation; higher is better (0 to 1).
          </p>
          <div className="mt-5">
            <BarChart ariaLabel="Macro-F1 of each model on the two test sets" series={series} max={1}
              rows={models.map((m) => ({
                key: m.id,
                label: m.name,
                values: evaluations.map((e) => {
                  const value = e.models.find((x) => x.id === m.id)?.macroF1 ?? 0
                  return { value, text: score(value) }
                }),
              }))} />
          </div>
        </div>
        <div className={panelClass}>
          <h3 className="font-semibold text-slate-900">Linear SVM: F1 per research area</h3>
          <p className="mt-1 text-xs text-slate-500">400 test papers per area in each evaluation.</p>
          <div className="mt-5">
            <BarChart ariaLabel="F1 of the Linear SVM for each research area" series={series} max={1}
              rows={areas.map((c) => ({
                key: c.category,
                label: `${c.category} ${c.name}`,
                values: evaluations.map((e) => {
                  const value = e.perCategory.find((x) => x.category === c.category)?.f1 ?? 0
                  return { value, text: score(value) }
                }),
              }))} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {evaluations.map((e) => (
          <div key={e.name} className={
            'flex gap-3 rounded-2xl border p-4 ' +
            (e.svmVsNaiveBayes.significantAt005 ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white')
          }>
            <span className={
              'inline-flex size-9 shrink-0 items-center justify-center rounded-xl ' +
              (e.svmVsNaiveBayes.significantAt005 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')
            }>
              <Icon name={e.svmVsNaiveBayes.significantAt005 ? 'badgeCheck' : 'info'} className="size-5" />
            </span>
            <p className="text-sm text-slate-700">{comparison(e)}</p>
          </div>
        ))}
      </div>

      <details className={panelClass}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Show all numbers</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">Accuracy and macro-F1 of every model on both evaluations</caption>
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                <th scope="col" className="py-2 pr-4">Model</th>
                {evaluations.map((e) => (
                  <th key={e.name} scope="col" className="py-2 pr-4">Macro-F1, {e.name === 'random' ? 'random' : 'newer papers'}</th>
                ))}
                {evaluations.map((e) => (
                  <th key={`acc-${e.name}`} scope="col" className="py-2 pr-4">Accuracy, {e.name === 'random' ? 'random' : 'newer papers'}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {models.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <th scope="row" className="py-1.5 pr-4 text-left font-medium text-slate-800">{m.name}</th>
                  {evaluations.map((e) => (
                    <td key={e.name} className="py-1.5 pr-4">{score(e.models.find((x) => x.id === m.id)?.macroF1 ?? null)}</td>
                  ))}
                  {evaluations.map((e) => (
                    <td key={`acc-${e.name}`} className="py-1.5 pr-4">{score(e.models.find((x) => x.id === m.id)?.accuracy ?? null)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <p className="text-xs text-slate-500">
        Model {metrics.modelVersion}: {metrics.algorithm}. Trained on {wholeNumber(metrics.trainingData.sampleSize)}{' '}
        real arXiv papers ({metrics.trainingData.years.join('–')}) from {metrics.trainingData.source}.{' '}
        {metrics.trainingData.labelPolicy} These scores measure agreement with authors’ own category choice among five
        areas; they do not measure research-gap detection or proposal quality.
      </p>
    </div>
  )
}

export default function MetricsSection({ state, retry }: { state: LoadState<ModelMetrics>; retry: () => void }) {
  return (
    <section id="evaluation" aria-labelledby="metrics-heading" className="scroll-mt-16">
      <h2 id="metrics-heading" className={sectionTitleClass}>
        How well the model performs
      </h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">
        Measured once on papers the model never saw during training, compared with two baselines.
      </p>
      <StateView state={state} retry={retry} loadingText="Loading model evaluation…">
        {(metrics) => <MetricsView metrics={metrics} />}
      </StateView>
    </section>
  )
}
