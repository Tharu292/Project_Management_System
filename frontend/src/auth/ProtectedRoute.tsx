import { Navigate, Outlet, useLocation } from 'react-router'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from './AuthContext'

/**
 * Keeps signed-out visitors away from the routes nested inside it, and
 * remembers where they were going. This is a convenience for the user only:
 * the backend checks every request and is the real security boundary.
 */
export default function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth()
  const location = useLocation()

  if (isInitializing) {
    return <LoadingScreen />
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}
