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

// Research opportunities (passed through unchanged from the ML service)
export interface PaperRef {
  arxivId: string
  title: string
  year: number
  primaryCategory: string
  categoryName: string
  url: string
  rank?: number
  similarity?: number
}

export interface TopicRef {
  topicId: number
  label: string
  topTerms: string[]
  lowerCoherence: boolean
}

export type CoverageAssessment = 'dataset_coverage' | 'limited_evidence' | 'relatively_low' | 'moderate' | 'well_covered'

export interface OpportunityDirection {
  rank: number
  title: string
  topics: TopicRef[]
  summary: string
  coverage: { assessment: CoverageAssessment; note: string }
  evidence: {
    recentPapers: number
    olderPapers: number
    recentShare: number
    olderShare: number
    growthLogRatio: number
    similarPapersCombining: number
    otherCsCategoriesShare: number
    otherCsCategoriesPapers: number
    corpusPapersCombining: number
  }
  score: number
  factors: Record<string, number>
  weights: Record<string, number>
  supportingPapers: PaperRef[]
}

export interface OpportunityAnalysis {
  basis: string
  classification: {
    category: string
    categoryName: string
    modelVersion: string
    ranking: { rank: number; category: string; categoryName: string }[]
  } | null
  similarPapers: PaperRef[]
  recognisedTerms: number
  topicProfile: (TopicRef & { weight: number; ownWeight: number })[]
  directions: OpportunityDirection[]
  insufficientEvidence: { topics: TopicRef[]; recentPapers: number; olderPapers: number }[]
  windows: { older: number[]; recent: number[]; olderPapers: number; recentPapers: number }
  candidatesConsidered: number
  method: Record<string, string>
  limitations: string[]
}

export interface OpportunityEvaluation {
  available: boolean
  retrieval: {
    queries: number
    known_item_search: { recall_at_1: number; recall_at_10: number; mrr: number; task: string }
    category_agreement_at_10: { mean: number; expected_for_random_neighbours: number; note: string }
    index: { papers: number }
  }
  topicModel: {
    chosenK: number
    selectionRule: string
    selection: { k: number; mean_npmi: number; diversity_top25: number }[]
  }
  recommendations: {
    status: string
    groundedness_share_with_3plus_supporting_papers: number
    topic_agreement_share: number
    stability_mean_jaccard_top5_after_dropping_20pct_words: number | null
    temporal_backtest_of_growth_signal: { spearman_rho: number; p_value: number; pairs: number; question: string }
    expert_review: { done: boolean }
  }
}

// Aspect-level gap analysis (abstract-level evidence; passed through unchanged from the ML service)
export type AspectFamily = 'setting' | 'metric' | 'application' | 'dataset'

export interface AspectRef {
  aspectId: string
  family: AspectFamily
  familyLabel: string
  label: string
}

export interface GapPaper extends PaperRef {
  relevanceRank: number
}

export interface AspectCoverage extends AspectRef {
  relevantPapers: number
  relevantTotal: number
  share: number
  interval95: [number, number]
  areaPapers: number
  areaTotal: number
  areaShare: number
  inYourText: boolean
  examplePapers?: GapPaper[]
}

export interface AuthorStatement {
  quote: string
  type: string
  typeLabel: string
  paper: GapPaper
  aspects: AspectRef[]
}

export interface InferredGap extends AspectCoverage {
  rule: 'anchored' | 'area' | 'anchored+area'
  why: string
  pValue?: number
  qValue?: number
  corroboratedByAuthorStatements: boolean
  examplePapers: GapPaper[]
}

export interface DirectGap extends AspectRef {
  paperCount: number
  statements: AuthorStatement[]
  inYourText: boolean
}

export type GapUncertainty = 'corroborated' | 'indicative' | 'exploratory'

/** An evidence-supported potential gap connected to the student's text (never a verified gap). */
export interface PotentialGap {
  heading: string
  aspect: AspectRef | null
  signals: ('author_statements' | 'low_coverage')[]
  uncertainty: GapUncertainty
  uncertaintyLabel: string
  explanation: string
  notes: string[]
  paperCount: number
  statementCount: number
  latestYear: number | null
  closestRank: number | null
  sharedTerms: string[]
  statements: Omit<AuthorStatement, 'aspects'>[]
  coverage: { relevantPapers: number; relevantTotal: number; share: number; interval95: [number, number]; examplePapers: GapPaper[] } | null
}

export interface GapAnalysis {
  evidenceLevel: 'abstract'
  basis: string
  relevantPapers: GapPaper[]
  relevantTotal: number
  recognisedTerms: number
  wideArea: { topics: { topicId: number; label: string }[]; papers: number }
  yourAspects: AspectRef[]
  wellCovered: AspectCoverage[]
  methodTerms: { term: string; relevantPapers: number; relevantTotal: number; interval95: [number, number]; fewMentions: boolean }[]
  authorStatements: Record<string, AuthorStatement[]>
  potentialGaps: PotentialGap[]
  potentialGapsScreening: {
    statementsConsidered: number
    candidates: number
    shown: number
    excluded: {
      limitationOfPriorWorkOrAddressedByThePaper: number
      limitationWithUnclearOwner: number
      notConnectedToYourText: number
      rarerThanTheWiderAreaOnly: number
    }
  }
  uncertaintyLabels: { level: GapUncertainty; label: string; rule: string }[]
  directlySupportedGaps: DirectGap[]
  inferredGaps: InferredGap[]
  method: Record<string, string>
  limitations: string[]
}

export interface GapEvaluation {
  available: boolean
  evidenceLevel: 'abstract'
  evidenceStore: {
    papers: number
    aspects: { total: number; curated: number; datasets: number }
    statements: { total: number; verified_exact_substrings: number; by_type: Record<string, number> }
  }
  manualReview: { labelled: boolean; status: string; sheets?: Record<string, number> }
}
