import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { ADMIN_NEW_STAFF_PATH, ADMIN_USERS_PATH } from '../../auth/landing'
import type { AdminUser } from '../../auth/types'
import Alert from '../../components/Alert'
import AppShell, { actionButtonClass, secondaryButtonClass } from '../../components/AppShell'
import { useAdminUsers } from './useAdminUsers'

/** Every figure is counted from the account list the backend returned; nothing is estimated. */
function summarise(users: AdminUser[]): [string, number][] {
  const count = (predicate: (user: AdminUser) => boolean) => users.filter(predicate).length
  return [
    ['Total users', users.length],
    ['Students', count((user) => user.accountType === 'STUDENT')],
    ['Staff', count((user) => user.accountType === 'STAFF')],
    ['Enabled', count((user) => user.enabled)],
    ['Disabled', count((user) => !user.enabled)],
    ['Password change pending', count((user) => user.mustChangePassword)],
  ]
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const { state, retry } = useAdminUsers()

  if (user === null) {
    return null
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Admin dashboard</h1>
          <p className="mt-1 text-slate-600">
            Signed in as {user.firstName} {user.lastName} ({user.email}), system administrator.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={ADMIN_USERS_PATH} className={secondaryButtonClass + ' py-2'}>
            Manage users
          </Link>
          <Link to={ADMIN_NEW_STAFF_PATH} className={actionButtonClass}>
            Create staff account
          </Link>
        </div>
      </div>

      <section aria-labelledby="accounts-heading" className="mt-8">
        <h2 id="accounts-heading" className="text-lg font-semibold text-slate-900">
          Accounts
        </h2>
        {state.status === 'loading' && (
          <p role="status" className="mt-4 text-sm text-slate-600">
            Loading accounts…
          </p>
        )}
        {state.status === 'error' && (
          <div className="mt-4 space-y-3">
            <Alert tone="error">{state.message}</Alert>
            <button type="button" onClick={retry} className={secondaryButtonClass}>
              Try again
            </button>
          </div>
        )}
        {state.status === 'ready' && state.users.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">There are no accounts yet.</p>
        )}
        {state.status === 'ready' && state.users.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {summarise(state.users).map(([label, value]) => (
              <div
                key={label}
                role="group"
                aria-label={label}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <dt className="text-xs font-medium text-slate-500">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section aria-labelledby="scope-heading" className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="scope-heading" className="text-sm font-semibold text-slate-900">
          What administrators can do here
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Create staff accounts, and enable or disable student and staff accounts.</li>
          <li>
            Administration covers accounts only. It does not make you a member of any research project; access to a
            project comes from project membership.
          </li>
          <li>
            Supervisor, co-supervisor and evaluator are roles within a project. They are not assigned here and are
            not implied by a staff account.
          </li>
        </ul>
      </section>
    </AppShell>
  )
}
