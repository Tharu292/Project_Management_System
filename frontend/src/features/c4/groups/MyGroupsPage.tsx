import { Link } from 'react-router'
import { secondaryButtonClass } from '../../../components/AppShell'
import PageHeader from '../components/PageHeader'
import StateBlock from '../components/StateBlock'
import { groupPath } from '../paths'
import { useMyGroups } from './MyGroupsContext'
import RoleBadges from './RoleBadges'
import { STATUS_LABELS } from './groupAccess'

/** The research project groups the signed-in user belongs to, each with their own role in it. */
export default function MyGroupsPage() {
  const { state, retry } = useMyGroups()

  return (
    <>
      <PageHeader
        title="My groups"
        subtitle="The research project groups you belong to. Open one to see what is available to you there."
      />
      <div className="mt-6">
        {state.status === 'loading' && <StateBlock kind="loading" title="Loading your groups…" />}

        {state.status === 'error' && (
          <StateBlock
            kind="error"
            title="Your groups could not be loaded"
            action={
              <button type="button" onClick={retry} className={secondaryButtonClass}>
                Try again
              </button>
            }
          >
            {state.message}
          </StateBlock>
        )}

        {state.status === 'ready' && state.groups.length === 0 && (
          <StateBlock kind="empty" title="You are not in any project group yet">
            Groups appear here once you have been added to a research project as a student, supervisor,
            co-supervisor or evaluator.
          </StateBlock>
        )}

        {state.status === 'ready' && state.groups.length > 0 && (
          <ul aria-label="Your groups" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.groups.map((group) => (
              <li key={group.projectId} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{group.projectCode}</p>
                <h2 className="mt-1 text-lg font-semibold break-words text-slate-900">{group.title}</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="text-slate-500">Your role</dt>
                    <dd>
                      <RoleBadges roles={group.roles} />
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <dt className="text-slate-500">Status</dt>
                    <dd className="font-medium text-slate-800">{STATUS_LABELS[group.status]}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex grow items-end">
                  <Link
                    to={groupPath(group.projectId)}
                    aria-label={`Open ${group.title}`}
                    className={secondaryButtonClass}
                  >
                    Open group
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
