import { apiRequest } from '../../../api/client'
import type {
  ActivityType,
  ConversationDetail,
  ConversationKind,
  ConversationSummary,
  EmergingTopics,
  Evidence,
  Meeting,
  ModelMetrics,
  MyProject,
  Prediction,
  Reply,
  ResearchResource,
  ResourceType,
  Trends,
} from './types'

// Every call goes through the shared client with the signed-in user's token.
// The backend decides what each user may see and do; the UI only mirrors it.

const C3 = '/api/v1/c3'
const auth = { auth: true } as const

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(name, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const getMyProjects = () => apiRequest<MyProject[]>(`${C3}/me/projects`, auth)

// Module 1
export const listConversations = (projectId: string) =>
  apiRequest<ConversationSummary[]>(`${C3}/projects/${projectId}/conversations`, auth)
export const createConversation = (projectId: string, body: { kind: ConversationKind; subject: string; body: string }) =>
  apiRequest<ConversationDetail>(`${C3}/projects/${projectId}/conversations`, { ...auth, method: 'POST', body })
export const getConversation = (conversationId: string) =>
  apiRequest<ConversationDetail>(`${C3}/conversations/${conversationId}`, auth)
export const replyToConversation = (conversationId: string, body: string) =>
  apiRequest<Reply>(`${C3}/conversations/${conversationId}/replies`, { ...auth, method: 'POST', body: { body } })

// Module 2
export const listMeetings = (projectId: string) => apiRequest<Meeting[]>(`${C3}/projects/${projectId}/meetings`, auth)
export const createMeeting = (
  projectId: string,
  body: { title: string; scheduledAt: string; durationMinutes?: number; location?: string; agenda?: string },
) => apiRequest<Meeting>(`${C3}/projects/${projectId}/meetings`, { ...auth, method: 'POST', body })
export const recordMinutes = (meetingId: string, minutes: string) =>
  apiRequest<Meeting>(`${C3}/meetings/${meetingId}/minutes`, { ...auth, method: 'PUT', body: { minutes } })

// Module 3
export const listResources = (projectId: string, q?: string, type?: ResourceType) =>
  apiRequest<ResearchResource[]>(`${C3}/projects/${projectId}/resources${query({ q, type })}`, auth)
export const createResource = (
  projectId: string,
  body: { type: ResourceType; title: string; url?: string; description?: string },
) => apiRequest<ResearchResource>(`${C3}/projects/${projectId}/resources`, { ...auth, method: 'POST', body })

// Module 4
export const listEvidence = (projectId: string) => apiRequest<Evidence[]>(`${C3}/projects/${projectId}/evidence`, auth)
export const createEvidence = (
  projectId: string,
  body: { title: string; description?: string; occurredOn: string; activityType: ActivityType; activityId?: string },
) => apiRequest<Evidence>(`${C3}/projects/${projectId}/evidence`, { ...auth, method: 'POST', body })
export const verifyEvidence = (evidenceId: string) =>
  apiRequest<Evidence>(`${C3}/evidence/${evidenceId}/verify`, { ...auth, method: 'POST' })

// Module 5
const RESEARCH = `${C3}/research`
export const predictTopic = (title: string, abstract: string) =>
  apiRequest<Prediction>(`${RESEARCH}/predict`, { ...auth, method: 'POST', body: { title, abstract } })
export const getTrends = () => apiRequest<Trends>(`${RESEARCH}/trends`, auth)
export const getEmergingTopics = () => apiRequest<EmergingTopics>(`${RESEARCH}/emerging-topics`, auth)
export const getModelMetrics = () => apiRequest<ModelMetrics>(`${RESEARCH}/model/metrics`, auth)
