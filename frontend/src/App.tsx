import { Navigate, Route, Routes } from 'react-router'
import AdminRoute from './auth/AdminRoute'
import { AuthProvider } from './auth/AuthProvider'
import HomeRedirect from './auth/HomeRedirect'
import PasswordChangeRoute from './auth/PasswordChangeRoute'
import ProtectedRoute from './auth/ProtectedRoute'
import PublicOnlyRoute from './auth/PublicOnlyRoute'
import { ADMIN_HOME_PATH } from './auth/landing'
import C4Routes from './features/c4/C4Routes'
import ChangePasswordPage from './pages/ChangePasswordPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import CreateStaffPage from './pages/admin/CreateStaffPage'

/**
 * Routes placed inside ProtectedRoute require a signed-in user who is not
 * waiting to change their password; those inside AdminRoute also require a
 * system administrator. Everything else must be listed as public.
 */
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<PasswordChangeRoute />}>
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/groups/*" element={<C4Routes />} />
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Navigate to={ADMIN_HOME_PATH} replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/users/new-staff" element={<CreateStaffPage />} />
            <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
