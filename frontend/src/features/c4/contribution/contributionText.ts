import type {
  ContributionCategory,
  EvidenceSource,
  EvidenceType,
  Metric,
  MetricView,
  PullRequestState,
  SnapshotView,
} from '../api/types'

// Words for what the backend sends. This file holds names and structure only:
// every weight, multiplier and score shown on screen comes from a response.

export const CATEGORY_LABELS: Record<ContributionCategory, string> = {
  DEVELOPMENT: 'Development',
  TASK_COMPLETION: 'Task completion',
  COLLABORATION: 'Collaboration',
}

export const CATEGORY_ORDER: ContributionCategory[] = ['DEVELOPMENT', 'TASK_COMPLETION', 'COLLABORATION']

export const METRIC_LABELS: Record<EvidenceType, string> = {
  COMMIT: 'Commits',
  PULL_REQUEST: 'Pull requests',
  COMPLETED_TASK: 'Completed assigned tasks',
  ISSUE_COMMENT: 'Issue comments',
  PULL_REQUEST_REVIEW: 'Pull-request reviews',
}

/** Which category each metric belongs to, and the order metrics are listed in. */
export const METRICS_BY_CATEGORY: Record<ContributionCategory, EvidenceType[]> = {
  DEVELOPMENT: ['COMMIT', 'PULL_REQUEST'],
  TASK_COMPLETION: ['COMPLETED_TASK'],
  COLLABORATION: ['ISSUE_COMMENT', 'PULL_REQUEST_REVIEW'],
}

export const PULL_REQUEST_STATE_LABELS: Record<PullRequestState, string> = {
  MERGED: 'Merged',
  OPEN: 'Open',
  CLOSED_UNMERGED: 'Closed without merging',
}

export const PULL_REQUEST_STATE_ORDER: PullRequestState[] = ['MERGED', 'OPEN', 'CLOSED_UNMERGED']

export const SOURCE_LABELS: Record<EvidenceSource, string> = {
  GITHUB: 'GitHub',
  TASKS: 'Task management',
}

const REASON_TEXT: Record<string, string> = {
  TASKS_NOT_CONNECTED: 'Task data is not connected yet.',
  TASKS_UNAVAILABLE: 'Task data could not be read.',
  GITHUB_UNREACHABLE: 'GitHub could not be reached.',
  NO_REPOSITORY_LINKED: 'No repository is linked to this group.',
  NO_GITHUB_USERNAME: 'No GitHub username is registered for this student.',
}

/** A sentence for a reason code. An unknown code gets a neutral sentence, never the raw code alone. */
export function reasonText(reason: string | null | undefined): string {
  if (!reason) {
    return 'This evidence could not be collected.'
  }
  return REASON_TEXT[reason] ?? `This evidence could not be collected (${reason}).`
}

export function toMetric(view: MetricView): Metric {
  if (view.state === 'UNAVAILABLE' || view.count === null) {
    return { state: 'UNAVAILABLE', reason: reasonText(view.reason) }
  }
  return view.state === 'VERIFIED_ZERO' ? { state: 'VERIFIED_ZERO' } : { state: 'VALUE', value: view.count }
}

/** A weight or multiplier between 0 and 1, as a percentage. */
export function percent(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`
}

/** A score on the 0 to 100 scale, to one decimal place. */
export function formatScore(score: number): string {
  return score.toFixed(1)
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function categoryScore(snapshot: SnapshotView, category: ContributionCategory): number | null {
  if (category === 'DEVELOPMENT') return snapshot.developmentScore
  if (category === 'TASK_COMPLETION') return snapshot.taskScore
  return snapshot.collaborationScore
}

export function unavailableSourceNames(snapshot: SnapshotView): string[] {
  return snapshot.unavailableSources.map((source) => SOURCE_LABELS[source])
}

export const NOT_CALCULATED = 'Not calculated yet'
export const EVIDENCE_UNAVAILABLE = 'Evidence unavailable'
