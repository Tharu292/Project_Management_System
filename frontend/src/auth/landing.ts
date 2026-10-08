import type { User } from './types'

export const LOGIN_PATH = '/login'
export const PASSWORD_CHANGE_PATH = '/change-password'
export const USER_HOME_PATH = '/dashboard'
export const ADMIN_HOME_PATH = '/admin/dashboard'
export const ADMIN_USERS_PATH = '/admin/users'
export const ADMIN_NEW_STAFF_PATH = '/admin/users/new-staff'

export function isAdmin(user: User): boolean {
  return user.systemRole === 'ADMIN'
}

/**
 * Where a signed-in user starts. Decided only by what the backend says about
 * the user: never by the email domain, and account type STAFF does not make
 * anyone a supervisor or an administrator.
 */
export function homePathFor(user: User): string {
  if (user.mustChangePassword) {
    return PASSWORD_CHANGE_PATH
  }
  return isAdmin(user) ? ADMIN_HOME_PATH : USER_HOME_PATH
}

/** Whether a path belongs to the administrator pages. */
export function isAdminPath(path: string): boolean {
  return path === '/admin' || path.startsWith('/admin/') || path.startsWith('/admin?')
}
