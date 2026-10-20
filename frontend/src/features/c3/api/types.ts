// Shapes returned by the Component 3 endpoints of the Spring Boot backend.

export type ProjectRole = 'STUDENT' | 'SUPERVISOR' | 'CO_SUPERVISOR' | 'EVALUATOR'

export interface MyProject {
  projectId: string
  projectCode: string
  title: string
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
  roles: ProjectRole[]
}

export interface Person {
  id: string
  name: string
}

// Module 1
export type ConversationKind = 'PROGRESS_UPDATE' | 'QUESTION'

export interface ConversationSummary {
  id: string
  projectId: string
  kind: ConversationKind
  subject: string
  author: Person
  createdAt: string
  replyCount: number
  lastActivityAt: string
}

export interface Reply {
  id: string
  author: Person
  body: string
  createdAt: string
}

export interface ConversationDetail {
  id: string
  projectId: string
  kind: ConversationKind
  subject: string
  body: string
  author: Person
  createdAt: string
  replies: Reply[]
}

// Module 2
export interface Meeting {
  id: string
  projectId: string
  title: string
  scheduledAt: string
  durationMinutes: number | null
  location: string | null
  agenda: string | null
  createdBy: Person
  createdAt: string
  minutes: string | null
  minutesRecordedBy: Person | null
  minutesRecordedAt: string | null
}

// Module 3
export type ResourceType = 'PAPER' | 'LINK' | 'NOTE' | 'DATASET' | 'DOCUMENT'

export interface ResearchResource {
  id: string
  projectId: string
  type: ResourceType
  title: string
  url: string | null
  description: string | null
  addedBy: Person
  createdAt: string
}

// Module 4
export type ActivityType = 'MEETING' | 'CONVERSATION' | 'RESOURCE' | 'OTHER'

export interface Evidence {
  id: string
  projectId: string
  student: Person
  title: string
  description: string | null
  occurredOn: string
  activity: { type: ActivityType; id: string; title: string | null } | null
  verified: boolean
  verifiedBy: Person | null
  verifiedAt: string | null
  createdAt: string
}

// Module 5 (passed through unchanged from the ML service)
export interface RankedCategory {
  rank: number
  category: string
  categoryName: string
  decisionScore: number
}

export interface Prediction {
  category: string
  categoryName: string
  modelVersion: string
  ranking: RankedCategory[]
  scoreNote: string
  recognisedTerms: number
  limitations: string[]
}

export interface TrendPoint {
  year: number
  papers: number
  papersAnyListing: number
  csPapers: number
  shareOfCs: number
  incomplete: boolean
}

export interface TrendCategory {
  code: string
  name: string
  papersBaseYear: number
  papersLastFullYear: number
  growthMultiple: number
  compoundAnnualGrowth: number
  shareOfCsBaseYear: number
  shareOfCsLastFullYear: number
}

export interface Trends {
  basis: string
  source: { dataset: string; datasetSha256: string; records: number; latestSubmission: string; lastFullYear: number }
  indexBaseYear: number
  categories: TrendCategory[]
  series: { category: string; name: string; points: TrendPoint[] }[]
  limitations: string[]
}

export interface Keyword {
  rank: number
  term: string
  label: string
  baseShare: number
  recentShare: number
  changePercentagePoints: number
  growthScore: number
  similarTerms: string[]
  yearly: { year: number; papersWithTerm: number; papers: number; share: number }[]
}

export interface EmergingTopics {
  basis: string
  direction: 'rising' | 'falling'
  measure: string
  basePeriod: number[]
  recentPeriod: number[]
  minimumShare: number
  categories: { code: string; name: string; keywords: Keyword[] }[]
}

export interface ModelEvaluation {
  name: 'random' | 'temporal'
  description: string
  trainSize: number
  testSize: number
  trainYears: number[] | null
  testYears: number[] | null
  models: {
    id: string
    name: string
    accuracy: number
    macroPrecision: number
    macroRecall: number
    macroF1: number
    cvMacroF1Mean: number | null
    cvMacroF1Std: number | null
  }[]
  perCategory: { category: string; name: string; precision: number; recall: number; f1: number; support: number }[]
  svmVsNaiveBayes: {
    onlySvmCorrect: number
    onlyNaiveBayesCorrect: number
    pValue: number
    significantAt005: boolean
  }
}

export interface ModelMetrics {
  modelVersion: string
  trainedAt: string
  algorithm: string
  categories: { code: string; name: string }[]
  trainingData: { source: string; recordsRead: number; sampleSize: number; years: number[]; labelPolicy: string }
  evaluations: ModelEvaluation[]
  modelLoaded: boolean
}
