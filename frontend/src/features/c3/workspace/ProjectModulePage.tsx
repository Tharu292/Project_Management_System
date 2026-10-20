import { Link, NavLink, Navigate, useParams } from 'react-router'
import Alert from '../../../components/Alert'
import AppShell, { secondaryButtonClass } from '../../../components/AppShell'
import { getMyProjects } from '../api/c3Api'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { ROLE_LABELS, accessFor } from '../display'
import { RESEARCH_WORKSPACE_PATH, modulePath, workspacePath } from '../paths'
import CollaborationModule from '../modules/CollaborationModule'
import EvidenceModule from '../modules/EvidenceModule'
import KnowledgeModule from '../modules/KnowledgeModule'
import MeetingsModule from '../modules/MeetingsModule'
import { MODULE_INFO, moduleInfo } from './modules'

export default function ProjectModulePage() {
  const { projectId = '', module = '' } = useParams()
  const { state, reload } = useLoad(getMyProjects, 'my-projects')
  const info = moduleInfo(module)

  if (!info) {
    return <Navigate to={RESEARCH_WORKSPACE_PATH} replace />
  }

  return (
    <AppShell>
      <StateView state={state} retry={reload} loadingText="Loading the project…">
        {(projects) => {
          const project = projects.find((p) => p.projectId === projectId)
          if (!project) {
            return (
              <div className="space-y-3">
                <Alert tone="error">You are not a member of this project.</Alert>
                <Link to={RESEARCH_WORKSPACE_PATH} className={secondaryButtonClass}>
                  Back to the workspace
                </Link>
              </div>
            )
          }
          const access = accessFor(project.roles)
          const reason = info.unavailableReason(access)
          return (
            <>
              <Link to={workspacePath(project.projectId)} className="text-sm font-medium text-indigo-700 hover:underline">
                ← Research Workspace
              </Link>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">{project.title}</h1>
                <p className="text-sm text-slate-600">
                  {project.projectCode} · {project.roles.map((role) => ROLE_LABELS[role]).join(', ')}
                </p>
              </div>
              <nav aria-label="Modules" className="mt-4 border-b border-slate-200">
                <ul className="flex gap-1 overflow-x-auto">
                  {MODULE_INFO.filter((m) => m.unavailableReason(access) === null).map((m) => (
                    <li key={m.id} className="shrink-0">
                      <NavLink
                        to={modulePath(project.projectId, m.id)}
                        className={({ isActive }) =>
                          'block border-b-2 px-3 py-2 text-sm font-medium ' +
                          (isActive
                            ? 'border-indigo-600 text-indigo-700'
                            : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900')
                        }
                      >
                        {m.number}. {m.title}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
              <section className="mt-6" aria-labelledby="module-title">
                <h2 id="module-title" className="sr-only">
                  {info.title}
                </h2>
                {reason ? (
                  <Alert tone="info">{reason}</Alert>
                ) : info.id === 'collaboration' ? (
                  <CollaborationModule projectId={project.projectId} access={access} />
                ) : info.id === 'meetings' ? (
                  <MeetingsModule projectId={project.projectId} />
                ) : info.id === 'knowledge' ? (
                  <KnowledgeModule projectId={project.projectId} access={access} />
                ) : (
                  <EvidenceModule projectId={project.projectId} access={access} />
                )}
              </section>
            </>
          )
        }}
      </StateView>
    </AppShell>
  )
}
