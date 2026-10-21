import { Link, NavLink, Navigate, useParams } from 'react-router'
import Alert from '../../../components/Alert'
import AppShell from '../../../components/AppShell'
import { getMyProjects } from '../api/c3Api'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { ROLE_LABELS, accessFor } from '../display'
import CollaborationModule from '../modules/CollaborationModule'
import EvidenceModule from '../modules/EvidenceModule'
import KnowledgeModule from '../modules/KnowledgeModule'
import MeetingsModule from '../modules/MeetingsModule'
import { RESEARCH_INTELLIGENCE_PATH, RESEARCH_WORKSPACE_PATH, modulePath, workspacePath } from '../paths'
import Badge from '../ui/Badge'
import Icon from '../ui/Icon'
import { focusRing, linkTextClass, panel, quietButtonClass } from '../ui/styles'
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
                <Link to={RESEARCH_WORKSPACE_PATH} className={quietButtonClass}>
                  Back to the workspace
                </Link>
              </div>
            )
          }
          const access = accessFor(project.roles)
          const reason = info.unavailableReason(access)
          const openModules = MODULE_INFO.filter((m) => m.unavailableReason(access) === null)
          return (
            <div className="space-y-6">
              <div className={`${panel} flex flex-wrap items-center justify-between gap-4 p-5`}>
                <div className="min-w-0">
                  <Link to={workspacePath(project.projectId)} className={'inline-flex items-center gap-1 text-sm ' + linkTextClass}>
                    <Icon name="arrowLeft" className="size-4" />
                    Research Workspace
                  </Link>
                  <p className="mt-2 truncate text-xl font-semibold tracking-tight text-slate-900">{project.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">Project {project.projectCode}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {project.roles.map((role) => (
                    <Badge key={role} tone="indigo" icon="users">{ROLE_LABELS[role]}</Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
                <nav aria-label="Modules" className="lg:sticky lg:top-4 lg:self-start">
                  <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                    {openModules.map((m) => (
                      <li key={m.id} className="shrink-0">
                        <NavLink
                          to={modulePath(project.projectId, m.id)}
                          className={({ isActive }) =>
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ' + focusRing + ' ' +
                            (isActive
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                              : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm')
                          }
                        >
                          <Icon name={m.icon} className="size-5" />
                          <span>
                            <span className="sr-only">Module {m.number}: </span>
                            {m.shortTitle}
                          </span>
                        </NavLink>
                      </li>
                    ))}
                    <li className="shrink-0 lg:mt-3 lg:border-t lg:border-slate-200 lg:pt-3">
                      <Link
                        to={RESEARCH_INTELLIGENCE_PATH}
                        className={'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-50 ' + focusRing}
                      >
                        <Icon name="sparkles" className="size-5" />
                        Research Intelligence
                      </Link>
                    </li>
                  </ul>
                </nav>

                <section aria-labelledby="module-title" className="min-w-0">
                  <div className="mb-6 flex items-start gap-3">
                    <span className="hidden size-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:inline-flex">
                      <Icon name={info.icon} className="size-6" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">Module {info.number}</p>
                      <h1 id="module-title" className="text-2xl font-semibold tracking-tight text-slate-900">
                        {info.title}
                      </h1>
                      <p className="mt-1 text-sm text-slate-600">{info.description}</p>
                    </div>
                  </div>
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
              </div>
            </div>
          )
        }}
      </StateView>
    </AppShell>
  )
}
