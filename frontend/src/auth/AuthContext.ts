import { createContext, useContext } from 'react'
import type { User } from './types'

export interface AuthContextValue {
  /** The signed-in user as returned by the backend, or null. */
  user: User | null
  isAuthenticated: boolean
  /** True until a stored token has been checked with the backend on startup. */
  isInitializing: boolean
  /** Rejects with an ApiError when the credentials are refused. */
  login: (email: string, password: string) => Promise<void>
  /** Forgets the token in this browser. The backend has no logout endpoint. */
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }
  return value
}
