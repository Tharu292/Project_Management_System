import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { isAdmin } from '../auth/landing'
import Alert from '../components/Alert'
import AppShell, { secondaryButtonClass } from '../components/AppShell'
import { GROUPS_PATH } from '../features/c4/paths'

/** Temporary signed-in landing page. It only proves authentication works; the real dashboard comes later. */
export default function DashboardPage() {
  const { user } = useAuth()
  const location = useLocation()
  const accessDenied = (location.state as { accessDenied?: unknown } | null)?.accessDenied === true

  if (user === null) {
    return null
  }

  const details: [string, string][] = [
    ['Email', user.email],
    ['Account type', user.accountType],
  ]
  if (user.registrationNumber) {
    details.push(['Registration number', user.registrationNumber])
  }
  if (user.staffId) {
    details.push(['Staff ID', user.staffId])
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        {accessDenied && (
          <div className="mb-6">
            <Alert tone="error">You do not have permission to open that page.</Alert>
          </div>
        )}
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user.firstName}</h1>
        <p className="mt-1 text-slate-600">You are signed in. Project features will appear here.</p>
        {!isAdmin(user) && (
          <p className="mt-4">
            <Link to={GROUPS_PATH} className={secondaryButtonClass}>
              Open my groups
            </Link>
          </p>
        )}
        <dl className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {details.map(([term, value]) => (
            <div key={term} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
              <dt className="text-sm text-slate-500">{term}</dt>
              <dd className="text-sm font-medium break-all text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </AppShell>
  )
}
