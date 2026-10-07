import type { LoginRequest, LoginResponse, StudentRegistrationRequest, User } from '../auth/types'
import { apiRequest } from './client'

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
  return apiRequest<User>('/api/v1/auth/me', { auth: true })
}
