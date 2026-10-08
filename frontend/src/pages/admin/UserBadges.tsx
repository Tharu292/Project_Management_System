import type { AdminUser } from '../../auth/types'

const BADGE = 'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold'

/** Whether the account can sign in, and whether its owner still has to replace the password they were given. */
export default function UserBadges({ user }: { user: AdminUser }) {
  return (
    <span className="flex flex-wrap gap-1">
      <span className={`${BADGE} ${user.enabled ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
        {user.enabled ? 'Enabled' : 'Disabled'}
      </span>
      {user.mustChangePassword && (
        <span className={`${BADGE} bg-amber-100 text-amber-900`}>Password change pending</span>
      )}
    </span>
  )
}
