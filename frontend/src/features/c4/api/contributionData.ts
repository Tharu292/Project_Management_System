import { isDemoMode } from '../demo/demoMode'
import { getGroupContribution, getStudentContribution, getTeamProgress } from './contributionApi'
import type { GroupContribution, StudentContribution, TeamProgress } from './types'

// Where the contribution pages get their data. In normal operation that is
// always the backend. Demonstration data is used only in the development
// server with the explicit flag, and never because a request failed.
//
// `import.meta.env.DEV` is replaced by `false` in a production build, so the
// bundler removes each guarded branch and the demonstration data with it.

export async function loadGroupContribution(projectId: string): Promise<GroupContribution> {
  if (import.meta.env.DEV && isDemoMode()) {
    const { demoGroupContribution } = await import('../demo/demoData')
    return demoGroupContribution(projectId)
  }
  return getGroupContribution(projectId)
}

export async function loadStudentContribution(projectId: string, studentId: string): Promise<StudentContribution> {
  if (import.meta.env.DEV && isDemoMode()) {
    const { demoStudentContribution } = await import('../demo/demoData')
    return demoStudentContribution(projectId, studentId)
  }
  return getStudentContribution(projectId, studentId)
}

export async function loadTeamProgress(projectId: string): Promise<TeamProgress> {
  if (import.meta.env.DEV && isDemoMode()) {
    const { demoTeamProgress } = await import('../demo/demoData')
    return demoTeamProgress(projectId)
  }
  return getTeamProgress(projectId)
}
