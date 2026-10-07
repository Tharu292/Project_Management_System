import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'

/** Temporary signed-in landing page. It only proves authentication works; the real dashboard comes later. */
export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (user === null) {
    return null
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const details: [string, string][] = [
    ['Email', user.email],
    ['Account type', user.accountType],
  ]
  if (user.registrationNumber) {
    details.push(['Registration number', user.registrationNumber])
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-semibold tracking-wide text-indigo-700 uppercase">
            Research Project Management System
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user.firstName}</h1>
        <p className="mt-1 text-slate-600">You are signed in. Project features will appear here.</p>
        <dl className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {details.map(([term, value]) => (
            <div key={term} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
              <dt className="text-sm text-slate-500">{term}</dt>
              <dd className="text-sm font-medium break-all text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  )
}
