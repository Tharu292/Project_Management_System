import type { AdminUser, CreateStaffRequest } from '../auth/types'
import { apiRequest } from './client'

// Every call here needs a signed-in system administrator. The backend decides
// that on each request; these functions only attach the token.

const USERS = '/api/v1/admin/users'

/** Every account, oldest first. The backend has no pagination or filtering. */
export function listUsers(): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>(USERS, { auth: true })
}

export function getUser(userId: string): Promise<AdminUser> {
  return apiRequest<AdminUser>(`${USERS}/${encodeURIComponent(userId)}`, { auth: true })
}

/** Creates a staff account that must change its password at first login. */
export function createStaff(request: CreateStaffRequest): Promise<AdminUser> {
  return apiRequest<AdminUser>(`${USERS}/staff`, { method: 'POST', body: request, auth: true })
}

/** Enables or disables an ordinary account. The backend refuses administrator accounts. */
export function setUserEnabled(userId: string, enabled: boolean): Promise<AdminUser> {
  return apiRequest<AdminUser>(`${USERS}/${encodeURIComponent(userId)}/enabled`, {
    method: 'PATCH',
    body: { enabled },
    auth: true,
  })
}
