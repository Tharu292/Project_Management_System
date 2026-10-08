import { Navigate, Outlet, useLocation } from 'react-router'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from './AuthContext'
import { LOGIN_PATH, PASSWORD_CHANGE_PATH } from './landing'

/**
 * Keeps signed-out visitors away from the routes nested inside it, and
 * remembers where they were going. A signed-in user who must still change
 * their password is sent to do that first. This is a convenience for the user
 * only: the backend checks every request and is the real security boundary.
 */
export default function ProtectedRoute() {
  const { user, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <LoadingScreen />
  }
  if (user === null) {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname + location.search }} />
  }
  if (user.mustChangePassword) {
    return <Navigate to={PASSWORD_CHANGE_PATH} replace />
  }
  return <Outlet />
}
