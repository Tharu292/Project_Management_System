import type {
  GroupContribution,
  MemberContribution,
  ScoringConfigView,
  SnapshotView,
  StudentContribution,
  TeamProgress,
} from '../api/types'

// TEST-ONLY. The JSON shapes the Component 4 backend returns, with made-up
// content. Nothing here is a real student, score or mark. The weights are
// deliberately NOT the real ones, so a test can tell "read from the response"
// from "written into a component".

export const CONTRIBUTION = (projectId: string) => `GET /api/v1/c4/projects/${projectId}/contribution`
export const STUDENT_CONTRIBUTION = (projectId: string, studentId: string) =>
  `GET /api/v1/c4/projects/${projectId}/students/${studentId}/contribution`
export const PROGRESS = (projectId: string) => `GET /api/v1/c4/projects/${projectId}/progress`

/** The agreed weights, as the backend's seeded configuration returns them. */
export const seededConfig: ScoringConfigView = {
  version: 1,
  categoryWeights: { DEVELOPMENT: 0.4, TASK_COMPLETION: 0.4, COLLABORATION: 0.2 },
  metricWeights: { COMMIT: 0.3, PULL_REQUEST: 0.1, COMPLETED_TASK: 0.4, ISSUE_COMMENT: 0.1, PULL_REQUEST_REVIEW: 0.1 },
  pullRequestStateMultipliers: { MERGED: 1, OPEN: 0.6, CLOSED_UNMERGED: 0.3 },
  provisional: ['PULL_REQUEST_STATE_MULTIPLIERS'],
}

/** A different, later version: every figure differs from the seeded one, and nothing is provisional. */
export const otherConfig: ScoringConfigView = {
  version: 9,
  categoryWeights: { DEVELOPMENT: 0.25, TASK_COMPLETION: 0.55, COLLABORATION: 0.2 },
  metricWeights: { COMMIT: 0.05, PULL_REQUEST: 0.2, COMPLETED_TASK: 0.55, ISSUE_COMMENT: 0.15, PULL_REQUEST_REVIEW: 0.05 },
  pullRequestStateMultipliers: { MERGED: 0.9, OPEN: 0.45, CLOSED_UNMERGED: 0.15 },
  provisional: [],
}

/** Everything was read: GitHub and tasks. Issue comments are a verified zero. */
export function completeSnapshot(overrides: Partial<SnapshotView> = {}): SnapshotView {
  return {
    schemaVersion: 1,
    scoringConfigVersion: 1,
    periodStart: '2026-09-01',
    periodEnd: '2026-09-28',
    computedAt: '2026-09-29T08:00:00Z',
    indicator: 71.25,
    developmentScore: 67.5,
    taskScore: 80,
    collaborationScore: 50,
    partial: false,
    metrics: {
      COMMIT: { state: 'VALUE', count: 7, normalised: 70, reason: null },
      PULL_REQUEST: { state: 'VALUE', count: 3, normalised: 60, reason: null },
      COMPLETED_TASK: { state: 'VALUE', count: 4, normalised: 80, reason: null },
      ISSUE_COMMENT: { state: 'VERIFIED_ZERO', count: 0, normalised: 0, reason: null },
      PULL_REQUEST_REVIEW: { state: 'VALUE', count: 2, normalised: 100, reason: null },
    },
    pullRequestStates: { MERGED: 2, OPEN: 1, CLOSED_UNMERGED: 0 },
    coverage: { GITHUB: { status: 'AVAILABLE', reason: null }, TASKS: { status: 'AVAILABLE', reason: null } },
    unavailableSources: [],
    ...overrides,
  }
}

/** GitHub was read; the task source was not, so the task score is absent and the snapshot is partial. */
export function partialSnapshot(overrides: Partial<SnapshotView> = {}): SnapshotView {
  const complete = completeSnapshot()
  return {
    ...complete,
    indicator: 61.75,
    taskScore: null,
    partial: true,
    metrics: {
      ...complete.metrics,
      COMPLETED_TASK: { state: 'UNAVAILABLE', count: null, normalised: null, reason: 'TASKS_NOT_CONNECTED' },
    },
    coverage: {
      GITHUB: { status: 'AVAILABLE', reason: null },
      TASKS: { status: 'UNAVAILABLE', reason: 'TASKS_NOT_CONNECTED' },
    },
    unavailableSources: ['TASKS'],
    ...overrides,
  }
}

export const memberComplete: MemberContribution = {
  studentId: 'c0000000-0000-4000-8000-000000000001',
  displayName: 'Test Member Complete',
  calculated: true,
  snapshot: completeSnapshot(),
}

export const memberPartial: MemberContribution = {
  studentId: 'c0000000-0000-4000-8000-000000000002',
  displayName: 'Test Member Partial',
  calculated: true,
  snapshot: partialSnapshot(),
}

export const memberNotCalculated: MemberContribution = {
  studentId: 'c0000000-0000-4000-8000-000000000003',
  displayName: 'Test Member Waiting',
  calculated: false,
  snapshot: null,
}

export const groupContribution: GroupContribution = {
  scoringConfig: seededConfig,
  members: [memberComplete, memberPartial, memberNotCalculated],
}

export const nothingCalculated: GroupContribution = {
  scoringConfig: seededConfig,
  members: [
    { ...memberComplete, calculated: false, snapshot: null },
    { ...memberPartial, calculated: false, snapshot: null },
  ],
}

export function studentContribution(member: MemberContribution, history: SnapshotView[]): StudentContribution {
  return {
    scoringConfig: seededConfig,
    studentId: member.studentId,
    displayName: member.displayName,
    calculated: history.length > 0,
    latest: history[0] ?? null,
    history,
  }
}

/** Three stored calculations, newest first, as the backend returns them. */
export const threeSnapshots: SnapshotView[] = [
  completeSnapshot({ periodEnd: '2026-09-28', computedAt: '2026-09-29T08:00:00Z', indicator: 71.25 }),
  partialSnapshot({ periodEnd: '2026-09-21', computedAt: '2026-09-22T08:00:00Z', indicator: 55.5 }),
  completeSnapshot({ periodEnd: '2026-09-14', computedAt: '2026-09-15T08:00:00Z', indicator: 40.75 }),
]

export const progressUnavailable: TeamProgress = {
  available: false,
  unavailableReason: 'TASKS_NOT_CONNECTED',
  overall: null,
  members: [],
}

export const progressAvailable: TeamProgress = {
  available: true,
  unavailableReason: null,
  overall: { assigned: 9, completed: 5 },
  members: [
    { studentId: memberComplete.studentId, displayName: memberComplete.displayName, assigned: 6, completed: 5 },
    { studentId: memberPartial.studentId, displayName: memberPartial.displayName, assigned: 3, completed: 0 },
    { studentId: memberNotCalculated.studentId, displayName: memberNotCalculated.displayName, assigned: 0, completed: 0 },
  ],
}
