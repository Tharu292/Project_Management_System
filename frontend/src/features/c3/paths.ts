export const RESEARCH_WORKSPACE_PATH = '/research'
export const RESEARCH_INTELLIGENCE_PATH = '/research-intelligence'

export const MODULES = ['collaboration', 'meetings', 'knowledge', 'evidence'] as const
export type ModuleId = (typeof MODULES)[number]

export function modulePath(projectId: string, module: ModuleId): string {
  return `${RESEARCH_WORKSPACE_PATH}/projects/${projectId}/${module}`
}

export function workspacePath(projectId?: string): string {
  return projectId ? `${RESEARCH_WORKSPACE_PATH}?project=${projectId}` : RESEARCH_WORKSPACE_PATH
}
