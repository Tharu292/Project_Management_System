import { ApiError } from '../../api/client'
import { errorMessage } from './api/useLoad'
import type { ProjectRole } from './api/types'

export const ROLE_LABELS: Record<ProjectRole, string> = {
  STUDENT: 'Student',
  SUPERVISOR: 'Supervisor',
  CO_SUPERVISOR: 'Co-supervisor',
  EVALUATOR: 'Evaluator',
}

/** What the signed-in user may do in one project. The backend enforces the same rules. */
export function accessFor(roles: ProjectRole[]) {
  const isStudent = roles.includes('STUDENT')
  const isSupervisor = roles.includes('SUPERVISOR') || roles.includes('CO_SUPERVISOR')
  return {
    isStudent,
    isSupervisor,
    isTeam: isStudent || isSupervisor,
  }
}

export type ProjectAccess = ReturnType<typeof accessFor>

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const dateOnly = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

/** For yyyy-MM-dd dates, shown as written (no time zone shift). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return dateOnly.format(new Date(year, month - 1, day))
}

export function today(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A failed save: the general message plus per-field messages from the backend. */
export function formError(caught: unknown): { message: string; fields: Record<string, string> } {
  return { message: errorMessage(caught), fields: caught instanceof ApiError ? caught.fieldErrors : {} }
}

export const cardClass = 'rounded-xl border border-slate-200 bg-white p-5'
