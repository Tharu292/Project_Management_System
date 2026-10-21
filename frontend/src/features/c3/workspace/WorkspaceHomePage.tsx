import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '../../../auth/AuthContext'
import AppShell from '../../../components/AppShell'
import { getMyProjects } from '../api/c3Api'
import type { MyProject } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { SelectField } from '../components/fields'
import { ROLE_LABELS, accessFor, formatDateTime } from '../display'
import { RESEARCH_INTELLIGENCE_PATH, modulePath } from '../paths'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import PageHeader from '../ui/PageHeader'
import StatTile from '../ui/StatTile'
import { TONE_ICON, focusRing, panel, panelClass, sectionTitleClass } from '../ui/styles'
import { MODULE_INFO } from './modules'
import { type ProjectSummary, attentionItems, loadProjectSummary, moduleCount, recentActivity } from './summary'

type View = 'student' | 'supervisor' | 'evaluator' | 'none'

function viewFor(project: MyProject | null): View {
  if (!project) return 'none'
  const access = accessFor(project.roles)
  return access.isSupervisor ? 'supervisor' : access.isStudent ? 'student' : 'evaluator'
}

const VIEW_INTRO: Record<View, string> = {
  student: 'Your project at a glance: what needs your attention, recent activity and your research modules.',
  supervisor: 'Supervise your project: evidence to verify, conversations to answer and meetings to prepare.',
  evaluator: 'Read the project’s knowledge repository and its supervisor-verified evidence.',
  none: 'Collaboration, meetings, knowledge and evidence for your research projects.',
}

function ProjectBanner({ project }: { project: MyProject }) {
  const view = viewFor(project)
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-indigo-600/20">
      <div aria-hidden="true" className="absolute -top-16 -right-10 size-56 rounded-full bg-white/10" />
      <div aria-hidden="true" className="absolute -bottom-20 right-24 size-40 rounded-full bg-white/5" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-indigo-100 uppercase">Project {project.projectCode}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{project.title}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.roles.map((role) => (
              <span key={role} className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-white/25">
                {ROLE_LABELS[role]}
              </span>
            ))}
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-white/25">
              {project.status.toLowerCase()}
            </span>
          </div>
        </div>
        <p className="rounded-xl bg-white/10 px-3 py-2 text-sm font-medium ring-1 ring-white/20">
          {view === 'supervisor' ? 'Supervisor view' : view === 'student' ? 'Student view' : 'Evaluator view'}
        </p>
      </div>
    </div>
  )
}

function ModuleCards({ project, summary }: { project: MyProject | null; summary: ProjectSummary | null }) {
  const access = accessFor(project?.roles ?? [])
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {MODULE_INFO.map((module) => {
        const reason = project ? module.unavailableReason(access) : 'Choose a project first.'
        const count = reason ? null : moduleCount(summary, module.id)
        const content = (
          <>
            <span className="flex items-start justify-between gap-3">
              <span className={'inline-flex size-11 items-center justify-center rounded-xl ' + (reason ? TONE_ICON.slate : TONE_ICON.indigo)}>
                <Icon name={reason ? 'lock' : module.icon} className="size-5" />
              </span>
              {count && <Badge tone="slate">{count}</Badge>}
            </span>
            <span className="mt-4 block text-xs font-semibold tracking-wider text-indigo-600 uppercase">Module {module.number}</span>
            <span className="mt-1 block text-base font-semibold text-slate-900">{module.title}</span>
            <span className="mt-1.5 block text-sm text-slate-600">{module.description}</span>
            {reason ? (
              <span className="mt-3 block text-xs text-slate-500">{reason}</span>
            ) : (
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-700">
                Open <Icon name="arrowRight" className="size-4" />
              </span>
            )}
          </>
        )
        return (
          <li key={module.id}>
            {project && !reason ? (
              <Link
                to={modulePath(project.projectId, module.id)}
                className={`${panel} group block h-full p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md ${focusRing}`}
              >
                {content}
              </Link>
            ) : (
              <div aria-disabled="true" className="block h-full rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5">
                {content}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function IntelligenceCard() {
  return (
    <Link
      to={RESEARCH_INTELLIGENCE_PATH}
      className={
        'group relative block overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 ' +
        'p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ' + focusRing
      }
    >
      <span className="flex flex-wrap items-start gap-4">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm shadow-violet-600/30">
          <Icon name="sparkles" className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold tracking-wider text-violet-700 uppercase">Module 5</span>
          <span className="mt-1 block text-lg font-semibold text-slate-900">Research Intelligence</span>
          <span className="mt-1 block max-w-2xl text-sm text-slate-600">
            Classify a paper’s research area with the trained TF-IDF + Linear SVM model, and explore historical arXiv
            publication trends and rising keywords.
          </span>
          <span className="mt-3 flex flex-wrap gap-2">
            <Badge tone="violet" icon="sparkles">Topic classification</Badge>
            <Badge tone="violet" icon="trend">Historical trends</Badge>
            <Badge tone="violet" icon="bars">Model evaluation</Badge>
          </span>
        </span>
        <span className="inline-flex items-center gap-1 self-center text-sm font-semibold text-violet-700">
          Available to every signed-in user <Icon name="arrowRight" className="size-4" />
        </span>
      </span>
    </Link>
  )
}

function Dashboard({ projects }: { projects: MyProject[] }) {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [now] = useState(() => Date.now())
  const project = projects.find((p) => p.projectId === searchParams.get('project')) ?? projects[0] ?? null
  const summary = useLoad(
    () => (project ? loadProjectSummary(project) : Promise.resolve(null)),
    `summary-${project?.projectId ?? 'none'}`,
  )
  const loaded = summary.state.status === 'ready' ? summary.state.data : null
  const view = viewFor(project)

  return (
    <div className="space-y-8">
      <PageHeader
        icon="home"
        eyebrow="Research Intelligence & Collaboration Ecosystem"
        title="Research Workspace"
        description={VIEW_INTRO[view]}
        actions={
          projects.length > 0 && (
            <div className="w-full min-w-64 sm:w-80">
              <SelectField
                id="project"
                label="Project"
                value={project?.projectId}
                onChange={(event) => setSearchParams({ project: event.target.value })}
                options={projects.map((p) => ({ value: p.projectId, label: `${p.projectCode} — ${p.title}` }))}
              />
            </div>
          )
        }
      />

      {project ? (
        <ProjectBanner project={project} />
      ) : (
        <EmptyState icon="users" title="No research project yet">
          You are not a member of any research project yet. Modules 1–4 open once you have been added to a project.
          Research Intelligence is available now.
        </EmptyState>
      )}

      {project && (
        <section aria-labelledby="attention-heading">
          <h2 id="attention-heading" className={sectionTitleClass}>
            {view === 'supervisor' ? 'Needs your review' : view === 'student' ? 'Your progress' : 'Project overview'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Counts of the project’s current records.</p>
          <div className="mt-4">
            <StateView state={summary.state} retry={summary.reload} loadingText="Loading the project overview…">
              {(data) =>
                data && (
                  <div className={'grid gap-4 sm:grid-cols-2 ' + (view === 'evaluator' ? '' : 'xl:grid-cols-4')}>
                    {attentionItems(data, project, user?.id ?? '', now).map((item) => (
                      <StatTile key={item.key} icon={item.icon} tone={item.tone} label={item.label} value={item.value}
                        detail={item.detail} to={modulePath(project.projectId, item.module)} />
                    ))}
                  </div>
                )
              }
            </StateView>
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="modules-heading" className="lg:col-span-2">
          <h2 id="modules-heading" className={sectionTitleClass + ' mb-4'}>
            Research modules
          </h2>
          <ModuleCards project={project} summary={loaded} />
        </section>
        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className={sectionTitleClass + ' mb-4'}>
            Recent activity
          </h2>
          <div className={panelClass}>
            {!project ? (
              <p className="text-sm text-slate-500">Activity appears here once you are in a project.</p>
            ) : !loaded ? (
              <p className="text-sm text-slate-500">{summary.state.status === 'error' ? 'Activity is not available.' : 'Loading…'}</p>
            ) : recentActivity(loaded).length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet. Start with a module on the left.</p>
            ) : (
              <ol className="space-y-4" aria-label="Recent activity">
                {recentActivity(loaded).map((item) => (
                  <li key={item.key} className="flex gap-3">
                    <span className={'inline-flex size-8 shrink-0 items-center justify-center rounded-lg ' + TONE_ICON[item.tone]}>
                      <Icon name={item.icon} className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-slate-500">{item.text}</span>
                      <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
                      <span className="block text-xs text-slate-400">{formatDateTime(item.at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      <IntelligenceCard />
    </div>
  )
}

export default function WorkspaceHomePage() {
  const { state, reload } = useLoad(getMyProjects, 'my-projects')
  return (
    <AppShell>
      <StateView state={state} retry={reload} loadingText="Loading your projects…">
        {(projects) => <Dashboard projects={projects} />}
      </StateView>
    </AppShell>
  )
}
