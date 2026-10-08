import { useCallback } from 'react'
import { secondaryButtonClass } from '../../../components/AppShell'
import { loadTeamProgress } from '../api/contributionData'
import { useLoad } from '../api/useLoad'
import StatCard from '../components/StatCard'
import StateBlock from '../components/StateBlock'
import { reasonText } from '../contribution/contributionText'
import { useCurrentGroup } from '../groups/MyGroupsContext'

function ProgressBar({ label, assigned, completed }: { label: string; assigned: number; completed: number }) {
  if (assigned === 0) {
    return <span className="text-sm text-slate-500">No tasks assigned (verified)</span>
  }
  const share = Math.max(0, Math.min(100, (completed / assigned) * 100))
  return (
    <svg
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}: ${completed} of ${assigned} assigned tasks completed`}
      className="h-3 w-full min-w-24"
    >
      <rect x="0" y="0" width="100" height="10" className="fill-slate-100" />
      <rect x="0" y="0" width={share} height="10" className="fill-indigo-600" />
    </svg>
  )
}

/**
 * Task progress of the group, as reported by the task management component.
 * This page only displays that summary: it manages no tasks. While the task
 * component is not connected it says so and shows no figures.
 */
export default function TeamProgressPage() {
  const group = useCurrentGroup()
  const loader = useCallback(() => loadTeamProgress(group.projectId), [group.projectId])
  const { state, retry } = useLoad(loader)

  return (
    <section aria-labelledby="progress-heading">
      <h2 id="progress-heading" className="text-lg font-semibold text-slate-900">
        Team progress
      </h2>
      <p className="mt-1 text-sm text-slate-600">Overall project progress and the progress of each member.</p>

      <div className="mt-6 space-y-6">
        {state.status === 'loading' && <StateBlock kind="loading" title="Loading progress…" />}

        {state.status === 'error' && (
          <StateBlock
            kind="error"
            title="Progress could not be loaded"
            action={
              <button type="button" onClick={retry} className={secondaryButtonClass}>
                Try again
              </button>
            }
          >
            {state.message}
          </StateBlock>
        )}

        {state.status === 'ready' && !state.data.available && (
          <StateBlock kind="unavailable" title="Task progress is not available yet">
            {reasonText(state.data.unavailableReason)} Progress is taken from the task management component and
            appears here once it is connected. Until then no figures are shown.
          </StateBlock>
        )}

        {state.status === 'ready' && state.data.available && state.data.overall !== null && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Tasks assigned" value={state.data.overall.assigned} />
              <StatCard label="Tasks completed" value={state.data.overall.completed} />
              <StatCard
                label="Overall progress"
                value={
                  <ProgressBar
                    label="Whole team"
                    assigned={state.data.overall.assigned}
                    completed={state.data.overall.completed}
                  />
                }
                hint={
                  state.data.overall.assigned === 0
                    ? undefined
                    : `${state.data.overall.completed} of ${state.data.overall.assigned} completed`
                }
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200">
                <caption className="sr-only">Assigned and completed tasks of each group member</caption>
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
                    <th scope="col" className="px-3 py-2">
                      Student
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Assigned
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Completed
                    </th>
                    <th scope="col" className="px-3 py-2">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {state.data.members.map((member) => (
                    <tr key={member.studentId}>
                      <th scope="row" className="px-3 py-2.5 text-left text-sm font-normal text-slate-900">
                        {member.displayName}
                      </th>
                      <td className="px-3 py-2.5 text-sm text-slate-800">{member.assigned}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-800">{member.completed}</td>
                      <td className="px-3 py-2.5">
                        <ProgressBar label={member.displayName} assigned={member.assigned} completed={member.completed} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Every kind of assigned task counts the same: development, documentation, research, design and testing.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
