// DEVELOPMENT-ONLY DEMONSTRATION DATA.
//
// Nothing here is real: no real group, person, score or mark, and none of it
// was calculated from anything. It is loaded only through a dynamic import
// behind `import.meta.env.DEV`, so a production build does not contain this
// file. Never import it statically.

import type { AccountType, SystemRole } from '../../../auth/types'
import type {
  GroupContribution,
  MemberContribution,
  MyGroup,
  ScoringConfigView,
  SnapshotView,
  StudentContribution,
  TeamProgress,
} from '../api/types'

/** Appears in every demonstration record, so it is obvious on screen and easy to search a build for. */
export const DEMO_MARKER = 'C4-DEMO'

const DEMO_GROUP_A = '00000000-0000-4000-8000-00000000000a'
const DEMO_GROUP_B = '00000000-0000-4000-8000-00000000000b'

export function demoGroupsFor(accountType: AccountType, systemRole: SystemRole): MyGroup[] {
  if (systemRole === 'ADMIN') {
    return []
  }
  if (accountType === 'STUDENT') {
    return [
      {
        projectId: DEMO_GROUP_A,
        projectCode: `${DEMO_MARKER}-A`,
        title: 'Demonstration group A',
        status: 'ACTIVE',
        roles: ['STUDENT'],
      },
    ]
  }
  return [
    {
      projectId: DEMO_GROUP_A,
      projectCode: `${DEMO_MARKER}-A`,
      title: 'Demonstration group A',
      status: 'ACTIVE',
      roles: ['SUPERVISOR'],
    },
    {
      projectId: DEMO_GROUP_B,
      projectCode: `${DEMO_MARKER}-B`,
      title: 'Demonstration group B',
      status: 'ACTIVE',
      roles: ['EVALUATOR'],
    },
  ]
}

// ---- contribution ----

/** The demonstration copy of the weights. The real ones always come from the backend. */
const DEMO_CONFIG: ScoringConfigView = {
  version: 1,
  categoryWeights: { DEVELOPMENT: 0.4, TASK_COMPLETION: 0.4, COLLABORATION: 0.2 },
  metricWeights: { COMMIT: 0.3, PULL_REQUEST: 0.1, COMPLETED_TASK: 0.4, ISSUE_COMMENT: 0.1, PULL_REQUEST_REVIEW: 0.1 },
  pullRequestStateMultipliers: { MERGED: 1, OPEN: 0.6, CLOSED_UNMERGED: 0.3 },
  provisional: ['PULL_REQUEST_STATE_MULTIPLIERS'],
}

function demoSnapshot(periodEnd: string, indicator: number, complete: boolean): SnapshotView {
  return {
    schemaVersion: 1,
    scoringConfigVersion: 1,
    periodStart: '2026-09-01',
    periodEnd,
    computedAt: `${periodEnd}T18:00:00Z`,
    indicator,
    developmentScore: 70,
    taskScore: complete ? 80 : null,
    collaborationScore: 50,
    partial: !complete,
    metrics: {
      COMMIT: { state: 'VALUE', count: 7, normalised: 70, reason: null },
      PULL_REQUEST: { state: 'VALUE', count: 3, normalised: 60, reason: null },
      COMPLETED_TASK: complete
        ? { state: 'VALUE', count: 4, normalised: 80, reason: null }
        : { state: 'UNAVAILABLE', count: null, normalised: null, reason: 'TASKS_NOT_CONNECTED' },
      ISSUE_COMMENT: { state: 'VERIFIED_ZERO', count: 0, normalised: 0, reason: null },
      PULL_REQUEST_REVIEW: { state: 'VALUE', count: 2, normalised: 100, reason: null },
    },
    pullRequestStates: { MERGED: 2, OPEN: 1, CLOSED_UNMERGED: 0 },
    coverage: {
      GITHUB: { status: 'AVAILABLE', reason: null },
      TASKS: complete
        ? { status: 'AVAILABLE', reason: null }
        : { status: 'UNAVAILABLE', reason: 'TASKS_NOT_CONNECTED' },
    },
    unavailableSources: complete ? [] : ['TASKS'],
  }
}

const DEMO_MEMBERS: { studentId: string; displayName: string; history: SnapshotView[] }[] = [
  {
    studentId: '00000000-0000-4000-8000-0000000000d1',
    displayName: `Demo Student One (${DEMO_MARKER})`,
    history: [demoSnapshot('2026-09-28', 72, true), demoSnapshot('2026-09-21', 64, true), demoSnapshot('2026-09-14', 51, true)],
  },
  {
    studentId: '00000000-0000-4000-8000-0000000000d2',
    displayName: `Demo Student Two (${DEMO_MARKER})`,
    history: [demoSnapshot('2026-09-28', 58, false)],
  },
  {
    studentId: '00000000-0000-4000-8000-0000000000d3',
    displayName: `Demo Student Three (${DEMO_MARKER})`,
    history: [],
  },
]

function demoMember(member: (typeof DEMO_MEMBERS)[number]): MemberContribution {
  return {
    studentId: member.studentId,
    displayName: member.displayName,
    calculated: member.history.length > 0,
    snapshot: member.history[0] ?? null,
  }
}

export function demoGroupContribution(projectId: string): GroupContribution {
  void projectId
  return { scoringConfig: DEMO_CONFIG, members: DEMO_MEMBERS.map(demoMember) }
}

export function demoStudentContribution(projectId: string, studentId: string): StudentContribution {
  void projectId
  const member = DEMO_MEMBERS.find((candidate) => candidate.studentId === studentId) ?? DEMO_MEMBERS[2]
  return {
    scoringConfig: DEMO_CONFIG,
    studentId: member.studentId,
    displayName: member.displayName,
    calculated: member.history.length > 0,
    latest: member.history[0] ?? null,
    history: member.history,
  }
}

export function demoTeamProgress(projectId: string): TeamProgress {
  void projectId
  return {
    available: true,
    unavailableReason: null,
    overall: { assigned: 12, completed: 7 },
    members: [
      { studentId: DEMO_MEMBERS[0].studentId, displayName: DEMO_MEMBERS[0].displayName, assigned: 5, completed: 4 },
      { studentId: DEMO_MEMBERS[1].studentId, displayName: DEMO_MEMBERS[1].displayName, assigned: 7, completed: 3 },
      { studentId: DEMO_MEMBERS[2].studentId, displayName: DEMO_MEMBERS[2].displayName, assigned: 0, completed: 0 },
    ],
  }
}
