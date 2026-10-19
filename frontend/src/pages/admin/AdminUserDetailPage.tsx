import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getUser } from '../../api/adminApi'
import { ADMIN_USERS_PATH } from '../../auth/landing'
import type { AdminUser } from '../../auth/types'
import Alert from '../../components/Alert'
import AppShell from '../../components/AppShell'
import { linkClass } from '../../components/AuthLayout'
import UserBadges from './UserBadges'
import UserStatusAction from './UserStatusAction'
import { errorMessage } from './useAdminUsers'
import { ACCOUNT_TYPE_LABELS, SYSTEM_ROLE_LABELS, formatDate, fullName } from './userDisplay'

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; user: AdminUser; notice: string | null }

/** One account, exactly as the backend returns it. There is no password or project information to show. */
export default function AdminUserDetailPage() {
  const { userId = '' } = useParams()
  const [state, setState] = useState<DetailState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getUser(userId)
      .then((user) => {
        if (!cancelled) setState({ status: 'ready', user, notice: null })
      })
      .catch((caught: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(caught) })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  function handleChanged(updated: AdminUser) {
    setState({
      status: 'ready',
      user: updated,
      notice: `${fullName(updated)} has been ${updated.enabled ? 'enabled' : 'disabled'}.`,
    })
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <Link to={ADMIN_USERS_PATH} className={linkClass + ' text-sm'}>
          ← Back to user management
        </Link>

        {state.status === 'loading' && (
          <p role="status" className="mt-6 text-sm text-slate-600">
            Loading user…
          </p>
        )}

        {state.status === 'error' && (
          <div className="mt-6">
            <Alert tone="error">{state.message}</Alert>
          </div>
        )}

        {state.status === 'ready' && (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{fullName(state.user)}</h1>
                <p className="mt-1 break-all text-slate-600">{state.user.email}</p>
              </div>
              <UserStatusAction user={state.user} onChanged={handleChanged} />
            </div>

            {state.notice && (
              <div className="mt-4">
                <Alert tone="success">{state.notice}</Alert>
              </div>
            )}

            <dl className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {(
                [
                  ['Account type', ACCOUNT_TYPE_LABELS[state.user.accountType]],
                  ['System role', SYSTEM_ROLE_LABELS[state.user.systemRole]],
                  ['Registration number', state.user.registrationNumber ?? 'Not set'],
                  ['Staff ID', state.user.staffId ?? 'Not set'],
                  ['Created', formatDate(state.user.createdAt)],
                ] as [string, string][]
              ).map(([term, value]) => (
                <div key={term} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
                  <dt className="text-sm text-slate-500">{term}</dt>
                  <dd className="text-sm font-medium break-all text-slate-900">{value}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between">
                <dt className="text-sm text-slate-500">Status</dt>
                <dd>
                  <UserBadges user={state.user} />
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-sm text-slate-600">
              Project roles are not shown here: they belong to project membership, not to the account.
            </p>
          </>
        )}
      </div>
    </AppShell>
  )
}
