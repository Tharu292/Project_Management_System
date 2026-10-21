import { Link } from 'react-router'
import AppShell from '../../../components/AppShell'
import { getModelMetrics } from '../api/c3Api'
import type { ModelMetrics } from '../api/types'
import { useLoad } from '../api/useLoad'
import { RESEARCH_WORKSPACE_PATH } from '../paths'
import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import PageHeader from '../ui/PageHeader'
import StatTile from '../ui/StatTile'
import { focusRing, linkTextClass } from '../ui/styles'
import ClassifySection from './ClassifySection'
import GapAnalysisSection from './GapAnalysisSection'
import KeywordsSection from './KeywordsSection'
import MetricsSection from './MetricsSection'
import OpportunitiesSection from './OpportunitiesSection'
import TrendsSection from './TrendsSection'
import { score, wholeNumber } from './format'

const SECTIONS = [
  { id: 'classify', label: 'Classify', icon: 'sparkles' },
  { id: 'opportunities', label: 'Opportunities', icon: 'search' },
  { id: 'gaps', label: 'Gaps', icon: 'document' },
  { id: 'trends', label: 'Trends', icon: 'trend' },
  { id: 'keywords', label: 'Keywords', icon: 'tag' },
  { id: 'evaluation', label: 'Evaluation', icon: 'bars' },
] as const

/** Measured scores only, read from the evaluation reports through the API. */
function Headline({ metrics }: { metrics: ModelMetrics }) {
  const f1 = (name: string) =>
    metrics.evaluations.find((e) => e.name === name)?.models.find((m) => m.id === 'linear_svm')?.macroF1 ?? null
  const temporal = metrics.evaluations.find((e) => e.name === 'temporal')
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile icon="bars" tone="violet" label="Macro-F1, random test split" value={score(f1('random'))}
        detail="Linear SVM on unseen arXiv papers" />
      <StatTile icon="clock" tone="violet" label="Macro-F1 on newer papers" value={score(f1('temporal'))}
        detail={temporal?.testYears ? `Trained ${temporal.trainYears?.join('–')}, tested ${temporal.testYears.join('–')}` : undefined} />
      <StatTile icon="document" tone="indigo" label="Real arXiv papers in the training sample"
        value={wholeNumber(metrics.trainingData.sampleSize)} detail={`Submitted ${metrics.trainingData.years.join('–')}`} />
      <StatTile icon="tag" tone="indigo" label="Research areas covered" value={String(metrics.evaluations[0]?.perCategory.length ?? 0)}
        detail="Computer-science categories of arXiv" />
    </div>
  )
}

/** Module 5: the trained topic classifier and the verified historical arXiv trends. */
export default function ResearchIntelligencePage() {
  const metrics = useLoad(getModelMetrics, 'model-metrics')
  const loaded = metrics.state.status === 'ready' ? metrics.state.data : null
  return (
    <AppShell>
      <div className="space-y-8">
        <Link to={RESEARCH_WORKSPACE_PATH} className={'inline-flex items-center gap-1 text-sm ' + linkTextClass}>
          <Icon name="arrowLeft" className="size-4" />
          Research Workspace
        </Link>
        <PageHeader
          icon="sparkles"
          tone="violet"
          eyebrow="Module 5"
          title="Research Intelligence"
          description={
            <>
              A TF-IDF + Linear SVM model trained on real arXiv papers, and publication trends from the full Cornell arXiv
              metadata snapshot. It covers five computer-science areas: Computer Vision, Computation &amp; Language (NLP),
              Cryptography &amp; Security, Robotics and Databases.
            </>
          }
          actions={loaded && <Badge tone="violet" icon="sparkles">{`Model ${loaded.modelVersion}`}</Badge>}
        />
        {loaded && <Headline metrics={loaded} />}
        <nav aria-label="Sections" className="sticky top-0 z-20 -mx-4 bg-slate-50/90 px-4 py-2 backdrop-blur">
          <ul className="flex gap-2 overflow-x-auto">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <a href={`#${s.id}`} className={
                  'inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 ' +
                  'shadow-sm ring-1 ring-slate-200 hover:text-violet-700 hover:ring-violet-200 ' + focusRing
                }>
                  <Icon name={s.icon} className="size-4" />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-12">
          <ClassifySection />
          <OpportunitiesSection />
          <GapAnalysisSection />
          <TrendsSection />
          <KeywordsSection />
          <MetricsSection state={metrics.state} retry={metrics.reload} />
        </div>
      </div>
    </AppShell>
  )
}
