import { Link, useSearchParams } from 'react-router'
import Alert from '../../../components/Alert'
import AppShell from '../../../components/AppShell'
import { getMyProjects } from '../api/c3Api'
import type { MyProject } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { SelectField } from '../components/fields'
import { ROLE_LABELS, accessFor } from '../display'
import { RESEARCH_INTELLIGENCE_PATH, modulePath } from '../paths'
import { MODULE_INFO } from './modules'

const cardBase = 'flex h-full flex-col rounded-xl border p-5 text-left'
const openCard =
  cardBase +
  ' border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
const closedCard = cardBase + ' border-dashed border-slate-300 bg-slate-50'

function ModuleCards({ project }: { project: MyProject | null }) {
  const access = accessFor(project?.roles ?? [])
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {MODULE_INFO.map((module) => {
        const reason = project ? module.unavailableReason(access) : 'Choose a project first.'
        const content = (
          <>
            <span className="text-xs font-semibold tracking-wide text-indigo-700 uppercase">Module {module.number}</span>
            <span className="mt-1 text-base font-semibold text-slate-900">{module.title}</span>
            <span className="mt-2 text-sm text-slate-600">{module.description}</span>
            {reason && <span className="mt-3 text-xs text-slate-500">{reason}</span>}
          </>
        )
        return (
          <li key={module.id}>
            {project && !reason ? (
              <Link to={modulePath(project.projectId, module.id)} className={openCard}>
                {content}
              </Link>
            ) : (
              <div className={closedCard} aria-disabled="true">
                {content}
              </div>
            )}
          </li>
        )
      })}
      <li>
        <Link to={RESEARCH_INTELLIGENCE_PATH} className={openCard + ' bg-indigo-50/60'}>
          <span className="text-xs font-semibold tracking-wide text-indigo-700 uppercase">Module 5</span>
          <span className="mt-1 text-base font-semibold text-slate-900">Research Intelligence</span>
          <span className="mt-2 text-sm text-slate-600">
            Classify a paper’s research area with the trained TF-IDF + Linear SVM model, and explore historical arXiv
            publication trends and rising keywords.
          </span>
          <span className="mt-3 text-xs text-slate-500">Available to every signed-in user.</span>
        </Link>
      </li>
    </ul>
  )
}

export default function WorkspaceHomePage() {
  const { state, reload } = useLoad(getMyProjects, 'my-projects')
  const [searchParams, setSearchParams] = useSearchParams()

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold text-slate-900">Research Workspace</h1>
      <p className="mt-1 text-slate-600">
        Collaboration, meetings, knowledge and evidence for your research projects.
      </p>
      <div className="mt-6">
        <StateView state={state} retry={reload} loadingText="Loading your projects…">
          {(projects) => {
            const selected =
              projects.find((p) => p.projectId === searchParams.get('project')) ?? projects[0] ?? null
            return (
              <>
                {projects.length === 0 ? (
                  <Alert tone="info">
                    You are not a member of any research project yet. Modules 1–4 open once you have been added to a
                    project. Research Intelligence is available now.
                  </Alert>
                ) : (
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="w-full max-w-md">
                      <SelectField
                        id="project"
                        label="Project"
                        value={selected?.projectId}
                        onChange={(event) => setSearchParams({ project: event.target.value })}
                        options={projects.map((p) => ({ value: p.projectId, label: `${p.projectCode} — ${p.title}` }))}
                      />
                    </div>
                    {selected && (
                      <p className="pb-2 text-sm text-slate-600">
                        Your role: {selected.roles.map((role) => ROLE_LABELS[role]).join(', ')}
                      </p>
                    )}
                  </div>
                )}
                <ModuleCards project={selected} />
              </>
            )
          }}
        </StateView>
      </div>
    </AppShell>
  )
}
