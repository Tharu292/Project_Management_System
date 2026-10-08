import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '../api/authApi'
import { setForbiddenHandler, setUnauthorizedHandler } from '../api/client'
import { AuthContext, type AuthContextValue, type SessionNotice } from './AuthContext'
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
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null)

  // Any authenticated request that gets a 401 has already had its token removed by the API client.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null)
      setSessionNotice('session-ended')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  // A 403 does not end the session, but it can mean the account changed since
  // it was loaded (for example, it must now change its password). Asking the
  // backend again lets the route guards react to what is true now, without
  // depending on the wording of the error.
  useEffect(() => {
    setForbiddenHandler(() => {
      const token = getToken()
      if (token === null) {
        return
      }
      authApi
        .getCurrentUser()
        .then((current) => {
          if (getToken() === token) setUser(current)
        })
        .catch(() => {
          // 401: the client already signed the user out. Anything else: keep what we have.
        })
    })
    return () => setForbiddenHandler(null)
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
    setSessionNotice(null)
    setUser(response.user)
  }, [])

  const logout = useCallback(() => {
    removeToken()
    setSessionNotice(null)
    setUser(null)
  }, [])

  const finishPasswordChange = useCallback(() => {
    removeToken()
    setSessionNotice('password-changed')
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isInitializing,
      sessionNotice,
      login,
      logout,
      finishPasswordChange,
    }),
    [user, isInitializing, sessionNotice, login, logout, finishPasswordChange],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
