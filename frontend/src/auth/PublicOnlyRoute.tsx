import { Navigate, Outlet, useLocation } from 'react-router'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from './AuthContext'

export const DEFAULT_SIGNED_IN_PATH = '/dashboard'

/** Only in-app paths are accepted as a place to return to after signing in. */
function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  const isInAppPath =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.includes('\\')
  return isInAppPath ? from : DEFAULT_SIGNED_IN_PATH
}

/**
 * Wraps /login and /register. Once the user is signed in (already, or because
 * the login form just succeeded) they are sent to the page they originally
 * asked for, or to the dashboard.
 */
export default function PublicOnlyRoute() {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <LoadingScreen />
  }
  if (isAuthenticated) {
    return <Navigate to={returnPath(location.state)} replace />
  }
  return <Outlet />
}
