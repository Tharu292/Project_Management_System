import { Navigate, Outlet } from 'react-router'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from './AuthContext'
import { LOGIN_PATH, homePathFor } from './landing'

/**
 * Wraps /change-password. It is the only signed-in page open to a user who
 * must change their password, and it is not offered to anyone else: there is
 * no voluntary password-change page yet, so other users go to their start page.
 */
export default function PasswordChangeRoute() {
  const { user, isInitializing } = useAuth()

  if (isInitializing) {
    return <LoadingScreen />
  }
  if (user === null) {
    return <Navigate to={LOGIN_PATH} replace />
  }
  if (!user.mustChangePassword) {
    return <Navigate to={homePathFor(user)} replace />
  }
  return <Outlet />
}
