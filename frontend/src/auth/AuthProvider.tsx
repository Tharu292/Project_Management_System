import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/authApi'
import { setUnauthorizedHandler } from '../api/client'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { getToken, removeToken, setToken } from './tokenStorage'
import type { User } from './types'

/**
 * Owns the authentication state for the whole app. The user always comes from
 * the backend (login response or /auth/me); the token is never decoded here.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // With no stored token there is nothing to check, so startup is already complete.
  const [isInitializing, setIsInitializing] = useState(() => getToken() !== null)

  // Any authenticated request that gets a 401 has already had its token removed by the API client.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  // Restore the session after a reload by asking the backend who the token belongs to.
  useEffect(() => {
    if (getToken() === null) {
      return
    }
    let cancelled = false
    authApi
      .getCurrentUser()
      .then((restored) => {
        if (!cancelled) setUser(restored)
      })
      .catch(() => {
        // 401: the client removed the stale token. Anything else (server down):
        // stay signed out for now but keep the token, so a later reload can retry.
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login({ email, password })
    setToken(response.accessToken)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    removeToken()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, isInitializing, login, logout }),
    [user, isInitializing, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
