import { apiRequest } from '../../../api/client'
import type { GroupContribution, StudentContribution, TeamProgress } from './types'

// Read-only. The backend decides who may see what: the students of a group
// and the staff assigned to it.

const project = (projectId: string) => `/api/v1/c4/projects/${encodeURIComponent(projectId)}`

/** The weights in use and the latest stored snapshot of every active student of the group. */
export function getGroupContribution(projectId: string): Promise<GroupContribution> {
  return apiRequest<GroupContribution>(`${project(projectId)}/contribution`, { auth: true })
}

/** One student's stored snapshots, newest first. */
export function getStudentContribution(projectId: string, studentId: string): Promise<StudentContribution> {
  return apiRequest<StudentContribution>(
    `${project(projectId)}/students/${encodeURIComponent(studentId)}/contribution`,
    { auth: true },
  )
}

/** Task progress summarised from the task management component, or "unavailable". */
export function getTeamProgress(projectId: string): Promise<TeamProgress> {
  return apiRequest<TeamProgress>(`${project(projectId)}/progress`, { auth: true })
}
