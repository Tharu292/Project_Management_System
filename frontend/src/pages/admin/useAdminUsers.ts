import { useCallback, useEffect, useState } from 'react'
import { listUsers } from '../../api/adminApi'
import { ApiError } from '../../api/client'
import type { AdminUser } from '../../auth/types'

export type AdminUsersState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; users: AdminUser[] }

export function errorMessage(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.'
}

/** Loads every account from the backend. `reload` fetches again and keeps showing the current list meanwhile. */
export function useAdminUsers(): { state: AdminUsersState; reload: () => void; retry: () => void } {
  const [state, setState] = useState<AdminUsersState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    listUsers()
      .then((users) => {
        if (!cancelled) setState({ status: 'ready', users })
      })
      .catch((caught: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(caught) })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const reload = useCallback(() => setAttempt((current) => current + 1), [])
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((current) => current + 1)
  }, [])

  return { state, reload, retry }
}
