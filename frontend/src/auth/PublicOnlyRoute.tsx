import { Navigate, Outlet, useLocation } from 'react-router'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from './AuthContext'
import { PASSWORD_CHANGE_PATH, homePathFor, isAdmin, isAdminPath } from './landing'
import type { User } from './types'

/**
 * Where to go after signing in: the page the user originally asked for, when
 * it is an in-app path they may open, otherwise their own start page.
 */
function returnPath(state: unknown, user: User): string {
  const from = (state as { from?: unknown } | null)?.from
  const isInAppPath =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.includes('\\')
  if (!isInAppPath || from.startsWith(PASSWORD_CHANGE_PATH) || (isAdminPath(from) && !isAdmin(user))) {
    return homePathFor(user)
  }
  return from
}

/**
 * Wraps /login and /register. Once the user is signed in (already, or because
 * the login form just succeeded) they are sent to change their password if
 * they must, otherwise to the page they asked for or their start page.
 */
export default function PublicOnlyRoute() {
  const { user, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <LoadingScreen />
  }
  if (user !== null) {
    return <Navigate to={user.mustChangePassword ? PASSWORD_CHANGE_PATH : returnPath(location.state, user)} replace />
  }
  return <Outlet />
}
