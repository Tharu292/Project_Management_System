import type { ProjectAccess } from '../display'
import type { ModuleId } from '../paths'

export interface ModuleInfo {
  id: ModuleId
  number: number
  title: string
  description: string
  /** Why the module is closed to this user, or null when it is open. */
  unavailableReason: (access: ProjectAccess) => string | null
}

const teamOnly = (access: ProjectAccess) =>
  access.isTeam ? null : 'Only the supervision team (students and supervisors) can open this module.'

export const MODULE_INFO: ModuleInfo[] = [
  {
    id: 'collaboration',
    number: 1,
    title: 'Supervisor–Student Collaboration',
    description: 'Progress updates and questions from students, with replies from supervisors.',
    unavailableReason: teamOnly,
  },
  {
    id: 'meetings',
    number: 2,
    title: 'Integrated Meeting Workspace',
    description: 'Schedule meetings with an agenda and a place or link, record minutes and keep the history.',
    unavailableReason: teamOnly,
  },
  {
    id: 'knowledge',
    number: 3,
    title: 'Project Knowledge Repository',
    description: 'Papers, links, notes, datasets and documents for the project, with search.',
    unavailableReason: () => null,
  },
  {
    id: 'evidence',
    number: 4,
    title: 'Evidence-Based Assessment Portfolio',
    description: 'Evidence of each student’s work linked to project activities, verified by supervisors.',
    unavailableReason: () => null,
  },
]

export function moduleInfo(id: string): ModuleInfo | undefined {
  return MODULE_INFO.find((module) => module.id === id)
}
