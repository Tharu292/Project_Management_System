import { useState } from 'react'
import { Link } from 'react-router'
import { ADMIN_NEW_STAFF_PATH, ADMIN_USERS_PATH } from '../../auth/landing'
import type { AccountType, AdminUser } from '../../auth/types'
import Alert from '../../components/Alert'
import AppShell, { actionButtonClass, secondaryButtonClass } from '../../components/AppShell'
import UserBadges from './UserBadges'
import UserStatusAction from './UserStatusAction'
import { useAdminUsers } from './useAdminUsers'
import { ACCOUNT_TYPE_LABELS, SYSTEM_ROLE_LABELS, formatDate, fullName, institutionalId } from './userDisplay'

type AccountTypeFilter = 'ALL' | AccountType
type StatusFilter = 'ALL' | 'ENABLED' | 'DISABLED' | 'PASSWORD_PENDING'

const controlClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'focus:outline-2 focus:outline-offset-1 focus:outline-indigo-600'

const headerCellClass = 'px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase'

/** Filtering happens in the browser on the list already fetched; the backend offers no search or pagination. */
function matches(user: AdminUser, search: string, accountType: AccountTypeFilter, status: StatusFilter): boolean {
  if (accountType !== 'ALL' && user.accountType !== accountType) {
    return false
  }
  if (status === 'ENABLED' && !user.enabled) return false
  if (status === 'DISABLED' && user.enabled) return false
  if (status === 'PASSWORD_PENDING' && !user.mustChangePassword) return false
  const term = search.trim().toLowerCase()
  if (term === '') {
    return true
  }
  return [fullName(user), user.email, user.registrationNumber ?? '', user.staffId ?? ''].some((value) =>
    value.toLowerCase().includes(term),
  )
}

export default function AdminUsersPage() {
  const { state, reload, retry } = useAdminUsers()
  const [search, setSearch] = useState('')
  const [accountType, setAccountType] = useState<AccountTypeFilter>('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [changeNotice, setChangeNotice] = useState<string | null>(null)

  function handleChanged(updated: AdminUser) {
    setChangeNotice(`${fullName(updated)} has been ${updated.enabled ? 'enabled' : 'disabled'}.`)
    reload()
  }

  const users = state.status === 'ready' ? state.users : []
  const visible = users.filter((user) => matches(user, search, accountType, status))

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User management</h1>
          <p className="mt-1 text-slate-600">Every student, staff and administrator account.</p>
        </div>
        <Link to={ADMIN_NEW_STAFF_PATH} className={actionButtonClass}>
          Create staff account
        </Link>
      </div>

      {changeNotice && (
        <div className="mt-6">
          <Alert tone="success">{changeNotice}</Alert>
        </div>
      )}

      {state.status === 'loading' && (
        <p role="status" className="mt-8 text-sm text-slate-600">
          Loading users…
        </p>
      )}

      {state.status === 'error' && (
        <div className="mt-8 space-y-3">
          <Alert tone="error">{state.message}</Alert>
          <button type="button" onClick={retry} className={secondaryButtonClass}>
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && users.length === 0 && (
        <p className="mt-8 text-sm text-slate-600">There are no accounts yet.</p>
      )}

      {state.status === 'ready' && users.length > 0 && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <label htmlFor="user-search" className="block text-sm font-medium text-slate-800">
                Search users
              </label>
              <input
                id="user-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, registration number or staff ID"
                className={controlClass}
              />
            </div>
            <div>
              <label htmlFor="account-type-filter" className="block text-sm font-medium text-slate-800">
                Account type
              </label>
              <select
                id="account-type-filter"
                value={accountType}
                onChange={(event) => setAccountType(event.target.value as AccountTypeFilter)}
                className={controlClass}
              >
                <option value="ALL">All</option>
                <option value="STUDENT">Students</option>
                <option value="STAFF">Staff</option>
              </select>
            </div>
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-slate-800">
                Status
              </label>
              <select
                id="status-filter"
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className={controlClass}
              >
                <option value="ALL">All</option>
                <option value="ENABLED">Enabled</option>
                <option value="DISABLED">Disabled</option>
                <option value="PASSWORD_PENDING">Password change pending</option>
              </select>
            </div>
          </div>

          <p role="status" className="mt-4 text-sm text-slate-600">
            Showing {visible.length} of {users.length} users
          </p>

          {visible.length === 0 ? (
            <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
              No users match the current search and filters.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200">
                <caption className="sr-only">User accounts</caption>
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className={headerCellClass}>
                      Name
                    </th>
                    <th scope="col" className={`${headerCellClass} hidden md:table-cell`}>
                      Account type
                    </th>
                    <th scope="col" className={`${headerCellClass} hidden lg:table-cell`}>
                      System role
                    </th>
                    <th scope="col" className={`${headerCellClass} hidden lg:table-cell`}>
                      Registration no. / Staff ID
                    </th>
                    <th scope="col" className={headerCellClass}>
                      Status
                    </th>
                    <th scope="col" className={`${headerCellClass} hidden xl:table-cell`}>
                      Created
                    </th>
                    <th scope="col" className={headerCellClass}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visible.map((user) => (
                    <tr key={user.id}>
                      <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                        <span className="block text-sm font-medium text-slate-900">{fullName(user)}</span>
                        <span className="block text-sm break-all text-slate-600">{user.email}</span>
                        <span className="mt-1 block text-xs text-slate-500 md:hidden">
                          {ACCOUNT_TYPE_LABELS[user.accountType]}
                          {user.systemRole === 'ADMIN' && ' · Administrator'}
                        </span>
                      </th>
                      <td className="hidden px-4 py-3 align-top text-sm text-slate-700 md:table-cell">
                        {ACCOUNT_TYPE_LABELS[user.accountType]}
                      </td>
                      <td className="hidden px-4 py-3 align-top text-sm text-slate-700 lg:table-cell">
                        {SYSTEM_ROLE_LABELS[user.systemRole]}
                      </td>
                      <td className="hidden px-4 py-3 align-top text-sm text-slate-700 lg:table-cell">
                        {institutionalId(user) ?? <span className="text-slate-400">Not set</span>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <UserBadges user={user} />
                      </td>
                      <td className="hidden px-4 py-3 align-top text-sm whitespace-nowrap text-slate-700 xl:table-cell">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`${ADMIN_USERS_PATH}/${user.id}`}
                            aria-label={`View ${fullName(user)}`}
                            className={secondaryButtonClass}
                          >
                            View
                          </Link>
                          <UserStatusAction user={user} onChanged={handleChanged} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
