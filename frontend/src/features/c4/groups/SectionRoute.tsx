import { Navigate } from 'react-router'
import PrivacyNotice from '../components/PrivacyNotice'
import StateBlock from '../components/StateBlock'
import { groupPath } from '../paths'
import { useCurrentGroup } from './MyGroupsContext'
import { accessFor, type GroupSection } from './groupAccess'

/**
 * Guards one section of a group and, for now, stands in for its page. A user
 * whose role does not include the section is sent back to the overview. The
 * section pages themselves are not built yet, so this says so plainly and
 * shows no figures of any kind.
 */
export default function SectionRoute({ section }: { section: GroupSection }) {
  const group = useCurrentGroup()

  if (!section.allowed(accessFor(group))) {
    return <Navigate to={groupPath(group.projectId)} replace state={{ sectionDenied: true }} />
  }

  return (
    <section aria-labelledby="section-heading">
      <h2 id="section-heading" className="text-lg font-semibold text-slate-900">
        {section.label}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{section.description}</p>
      {section.privacy !== 'none' && (
        <div className="mt-4">
          <PrivacyNotice variant={section.privacy} />
        </div>
      )}
      <div className="mt-4">
        <StateBlock kind="unavailable" title="This section is not available yet">
          It has not been built. Nothing is shown here until it is connected to real data.
        </StateBlock>
      </div>
    </section>
  )
}
