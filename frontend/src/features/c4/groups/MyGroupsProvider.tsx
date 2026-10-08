import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../../../api/client'
import { useAuth } from '../../../auth/AuthContext'
import type { AccountType, SystemRole } from '../../../auth/types'
import { getMyGroups } from '../api/groupsApi'
import type { MyGroup } from '../api/types'
import { isDemoMode } from '../demo/demoMode'
import { MyGroupsContext, type MyGroupsState, type MyGroupsValue } from './MyGroupsContext'

async function loadMyGroups(accountType: AccountType, systemRole: SystemRole): Promise<MyGroup[]> {
  // `import.meta.env.DEV` is replaced by `false` in a production build, so the
  // bundler removes this whole branch and the demonstration data with it.
  if (import.meta.env.DEV && isDemoMode()) {
    const { demoGroupsFor } = await import('../demo/demoData')
    return demoGroupsFor(accountType, systemRole)
  }
  return getMyGroups()
}

/**
 * Loads the signed-in user's groups once for all Component 4 pages. A failed
 * request ends in an error state: it never falls back to demonstration data.
 */
export function MyGroupsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<MyGroupsState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const userId = user?.id
  const accountType = user?.accountType
  const systemRole = user?.systemRole

  useEffect(() => {
    if (userId === undefined || accountType === undefined || systemRole === undefined) {
      return
    }
    let cancelled = false
    loadMyGroups(accountType, systemRole)
      .then((groups) => {
        if (!cancelled) setState({ status: 'ready', groups })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        const message = caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.'
        setState({ status: 'error', message })
      })
    return () => {
      cancelled = true
    }
  }, [userId, accountType, systemRole, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((current) => current + 1)
  }, [])

  const value = useMemo<MyGroupsValue>(() => ({ state, retry }), [state, retry])

  return <MyGroupsContext.Provider value={value}>{children}</MyGroupsContext.Provider>
}
