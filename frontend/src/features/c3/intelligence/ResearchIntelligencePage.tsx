import { Link } from 'react-router'
import AppShell from '../../../components/AppShell'
import { RESEARCH_WORKSPACE_PATH } from '../paths'
import ClassifySection from './ClassifySection'
import KeywordsSection from './KeywordsSection'
import MetricsSection from './MetricsSection'
import TrendsSection from './TrendsSection'

/** Module 5: the trained topic classifier and the verified historical arXiv trends. */
export default function ResearchIntelligencePage() {
  return (
    <AppShell>
      <Link to={RESEARCH_WORKSPACE_PATH} className="text-sm font-medium text-indigo-700 hover:underline">
        ← Research Workspace
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Research Intelligence</h1>
      <p className="mt-1 max-w-3xl text-slate-600">
        A TF-IDF + Linear SVM model trained on real arXiv papers, and publication trends from the full Cornell arXiv
        metadata snapshot. It covers five computer-science areas: Computer Vision, Computation &amp; Language (NLP),
        Cryptography &amp; Security, Robotics and Databases.
      </p>
      <div className="mt-8 space-y-10">
        <ClassifySection />
        <TrendsSection />
        <KeywordsSection />
        <MetricsSection />
      </div>
    </AppShell>
  )
}
