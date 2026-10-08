import type { MyGroup, ProjectRole, ProjectStatus } from '../api/types'

// What the signed-in user may open in one group. This only decides which links
// and pages are offered: the backend checks every request and is the real
// security boundary.

export const ROLE_LABELS: Record<ProjectRole, string> = {
  STUDENT: 'Student',
  SUPERVISOR: 'Supervisor',
  CO_SUPERVISOR: 'Co-supervisor',
  EVALUATOR: 'Evaluator',
}

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

export interface GroupAccess {
  isStudent: boolean
  isSupervising: boolean
  isEvaluator: boolean
  /** Supervising and evaluating the same group is not allowed; if it happens, neither side may mark. */
  hasAssessmentConflict: boolean
  canMarkAsSupervisor: boolean
  canMarkAsEvaluator: boolean
}

export function accessFor(group: MyGroup): GroupAccess {
  const isStudent = group.roles.includes('STUDENT')
  const isSupervising = group.roles.includes('SUPERVISOR') || group.roles.includes('CO_SUPERVISOR')
  const isEvaluator = group.roles.includes('EVALUATOR')
  const hasAssessmentConflict = isSupervising && isEvaluator
  return {
    isStudent,
    isSupervising,
    isEvaluator,
    hasAssessmentConflict,
    canMarkAsSupervisor: isSupervising && !hasAssessmentConflict,
    canMarkAsEvaluator: isEvaluator && !hasAssessmentConflict,
  }
}

export type SectionPrivacy = 'none' | 'private-wellbeing' | 'group-wellbeing'

export interface GroupSection {
  /** Also the path of the section inside the group. */
  path: string
  label: string
  description: string
  allowed: (access: GroupAccess) => boolean
  privacy: SectionPrivacy
}

const anyMember = (access: GroupAccess) => access.isStudent || access.isSupervising || access.isEvaluator
const studentOnly = (access: GroupAccess) => access.isStudent

/**
 * Every section of a group, and who may open it. Wellbeing sections are for
 * students only: a supervisor, co-supervisor or evaluator is never offered
 * them. The two assessment sections are separate and never offered together.
 */
export const GROUP_SECTIONS: GroupSection[] = [
  {
    path: 'contribution',
    label: 'Contribution',
    description: 'Contribution Indicators and category scores for the members of this group.',
    allowed: anyMember,
    privacy: 'none',
  },
  {
    path: 'progress',
    label: 'Team progress',
    description: 'Overall project progress and the progress of each member.',
    allowed: anyMember,
    privacy: 'none',
  },
  {
    path: 'github',
    label: 'GitHub evidence',
    description: 'The linked repository and the evidence collected from it.',
    allowed: anyMember,
    privacy: 'none',
  },
  {
    path: 'portfolio',
    label: 'Assessment portfolio',
    description: 'A summary of contribution evidence that supports an assessment.',
    allowed: anyMember,
    privacy: 'none',
  },
  {
    path: 'team-wellbeing',
    label: 'Team wellbeing',
    description: 'Status, score and trend of teammates who chose to share them.',
    allowed: studentOnly,
    privacy: 'group-wellbeing',
  },
  {
    path: 'wellbeing',
    label: 'My wellbeing',
    description: 'Your own weekly reflections, trends, recommendations and warnings.',
    allowed: studentOnly,
    privacy: 'private-wellbeing',
  },
  {
    path: 'results',
    label: 'My results',
    description: 'Your assessment results, once they have been released.',
    allowed: studentOnly,
    privacy: 'none',
  },
  {
    path: 'assessment/supervisor',
    label: 'Supervisor assessment',
    description: 'Your own supervisor-side marks and feedback for this group.',
    allowed: (access) => access.canMarkAsSupervisor,
    privacy: 'none',
  },
  {
    path: 'assessment/evaluator',
    label: 'Evaluator assessment',
    description: 'Your own evaluator-side marks and feedback for this group.',
    allowed: (access) => access.canMarkAsEvaluator,
    privacy: 'none',
  },
]

export function sectionsFor(group: MyGroup): GroupSection[] {
  const access = accessFor(group)
  return GROUP_SECTIONS.filter((section) => section.allowed(access))
}
