import { Link, useLocation } from 'react-router'
import Alert from '../../../components/Alert'
import StatCard from '../components/StatCard'
import { sectionPath } from '../paths'
import { useCurrentGroup } from './MyGroupsContext'
import { ROLE_LABELS, STATUS_LABELS, sectionsFor } from './groupAccess'

/** The landing page of a group: the user's role there, and the sections open to them. */
export default function GroupOverviewPage() {
  const group = useCurrentGroup()
  const location = useLocation()
  const sectionDenied = (location.state as { sectionDenied?: unknown } | null)?.sectionDenied === true
  const sections = sectionsFor(group)

  return (
    <>
      {sectionDenied && (
        <div className="mb-6">
          <Alert tone="error">That section is not available to you in this group.</Alert>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Your role" value={group.roles.map((role) => ROLE_LABELS[role]).join(', ')} />
        <StatCard label="Project code" value={group.projectCode} />
        <StatCard label="Project status" value={STATUS_LABELS[group.status]} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Sections</h2>
      <ul aria-label="Sections available to you" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <li key={section.path}>
            <Link
              to={sectionPath(group.projectId, section.path)}
              className={
                'block h-full rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-300 ' +
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
              }
            >
              <span className="block font-semibold text-indigo-700">{section.label}</span>
              <span className="mt-1 block text-sm text-slate-600">{section.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
