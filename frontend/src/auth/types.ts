// Mirrors the backend DTOs in com.researchpms.backend.shared.auth.dto and
// com.researchpms.backend.shared.admin.dto.
// The backend is authoritative: change these only when those DTOs change.

/** The kind of institutional account. It describes the person and grants no permission. */
export type AccountType = 'STUDENT' | 'STAFF'

/** System-wide authority. USER does not mean "student"; ADMIN does not mean "project member". */
export type SystemRole = 'USER' | 'ADMIN'

// Project roles (STUDENT, SUPERVISOR, CO_SUPERVISOR, EVALUATOR) are per project
// and are deliberately not part of User. They will come from project
// membership data, never from the token, the email domain or the fields below.

/** UserResponse */
export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  accountType: AccountType
  systemRole: SystemRole
  registrationNumber: string | null
  staffId: string | null
  /** True while the user may only read their own details and change their password. */
  mustChangePassword: boolean
}

/** AdminUserResponse: a user as an administrator sees it. Never a password, and no project information. */
export interface AdminUser extends User {
  enabled: boolean
  /** ISO-8601 instant. */
  createdAt: string
}

/** StudentRegistrationRequest. The server decides account type, system role and enabled. */
export interface StudentRegistrationRequest {
  firstName: string
  lastName: string
  email: string
  registrationNumber: string
  password: string
  confirmPassword: string
}

/** CreateStaffRequest. The server decides account type, system role, enabled and mustChangePassword. */
export interface CreateStaffRequest {
  firstName: string
  lastName: string
  email: string
  staffId: string
  password: string
  confirmPassword: string
}

/** LoginRequest */
export interface LoginRequest {
  email: string
  password: string
}

/** LoginResponse. expiresIn is in seconds. */
export interface LoginResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: User
}

/** ChangePasswordRequest. Answered with 204 and no new token. */
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
