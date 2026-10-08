import { Navigate } from 'react-router'
import LoadingScreen from '../components/LoadingScreen'
import { useAuth } from './AuthContext'
import { LOGIN_PATH, homePathFor } from './landing'

/** For "/" and unknown paths: the sign-in page, or the signed-in user's own start page. */
export default function HomeRedirect() {
  const { user, isInitializing } = useAuth()

  if (isInitializing) {
    return <LoadingScreen />
  }
  return <Navigate to={user === null ? LOGIN_PATH : homePathFor(user)} replace />
}
