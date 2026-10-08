import type { AccountType, AdminUser, SystemRole } from '../../auth/types'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = { STUDENT: 'Student', STAFF: 'Staff' }

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = { USER: 'User', ADMIN: 'Administrator' }

export function fullName(user: AdminUser): string {
  return `${user.firstName} ${user.lastName}`
}

/** The registration number for a student or the staff ID for staff; either may be absent. */
export function institutionalId(user: AdminUser): string | null {
  return user.registrationNumber ?? user.staffId
}

export function formatDate(isoInstant: string): string {
  const date = new Date(isoInstant)
  if (Number.isNaN(date.getTime())) {
    return isoInstant
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
