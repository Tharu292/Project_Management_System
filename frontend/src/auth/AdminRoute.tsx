import { Navigate, Outlet } from 'react-router'
import { useAuth } from './AuthContext'
import { USER_HOME_PATH, isAdmin } from './landing'

/**
 * Nest inside ProtectedRoute, which has already dealt with signed-out users
 * and users who must change their password. Everyone except a system
 * administrator is sent back to their own dashboard. The backend refuses
 * their requests regardless; this only keeps the pages out of sight.
 */
export default function AdminRoute() {
  const { user } = useAuth()

  if (user === null || !isAdmin(user)) {
    return <Navigate to={USER_HOME_PATH} replace state={{ accessDenied: true }} />
  }
  return <Outlet />
}
