import { Link, Outlet, useParams } from 'react-router'
import Alert from '../../../components/Alert'
import { secondaryButtonClass } from '../../../components/AppShell'
import { linkClass } from '../../../components/AuthLayout'
import GroupTabs from '../components/GroupTabs'
import PageHeader from '../components/PageHeader'
import StateBlock from '../components/StateBlock'
import { GROUPS_PATH, groupPath, sectionPath } from '../paths'
import { useMyGroups } from './MyGroupsContext'
import RoleBadges from './RoleBadges'
import { accessFor, sectionsFor } from './groupAccess'

/**
 * The frame of every page inside one group. It opens only groups that are in
 * the user's own list, and builds the section menu from the user's roles
 * there. A group that is not theirs is reported as unavailable, without
 * saying whether it exists.
 */
export default function GroupLayout() {
  const { groupId = '' } = useParams()
  const { state, retry } = useMyGroups()

  if (state.status === 'loading') {
    return <StateBlock kind="loading" title="Loading group…" />
  }
  if (state.status === 'error') {
    return (
      <StateBlock
        kind="error"
        title="This group could not be loaded"
        action={
          <button type="button" onClick={retry} className={secondaryButtonClass}>
            Try again
          </button>
        }
      >
        {state.message}
      </StateBlock>
    )
  }

  const group = state.groups.find((candidate) => candidate.projectId === groupId)
  if (group === undefined) {
    return (
      <StateBlock
        kind="unauthorized"
        title="This group is not available to you"
        action={
          <Link to={GROUPS_PATH} className={secondaryButtonClass}>
            Back to my groups
          </Link>
        }
      >
        You can only open groups you belong to.
      </StateBlock>
    )
  }

  const access = accessFor(group)
  const tabs = [
    { to: groupPath(group.projectId), label: 'Overview', end: true },
    ...sectionsFor(group).map((section) => ({
      to: sectionPath(group.projectId, section.path),
      label: section.label,
    })),
  ]

  return (
    <>
      <p className="mb-3 text-sm">
        <Link to={GROUPS_PATH} className={linkClass}>
          ← My groups
        </Link>
      </p>
      <PageHeader
        title={group.title}
        meta={
          <>
            <span>{group.projectCode}</span>
            <span aria-hidden="true">·</span>
            <span className="sr-only">Your role:</span>
            <RoleBadges roles={group.roles} />
          </>
        }
      />
      {access.hasAssessmentConflict && (
        <div className="mt-4">
          <Alert tone="error">
            You are recorded as both supervising and evaluating this group, which is not allowed. Assessment is
            unavailable to you here until an administrator corrects the assignment.
          </Alert>
        </div>
      )}
      <div className="mt-6">
        <GroupTabs tabs={tabs} />
      </div>
      <div className="mt-6">
        <Outlet context={group} />
      </div>
    </>
  )
}
