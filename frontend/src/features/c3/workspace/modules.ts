import type { ProjectAccess } from '../display'
import type { ModuleId } from '../paths'
import type { IconName } from '../ui/Icon'

export interface ModuleInfo {
  id: ModuleId
  number: number
  title: string
  shortTitle: string
  description: string
  icon: IconName
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
    shortTitle: 'Collaboration',
    description: 'Progress updates and questions from students, with replies from supervisors.',
    icon: 'chat',
    unavailableReason: teamOnly,
  },
  {
    id: 'meetings',
    number: 2,
    title: 'Integrated Meeting Workspace',
    shortTitle: 'Meetings',
    description: 'Schedule meetings with an agenda and a place or link, record minutes and keep the history.',
    icon: 'calendar',
    unavailableReason: teamOnly,
  },
  {
    id: 'knowledge',
    number: 3,
    title: 'Project Knowledge Repository',
    shortTitle: 'Knowledge Repository',
    description: 'Papers, links, notes, datasets and documents for the project, with search.',
    icon: 'book',
    unavailableReason: () => null,
  },
  {
    id: 'evidence',
    number: 4,
    title: 'Evidence-Based Assessment Portfolio',
    shortTitle: 'Evidence Portfolio',
    description: 'Evidence of each student’s work linked to project activities, verified by supervisors.',
    icon: 'badgeCheck',
    unavailableReason: () => null,
  },
]

export function moduleInfo(id: string): ModuleInfo | undefined {
  return MODULE_INFO.find((module) => module.id === id)
}
