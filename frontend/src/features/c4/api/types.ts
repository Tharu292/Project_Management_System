// Mirrors the Component 4 backend response types (com.researchpms.backend.c4).
// The backend is authoritative: change these only when those types change.

/** The role a user holds within one project group. A user may hold different roles in different groups. */
export type ProjectRole = 'STUDENT' | 'SUPERVISOR' | 'CO_SUPERVISOR' | 'EVALUATOR'

export type ProjectStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

/**
 * MyGroupResponse: one group the signed-in user belongs to, with the roles
 * that count for them there. It says nothing about the other members.
 */
export interface MyGroup {
  projectId: string
  projectCode: string
  title: string
  status: ProjectStatus
  roles: ProjectRole[]
}

/**
 * How a contribution metric is known. A verified zero (the source was read
 * and shows no activity) and unavailable evidence (the source could not be
 * read) are different things and are never displayed the same way.
 */
export type Metric =
  | { state: 'VALUE'; value: number }
  | { state: 'VERIFIED_ZERO' }
  | { state: 'UNAVAILABLE'; reason?: string }
