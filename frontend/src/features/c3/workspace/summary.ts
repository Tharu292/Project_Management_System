import { listConversations, listEvidence, listMeetings, listResources } from '../api/c3Api'
import type { ConversationSummary, Evidence, Meeting, MyProject, ResearchResource } from '../api/types'
import { accessFor } from '../display'
import type { ModuleId } from '../paths'
import type { IconName } from '../ui/Icon'
import type { Tone } from '../ui/styles'

// The Research Dashboard is built only from records the existing endpoints return.
// Every number is a count of current records; nothing is estimated or predicted.

export interface ProjectSummary {
  /** Undefined when the user may not read them (evaluators); those endpoints are not called. */
  conversations?: ConversationSummary[]
  meetings?: Meeting[]
  resources: ResearchResource[]
  evidence: Evidence[]
}

export async function loadProjectSummary(project: MyProject): Promise<ProjectSummary> {
  const { isTeam } = accessFor(project.roles)
  const id = project.projectId
  const [conversations, meetings, resources, evidence] = await Promise.all([
    isTeam ? listConversations(id) : Promise.resolve(undefined),
    isTeam ? listMeetings(id) : Promise.resolve(undefined),
    listResources(id),
    listEvidence(id),
  ])
  return { conversations, meetings, resources, evidence }
}

export interface AttentionItem {
  key: string
  label: string
  value: string
  detail: string
  icon: IconName
  tone: Tone
  module: ModuleId
}

const time = (iso: string) => new Date(iso).getTime()

export function attentionItems(summary: ProjectSummary, project: MyProject, userId: string, now: number): AttentionItem[] {
  const { isStudent, isSupervisor } = accessFor(project.roles)
  const meetings = summary.meetings ?? []
  const upcoming = meetings.filter((m) => time(m.scheduledAt) > now).sort((a, b) => time(a.scheduledAt) - time(b.scheduledAt))
  const minutesPending = meetings.filter((m) => time(m.scheduledAt) <= now && !m.minutes)
  const nextMeeting = upcoming[0]
    ? `Next: ${upcoming[0].title}`
    : 'None scheduled'

  if (isSupervisor) {
    const unverified = summary.evidence.filter((e) => !e.verified)
    const unanswered = (summary.conversations ?? []).filter((c) => c.replyCount === 0)
    return [
      { key: 'verify', label: 'Evidence to verify', value: String(unverified.length),
        detail: `${summary.evidence.length - unverified.length} of ${summary.evidence.length} items verified`,
        icon: 'badgeCheck', tone: unverified.length ? 'amber' : 'green', module: 'evidence' },
      { key: 'reply', label: 'Conversations with no reply yet', value: String(unanswered.length),
        detail: `${summary.conversations?.length ?? 0} conversations in total`, icon: 'chat',
        tone: unanswered.length ? 'amber' : 'green', module: 'collaboration' },
      { key: 'upcoming', label: 'Upcoming meetings', value: String(upcoming.length), detail: nextMeeting,
        icon: 'calendar', tone: 'indigo', module: 'meetings' },
      { key: 'minutes', label: 'Meetings awaiting minutes', value: String(minutesPending.length),
        detail: 'Held meetings without minutes', icon: 'note', tone: minutesPending.length ? 'amber' : 'green',
        module: 'meetings' },
    ]
  }
  if (isStudent) {
    const mine = summary.evidence.filter((e) => e.student.id === userId)
    const mineUnverified = mine.filter((e) => !e.verified)
    const myConversations = (summary.conversations ?? []).filter((c) => c.author.id === userId)
    const myUnanswered = myConversations.filter((c) => c.replyCount === 0)
    return [
      { key: 'awaiting', label: 'Your evidence awaiting verification', value: String(mineUnverified.length),
        detail: `${mine.length - mineUnverified.length} of ${mine.length} of your items verified`, icon: 'hourglass',
        tone: mineUnverified.length ? 'amber' : 'green', module: 'evidence' },
      { key: 'reply', label: 'Your conversations with no reply yet', value: String(myUnanswered.length),
        detail: `${myConversations.length} started by you`, icon: 'chat',
        tone: myUnanswered.length ? 'amber' : 'green', module: 'collaboration' },
      { key: 'upcoming', label: 'Upcoming meetings', value: String(upcoming.length), detail: nextMeeting,
        icon: 'calendar', tone: 'indigo', module: 'meetings' },
      { key: 'minutes', label: 'Meetings awaiting minutes', value: String(minutesPending.length),
        detail: 'Held meetings without minutes', icon: 'note', tone: minutesPending.length ? 'amber' : 'green',
        module: 'meetings' },
    ]
  }
  const verified = summary.evidence.filter((e) => e.verified).length
  return [
    { key: 'evidence', label: 'Verified evidence items', value: `${verified} / ${summary.evidence.length}`,
      detail: 'Verified by the supervisors', icon: 'badgeCheck', tone: 'green', module: 'evidence' },
    { key: 'resources', label: 'Repository resources', value: String(summary.resources.length),
      detail: 'Papers, links, notes, datasets and documents', icon: 'book', tone: 'indigo', module: 'knowledge' },
  ]
}

export interface ActivityItem {
  key: string
  icon: IconName
  tone: Tone
  text: string
  title: string
  at: string
  module: ModuleId
}

export function recentActivity(summary: ProjectSummary, limit = 6): ActivityItem[] {
  const items: ActivityItem[] = []
  for (const c of summary.conversations ?? []) {
    items.push({ key: `c-${c.id}`, icon: 'chat', tone: 'indigo', module: 'collaboration', at: c.lastActivityAt,
      text: c.replyCount ? `${c.replyCount === 1 ? 'Reply' : 'Replies'} in a conversation` : `${c.author.name} started a conversation`,
      title: c.subject })
  }
  for (const m of summary.meetings ?? []) {
    items.push(m.minutes && m.minutesRecordedAt
      ? { key: `m-${m.id}`, icon: 'note', tone: 'green', module: 'meetings', at: m.minutesRecordedAt,
          text: 'Minutes recorded', title: m.title }
      : { key: `m-${m.id}`, icon: 'calendar', tone: 'indigo', module: 'meetings', at: m.createdAt,
          text: 'Meeting scheduled', title: m.title })
  }
  for (const r of summary.resources) {
    items.push({ key: `r-${r.id}`, icon: 'book', tone: 'slate', module: 'knowledge', at: r.createdAt,
      text: `${r.addedBy.name} added a resource`, title: r.title })
  }
  for (const e of summary.evidence) {
    items.push(e.verified && e.verifiedAt
      ? { key: `e-${e.id}`, icon: 'badgeCheck', tone: 'green', module: 'evidence', at: e.verifiedAt,
          text: 'Evidence verified', title: e.title }
      : { key: `e-${e.id}`, icon: 'flag', tone: 'amber', module: 'evidence', at: e.createdAt,
          text: `${e.student.name} submitted evidence`, title: e.title })
  }
  return items.sort((a, b) => time(b.at) - time(a.at)).slice(0, limit)
}

export function moduleCount(summary: ProjectSummary | null, module: ModuleId): string | null {
  if (!summary) return null
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  switch (module) {
    case 'collaboration':
      return summary.conversations ? n(summary.conversations.length, 'conversation', 'conversations') : null
    case 'meetings':
      return summary.meetings ? n(summary.meetings.length, 'meeting', 'meetings') : null
    case 'knowledge':
      return n(summary.resources.length, 'resource', 'resources')
    case 'evidence':
      return n(summary.evidence.length, 'evidence item', 'evidence items')
  }
}
