import { createContext, useContext } from 'react'
import type { User } from './types'

/** Why the user is looking at the sign-in page, when the app itself sent them there. */
export type SessionNotice = 'password-changed' | 'session-ended'

export interface AuthContextValue {
  /** The signed-in user as returned by the backend, or null. */
  user: User | null
  isAuthenticated: boolean
  /** True until a stored token has been checked with the backend on startup. */
  isInitializing: boolean
  /** Set when the app signed the user out itself; shown on the sign-in page until the next sign-in. */
  sessionNotice: SessionNotice | null
  /** Rejects with an ApiError when the credentials are refused. */
  login: (email: string, password: string) => Promise<void>
  /** Forgets the token in this browser. The backend has no logout endpoint. */
  logout: () => void
  /**
   * Call after the backend accepted a password change. The backend has already
   * invalidated the token, so it is dropped here and the user signs in again.
   */
  finishPasswordChange: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }
  return value
}
