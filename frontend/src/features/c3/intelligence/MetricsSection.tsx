import { getModelMetrics } from '../api/c3Api'
import type { ModelEvaluation, ModelMetrics } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { cardClass } from '../display'
import { score, wholeNumber } from './format'

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
  const models = metrics.evaluations[0]?.models ?? []
  return (
    <div className="space-y-4">
      <div className={cardClass + ' overflow-x-auto'}>
        <table className="min-w-full text-sm">
          <caption className="mb-2 text-left font-semibold text-slate-900">
            Results on unseen test papers ({wholeNumber(metrics.evaluations[0]?.testSize ?? 0)} per evaluation)
          </caption>
          <thead>
            <tr className="text-left text-slate-600">
              <th scope="col" className="py-1 pr-4">Model</th>
              {metrics.evaluations.map((e) => (
                <th key={e.name} scope="col" className="py-1 pr-4">
                  Macro-F1, {splitLabel(e)}
                </th>
              ))}
              {metrics.evaluations.map((e) => (
                <th key={`acc-${e.name}`} scope="col" className="py-1 pr-4">
                  Accuracy, {e.name === 'random' ? 'random' : 'newer papers'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {models.map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <th scope="row" className="py-1 pr-4 text-left font-medium text-slate-800">{m.name}</th>
                {metrics.evaluations.map((e) => (
                  <td key={e.name} className="py-1 pr-4">{score(e.models.find((x) => x.id === m.id)?.macroF1 ?? null)}</td>
                ))}
                {metrics.evaluations.map((e) => (
                  <td key={`acc-${e.name}`} className="py-1 pr-4">
                    {score(e.models.find((x) => x.id === m.id)?.accuracy ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {metrics.evaluations.map((e) => (
            <li key={e.name}>{comparison(e)}</li>
          ))}
        </ul>
      </div>
      <div className={cardClass + ' overflow-x-auto'}>
        <table className="min-w-full text-sm">
          <caption className="mb-2 text-left font-semibold text-slate-900">Linear SVM: F1 per research area</caption>
          <thead>
            <tr className="text-left text-slate-600">
              <th scope="col" className="py-1 pr-4">Area</th>
              {metrics.evaluations.map((e) => (
                <th key={e.name} scope="col" className="py-1 pr-4">{splitLabel(e)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {(metrics.evaluations[0]?.perCategory ?? []).map((c) => (
              <tr key={c.category} className="border-t border-slate-100">
                <th scope="row" className="py-1 pr-4 text-left font-medium text-slate-800">{c.category} {c.name}</th>
                {metrics.evaluations.map((e) => (
                  <td key={e.name} className="py-1 pr-4">
                    {score(e.perCategory.find((x) => x.category === c.category)?.f1 ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Model {metrics.modelVersion}: {metrics.algorithm}. Trained on {wholeNumber(metrics.trainingData.sampleSize)}{' '}
        real arXiv papers ({metrics.trainingData.years.join('–')}) from {metrics.trainingData.source}.{' '}
        {metrics.trainingData.labelPolicy} These scores measure agreement with authors’ own category choice among five
        areas; they do not measure research-gap detection or proposal quality.
      </p>
    </div>
  )
}

export default function MetricsSection() {
  const { state, reload } = useLoad(getModelMetrics, 'model-metrics')
  return (
    <section aria-labelledby="metrics-heading">
      <h2 id="metrics-heading" className="text-lg font-semibold text-slate-900">
        How well the model performs
      </h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">
        Measured once on papers the model never saw during training, compared with two baselines.
      </p>
      <StateView state={state} retry={reload} loadingText="Loading model evaluation…">
        {(metrics) => <MetricsView metrics={metrics} />}
      </StateView>
    </section>
  )
}
