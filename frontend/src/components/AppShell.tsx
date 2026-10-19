import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { ADMIN_HOME_PATH, ADMIN_NEW_STAFF_PATH, ADMIN_USERS_PATH, LOGIN_PATH, isAdmin } from '../auth/landing'

const ADMIN_NAVIGATION = [
  { to: ADMIN_HOME_PATH, label: 'Admin Dashboard', end: true },
  { to: ADMIN_USERS_PATH, label: 'User Management', end: true },
  { to: ADMIN_NEW_STAFF_PATH, label: 'Create Staff', end: true },
]

export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold ' +
  'text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:text-slate-400'

export const actionButtonClass =
  'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white ' +
  'hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ' +
  'disabled:cursor-not-allowed disabled:bg-indigo-300'

/**
 * The frame for every signed-in page: who is signed in, logout, and, for
 * system administrators only, the administration menu.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (user === null) {
    return null
  }
  const showAdminNavigation = isAdmin(user)

  function handleLogout() {
    logout()
    navigate(LOGIN_PATH, { replace: true })
  }

  return (
    <div className="min-h-svh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <p className="text-sm font-semibold tracking-wide text-indigo-700 uppercase">
            Research Project Management System
          </p>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-600">
              <span className="sr-only">Signed in as </span>
              <span className="font-medium text-slate-900">
                {user.firstName} {user.lastName}
              </span>
              {showAdminNavigation && (
                <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                  Administrator
                </span>
              )}
            </p>
            <button type="button" onClick={handleLogout} className={secondaryButtonClass}>
              Log out
            </button>
          </div>
        </div>
        {showAdminNavigation && (
          <nav aria-label="Administration" className="border-t border-slate-200">
            <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
              {ADMIN_NAVIGATION.map((item) => (
                <li key={item.to} className="shrink-0">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      'block border-b-2 px-3 py-2.5 text-sm font-medium focus-visible:outline-2 ' +
                      'focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 ' +
                      (isActive
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900')
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
