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

// ---- contribution (ContributionController) ----

export type ContributionCategory = 'DEVELOPMENT' | 'TASK_COMPLETION' | 'COLLABORATION'

/** The five scored metrics. Each belongs to exactly one category. */
export type EvidenceType = 'COMMIT' | 'PULL_REQUEST' | 'COMPLETED_TASK' | 'ISSUE_COMMENT' | 'PULL_REQUEST_REVIEW'

export type PullRequestState = 'MERGED' | 'OPEN' | 'CLOSED_UNMERGED'

export type EvidenceSource = 'GITHUB' | 'TASKS'

export type MetricState = Metric['state']

/** MetricView. `count` and `normalised` are null exactly when the state is UNAVAILABLE. */
export interface MetricView {
  state: MetricState
  count: number | null
  normalised: number | null
  /** A short reason code, for example TASKS_NOT_CONNECTED. */
  reason: string | null
}

/** SourceCoverageView */
export interface SourceCoverage {
  status: 'AVAILABLE' | 'UNAVAILABLE'
  reason: string | null
}

/**
 * SnapshotView: one stored calculation, cumulative from periodStart to
 * periodEnd. A null score means no evidence was available for it.
 */
export interface SnapshotView {
  schemaVersion: number
  scoringConfigVersion: number
  periodStart: string
  periodEnd: string
  computedAt: string
  indicator: number | null
  developmentScore: number | null
  taskScore: number | null
  collaborationScore: number | null
  partial: boolean
  metrics: Record<EvidenceType, MetricView>
  /** Null when pull-request evidence was unavailable. */
  pullRequestStates: Record<PullRequestState, number> | null
  coverage: Record<EvidenceSource, SourceCoverage>
  unavailableSources: EvidenceSource[]
}

/** ScoringConfigView: the weights in use. Never hard-code these in a component. */
export interface ScoringConfigView {
  version: number
  categoryWeights: Record<ContributionCategory, number>
  /** Shares of the whole indicator. */
  metricWeights: Record<EvidenceType, number>
  pullRequestStateMultipliers: Record<PullRequestState, number>
  /** Names of the parts that are research assumptions still to be validated. */
  provisional: string[]
}

/** MemberContributionResponse. `snapshot` is null when nothing has been calculated yet. */
export interface MemberContribution {
  studentId: string
  displayName: string
  calculated: boolean
  snapshot: SnapshotView | null
}

/** GroupContributionResponse */
export interface GroupContribution {
  scoringConfig: ScoringConfigView
  members: MemberContribution[]
}

/** StudentContributionResponse. `history` is newest first and `latest` is its first entry. */
export interface StudentContribution {
  scoringConfig: ScoringConfigView
  studentId: string
  displayName: string
  calculated: boolean
  latest: SnapshotView | null
  history: SnapshotView[]
}

// ---- team progress (ProgressController) ----

/** TeamProgressResponse. When `available` is false there are no figures at all. */
export interface TeamProgress {
  available: boolean
  unavailableReason: string | null
  overall: { assigned: number; completed: number } | null
  members: { studentId: string; displayName: string; assigned: number; completed: number }[]
}
