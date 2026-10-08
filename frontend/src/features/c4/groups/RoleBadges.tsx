import type { ProjectRole } from '../api/types'
import { ROLE_LABELS } from './groupAccess'

/** The signed-in user's own roles in a group. */
export default function RoleBadges({ roles }: { roles: ProjectRole[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <span
          key={role}
          className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800"
        >
          {ROLE_LABELS[role]}
        </span>
      ))}
    </span>
  )
}
