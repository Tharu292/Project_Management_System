import type {
  ChangePasswordRequest,
  LoginRequest,
  LoginResponse,
  StudentRegistrationRequest,
  User,
} from '../auth/types'
import { CURRENT_USER_PATH, apiRequest } from './client'

/** Creates a student account. Returns the user and no token: the student signs in afterwards. */
export function registerStudent(request: StudentRegistrationRequest): Promise<User> {
  return apiRequest<User>('/api/v1/auth/register/student', { method: 'POST', body: request })
}

/** One login for students, staff and admins. */
export function login(request: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/v1/auth/login', { method: 'POST', body: request })
}

/** The signed-in user as the backend currently sees them. */
export function getCurrentUser(): Promise<User> {
  return apiRequest<User>(CURRENT_USER_PATH, { auth: true })
}

/**
 * Changes the signed-in user's own password. The backend answers 204 with no
 * new token and invalidates the one used here, so the caller must drop it and
 * have the user sign in again.
 */
export function changePassword(request: ChangePasswordRequest): Promise<void> {
  return apiRequest<void>('/api/v1/auth/change-password', { method: 'POST', body: request, auth: true })
}
