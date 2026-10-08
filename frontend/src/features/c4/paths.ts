export const GROUPS_PATH = '/groups'

export function groupPath(projectId: string): string {
  return `${GROUPS_PATH}/${projectId}`
}

export function sectionPath(projectId: string, section: string): string {
  return `${groupPath(projectId)}/${section}`
}
