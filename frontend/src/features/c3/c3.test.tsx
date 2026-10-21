import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ME, renderSignedInAt } from '../../test/appHarness'
import { admin, apiError, json, mockBackend, staff, student } from '../../test/mockBackend'
import type {
  ConversationDetail,
  EmergingTopics,
  Evidence,
  Meeting,
  ModelMetrics,
  MyProject,
  Prediction,
  ResearchResource,
  Trends,
} from './api/types'

// Hand-written responses with the shapes the backend returns. They test the pages, not the data.

const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const C3 = '/api/v1/c3'
const MY_PROJECTS = `GET ${C3}/me/projects`
const person = (id: string, name: string) => ({ id, name })
const STUDENT = person(student.id, 'Test Student')
const SUPERVISOR = person(staff.id, 'Test Lecturer')

const project = (roles: MyProject['roles']): MyProject => ({
  projectId: PROJECT_ID,
  projectCode: 'PRJ-001',
  title: 'Undergraduate project ecosystem',
  status: 'ACTIVE',
  roles,
})

const page = (module: string) => `/research/projects/${PROJECT_ID}/${module}`

/** The four lists the Research Dashboard reads; empty unless a test passes data. */
function summaryRoutes(data: { conversations?: unknown[]; meetings?: unknown[]; resources?: unknown[]; evidence?: unknown[] } = {}) {
  return {
    [`GET ${C3}/projects/${PROJECT_ID}/conversations`]: () => json(200, data.conversations ?? []),
    [`GET ${C3}/projects/${PROJECT_ID}/meetings`]: () => json(200, data.meetings ?? []),
    [`GET ${C3}/projects/${PROJECT_ID}/resources`]: () => json(200, data.resources ?? []),
    [`GET ${C3}/projects/${PROJECT_ID}/evidence`]: () => json(200, data.evidence ?? []),
  }
}

describe('navigation and workspace', () => {
  it('shows the main menu and all five module cards to a student', async () => {
    mockBackend({ [ME]: () => json(200, student), [MY_PROJECTS]: () => json(200, [project(['STUDENT'])]), ...summaryRoutes() })
    renderSignedInAt('/research')

    const menu = within(await screen.findByRole('navigation', { name: 'Main' }))
    expect(menu.getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Dashboard',
      'Research Workspace',
      'Research Intelligence',
    ])
    expect(await screen.findByLabelText('Project')).toBeDefined()
    for (const title of [
      'Supervisor–Student Collaboration',
      'Integrated Meeting Workspace',
      'Project Knowledge Repository',
      'Evidence-Based Assessment Portfolio',
    ]) {
      expect(screen.getByRole('link', { name: new RegExp(title) }).getAttribute('href')).toContain(PROJECT_ID)
    }
    expect(screen.getByRole('link', { name: /Module 5\s*Research Intelligence/ }).getAttribute('href')).toBe(
      '/research-intelligence',
    )
  })

  it('closes collaboration and meetings to an evaluator but keeps knowledge and evidence open', async () => {
    mockBackend({ [ME]: () => json(200, staff), [MY_PROJECTS]: () => json(200, [project(['EVALUATOR'])]), ...summaryRoutes() })
    renderSignedInAt('/research')

    await screen.findByLabelText('Project')
    expect(screen.queryByRole('link', { name: /Supervisor–Student Collaboration/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Integrated Meeting Workspace/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Project Knowledge Repository/ })).toBeDefined()
    expect(screen.getByRole('link', { name: /Evidence-Based Assessment Portfolio/ })).toBeDefined()
  })

  it('explains that modules 1-4 need a project, and keeps research intelligence open', async () => {
    mockBackend({ [ME]: () => json(200, student), [MY_PROJECTS]: () => json(200, []) })
    renderSignedInAt('/research')

    expect(await screen.findByText(/not a member of any research project yet/)).toBeDefined()
    expect(screen.queryByRole('link', { name: /Project Knowledge Repository/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Module 5\s*Research Intelligence/ })).toBeDefined()
  })

  it('keeps the administration menu for administrators', async () => {
    mockBackend({ [ME]: () => json(200, admin), [MY_PROJECTS]: () => json(200, []) })
    renderSignedInAt('/research')

    expect(await screen.findByRole('navigation', { name: 'Administration' })).toBeDefined()
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
  })
})

describe('module 1: collaboration', () => {
  it('lets a student post a question and opens its thread', async () => {
    const created: ConversationDetail = {
      id: 'c1',
      projectId: PROJECT_ID,
      kind: 'QUESTION',
      subject: 'Dataset choice',
      body: 'Which snapshot?',
      author: STUDENT,
      createdAt: '2026-10-20T09:00:00Z',
      replies: [],
    }
    let list: unknown[] = []
    const backend = mockBackend({
      [ME]: () => json(200, student),
      [MY_PROJECTS]: () => json(200, [project(['STUDENT'])]),
      [`GET ${C3}/projects/${PROJECT_ID}/conversations`]: () => json(200, list),
      [`POST ${C3}/projects/${PROJECT_ID}/conversations`]: () => {
        list = [{ ...created, replyCount: 0, lastActivityAt: created.createdAt }]
        return json(201, created)
      },
      [`GET ${C3}/conversations/c1`]: () => json(200, created),
    })
    const user = userEvent.setup()
    renderSignedInAt(page('collaboration'))

    await screen.findByText('No conversations yet.')
    await user.selectOptions(screen.getByLabelText('Type'), 'QUESTION')
    await user.type(screen.getByLabelText('Subject'), 'Dataset choice')
    await user.type(screen.getByLabelText('Message'), 'Which snapshot?')
    await user.click(screen.getByRole('button', { name: 'Post' }))

    expect(backend.callsTo(`POST ${C3}/projects/${PROJECT_ID}/conversations`)[0].body).toEqual({
      kind: 'QUESTION',
      subject: 'Dataset choice',
      body: 'Which snapshot?',
    })
    expect(await screen.findByRole('article', { name: 'Conversation: Dataset choice' })).toBeDefined()
    expect(within(await screen.findByRole('list', { name: 'Conversations' })).getByText('Dataset choice')).toBeDefined()
  })

  it('lets a supervisor reply, and offers no new-conversation form', async () => {
    const conversation: ConversationDetail = {
      id: 'c1',
      projectId: PROJECT_ID,
      kind: 'PROGRESS_UPDATE',
      subject: 'Week 3',
      body: 'Finished the data preparation.',
      author: STUDENT,
      createdAt: '2026-10-20T09:00:00Z',
      replies: [],
    }
    const backend = mockBackend({
      [ME]: () => json(200, staff),
      [MY_PROJECTS]: () => json(200, [project(['SUPERVISOR'])]),
      [`GET ${C3}/projects/${PROJECT_ID}/conversations`]: () =>
        json(200, [{ ...conversation, replyCount: 0, lastActivityAt: conversation.createdAt }]),
      [`GET ${C3}/conversations/c1`]: () => json(200, conversation),
      [`POST ${C3}/conversations/c1/replies`]: () => {
        conversation.replies = [{ id: 'r1', author: SUPERVISOR, body: 'Well done.', createdAt: '2026-10-20T10:00:00Z' }]
        return json(201, conversation.replies[0])
      },
    })
    const user = userEvent.setup()
    renderSignedInAt(page('collaboration'))

    await user.click(await screen.findByRole('button', { name: /Week 3/ }))
    expect(screen.queryByRole('form', { name: 'New progress update or question' })).toBeNull()
    await user.type(await screen.findByLabelText('Your reply'), 'Well done.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(backend.callsTo(`POST ${C3}/conversations/c1/replies`)[0].body).toEqual({ body: 'Well done.' })
    expect(await within(screen.getByRole('list', { name: 'Replies' })).findByText('Well done.')).toBeDefined()
  })
})

describe('module 2: meetings', () => {
  it('schedules a meeting and records minutes for one that has started', async () => {
    const past: Meeting = {
      id: 'm1',
      projectId: PROJECT_ID,
      title: 'Kick-off',
      scheduledAt: '2026-10-01T09:00:00Z',
      durationMinutes: 30,
      location: 'https://meet.example/abc',
      agenda: 'Scope',
      createdBy: STUDENT,
      createdAt: '2026-09-30T09:00:00Z',
      minutes: null,
      minutesRecordedBy: null,
      minutesRecordedAt: null,
    }
    const backend = mockBackend({
      [ME]: () => json(200, student),
      [MY_PROJECTS]: () => json(200, [project(['STUDENT'])]),
      [`GET ${C3}/projects/${PROJECT_ID}/meetings`]: () => json(200, [past]),
      [`POST ${C3}/projects/${PROJECT_ID}/meetings`]: () => json(201, past),
      [`PUT ${C3}/meetings/m1/minutes`]: () => {
        past.minutes = 'Agreed the scope.'
        past.minutesRecordedBy = STUDENT
        past.minutesRecordedAt = '2026-10-01T10:00:00Z'
        return json(200, past)
      },
    })
    const user = userEvent.setup()
    renderSignedInAt(page('meetings'))

    await screen.findByText('Kick-off')
    // The form is in a collapsible panel once the project has meetings.
    await user.click(screen.getByRole('button', { name: 'Schedule a meeting' }))
    await user.type(screen.getByLabelText('Title'), 'Progress review')
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-11-02T10:00' } })
    await user.type(screen.getByLabelText('Location or meeting link'), 'Lab 3')
    await user.click(screen.getByRole('button', { name: 'Schedule meeting' }))
    const sent = backend.callsTo(`POST ${C3}/projects/${PROJECT_ID}/meetings`)[0].body as Record<string, unknown>
    expect(sent.title).toBe('Progress review')
    expect(sent.scheduledAt).toBe(new Date('2026-11-02T10:00').toISOString())
    expect(sent.location).toBe('Lab 3')

    await user.click(screen.getByRole('button', { name: 'Record minutes' }))
    await user.type(screen.getByLabelText('Minutes'), 'Agreed the scope.')
    await user.click(screen.getByRole('button', { name: 'Save minutes' }))
    expect(backend.callsTo(`PUT ${C3}/meetings/m1/minutes`)[0].body).toEqual({ minutes: 'Agreed the scope.' })
    expect(await screen.findByText('Agreed the scope.')).toBeDefined()
    expect(screen.getByText('Minutes recorded')).toBeDefined()
  })
})

describe('module 3: knowledge repository', () => {
  const paper: ResearchResource = {
    id: 'k1',
    projectId: PROJECT_ID,
    type: 'PAPER',
    title: 'Attention Is All You Need',
    url: 'https://arxiv.org/abs/1706.03762',
    description: null,
    addedBy: STUDENT,
    createdAt: '2026-10-20T09:00:00Z',
  }

  it('adds a resource and searches the repository', async () => {
    let resources: ResearchResource[] = []
    const backend = mockBackend({
      [ME]: () => json(200, student),
      [MY_PROJECTS]: () => json(200, [project(['STUDENT'])]),
      [`GET ${C3}/projects/${PROJECT_ID}/resources`]: () => json(200, resources),
      [`POST ${C3}/projects/${PROJECT_ID}/resources`]: () => {
        resources = [paper]
        return json(201, paper)
      },
    })
    const user = userEvent.setup()
    renderSignedInAt(page('knowledge'))

    await screen.findByText('No resources yet.')
    await user.type(screen.getByLabelText('Title'), paper.title)
    await user.type(screen.getByLabelText('Web address'), paper.url ?? '')
    await user.click(screen.getByRole('button', { name: 'Add resource' }))
    expect(backend.callsTo(`POST ${C3}/projects/${PROJECT_ID}/resources`)[0].body).toEqual({
      type: 'PAPER',
      title: paper.title,
      url: paper.url,
    })
    expect(await screen.findByRole('link', { name: paper.url ?? '' })).toBeDefined()

    const before = backend.callsTo(`GET ${C3}/projects/${PROJECT_ID}/resources`).length
    await user.type(screen.getByLabelText('Search'), 'attention')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(backend.callsTo(`GET ${C3}/projects/${PROJECT_ID}/resources`).length).toBe(before + 1))
  })

  it('shows field errors from the backend', async () => {
    mockBackend({
      [ME]: () => json(200, student),
      [MY_PROJECTS]: () => json(200, [project(['STUDENT'])]),
      [`GET ${C3}/projects/${PROJECT_ID}/resources`]: () => json(200, []),
      [`POST ${C3}/projects/${PROJECT_ID}/resources`]: () =>
        apiError(400, 'Validation failed.', { url: 'Enter a web address starting with http:// or https://.' }),
    })
    const user = userEvent.setup()
    renderSignedInAt(page('knowledge'))

    await user.type(await screen.findByLabelText('Title'), 'Bad link')
    await user.click(screen.getByRole('button', { name: 'Add resource' }))
    expect(await screen.findByText('Enter a web address starting with http:// or https://.')).toBeDefined()
  })
})

describe('module 4: evidence portfolio', () => {
  const meeting = { id: 'm1', title: 'Design review', scheduledAt: '2026-10-10T09:00:00Z' }
  const evidence = (verified: boolean): Evidence => ({
    id: 'e1',
    projectId: PROJECT_ID,
    student: STUDENT,
    title: 'Presented the design',
    description: 'Slides and demo',
    occurredOn: '2026-10-10',
    activity: { type: 'MEETING', id: 'm1', title: 'Design review' },
    verified,
    verifiedBy: verified ? SUPERVISOR : null,
    verifiedAt: verified ? '2026-10-11T09:00:00Z' : null,
    createdAt: '2026-10-10T12:00:00Z',
  })

  it('lets a student add evidence linked to a meeting, without a verify button', async () => {
    let items: Evidence[] = []
    const backend = mockBackend({
      [ME]: () => json(200, student),
      [MY_PROJECTS]: () => json(200, [project(['STUDENT'])]),
      [`GET ${C3}/projects/${PROJECT_ID}/evidence`]: () => json(200, items),
      [`GET ${C3}/projects/${PROJECT_ID}/meetings`]: () => json(200, [meeting]),
      [`POST ${C3}/projects/${PROJECT_ID}/evidence`]: () => {
        items = [evidence(false)]
        return json(201, items[0])
      },
    })
    const user = userEvent.setup()
    renderSignedInAt(page('evidence'))

    await screen.findByText('No evidence yet.')
    await user.type(screen.getByLabelText('Title'), 'Presented the design')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-10' } })
    await user.selectOptions(screen.getByLabelText('Linked activity'), 'MEETING')
    await user.selectOptions(await screen.findByLabelText('Meeting'), 'm1')
    await user.click(screen.getByRole('button', { name: 'Add evidence' }))

    expect(backend.callsTo(`POST ${C3}/projects/${PROJECT_ID}/evidence`)[0].body).toEqual({
      title: 'Presented the design',
      occurredOn: '2026-10-10',
      activityType: 'MEETING',
      activityId: 'm1',
    })
    const timeline = await screen.findByRole('list', { name: 'Evidence timeline' })
    expect(within(timeline).getByText('Awaiting verification')).toBeDefined()
    expect(within(timeline).queryByRole('button', { name: /Verify/ })).toBeNull()
    expect(screen.getByText(/Marks and grades are not given here/)).toBeDefined()
  })

  it('lets a supervisor verify evidence', async () => {
    let item = evidence(false)
    const backend = mockBackend({
      [ME]: () => json(200, staff),
      [MY_PROJECTS]: () => json(200, [project(['SUPERVISOR'])]),
      [`GET ${C3}/projects/${PROJECT_ID}/evidence`]: () => json(200, [item]),
      [`POST ${C3}/evidence/e1/verify`]: () => {
        item = evidence(true)
        return json(200, item)
      },
    })
    const user = userEvent.setup()
    renderSignedInAt(page('evidence'))

    expect(screen.queryByRole('form', { name: 'Add evidence' })).toBeNull()
    await user.click(await screen.findByRole('button', { name: 'Verify evidence: Presented the design' }))
    expect(backend.callsTo(`POST ${C3}/evidence/e1/verify`)).toHaveLength(1)
    expect(await screen.findByText(/Verified by Test Lecturer/)).toBeDefined()
  })
})

const gapEvaluation = {
  available: true,
  evidenceLevel: 'abstract',
  evidenceStore: {
    papers: 334582,
    aspects: { total: 1286, curated: 71, datasets: 1215 },
    statements: { total: 90000, verified_exact_substrings: 90000, by_type: { future_work: 9000 } },
  },
  manualReview: { labelled: false, status: 'No manual labels yet: extraction precision, recall and gap-identification accuracy are NOT measured.' },
}

const opportunityEvaluation = {
  available: true,
  retrieval: {
    queries: 1000,
    known_item_search: { recall_at_1: 0.922, recall_at_10: 0.989, mrr: 0.9476, task: 'title only' },
    category_agreement_at_10: { mean: 0.8622, expected_for_random_neighbours: 0.3291, note: 'proxy' },
    index: { papers: 334582 },
  },
  topicModel: { chosenK: 30, selectionRule: 'highest mean NPMI', selection: [{ k: 30, mean_npmi: 0.1988, diversity_top25: 0.796 }] },
  recommendations: {
    status: 'No expert ratings yet: recommendation accuracy is NOT measured.',
    groundedness_share_with_3plus_supporting_papers: 1,
    topic_agreement_share: 0.792,
    stability_mean_jaccard_top5_after_dropping_20pct_words: 0.763,
    temporal_backtest_of_growth_signal: { spearman_rho: 0.2305, p_value: 0.0002, pairs: 255, question: 'q' },
    expert_review: { done: false },
  },
}

describe('module 5: research intelligence', () => {
  const prediction: Prediction = {
    category: 'cs.RO',
    categoryName: 'Robotics',
    modelVersion: 'svm_tfidf_v1',
    ranking: [
      { rank: 1, category: 'cs.RO', categoryName: 'Robotics', decisionScore: 1.8152 },
      { rank: 2, category: 'cs.CL', categoryName: 'Computation & Language (NLP)', decisionScore: -1.2374 },
      { rank: 3, category: 'cs.CR', categoryName: 'Cryptography & Security', decisionScore: -1.2697 },
      { rank: 4, category: 'cs.DB', categoryName: 'Databases', decisionScore: -1.3772 },
      { rank: 5, category: 'cs.CV', categoryName: 'Computer Vision', decisionScore: -1.7359 },
    ],
    scoreNote: 'Decision scores are not probabilities.',
    recognisedTerms: 46,
    limitations: ["Chooses between 5 arXiv categories only. It has no 'other' category."],
  }
  const point = (year: number, papers: number, incomplete = false) => ({
    year,
    papers,
    papersAnyListing: papers,
    csPapers: papers * 10,
    shareOfCs: 0.1,
    incomplete,
  })
  const trends: Trends = {
    basis: 'Historical publication counts. Descriptive only: this is not a forecast.',
    source: { dataset: 'arXiv', datasetSha256: 'abc', records: 10, latestSubmission: '2026-10-15', lastFullYear: 2025 },
    indexBaseYear: 2024,
    categories: [
      {
        code: 'cs.RO',
        name: 'Robotics',
        papersBaseYear: 100,
        papersLastFullYear: 150,
        growthMultiple: 1.5,
        compoundAnnualGrowth: 0.5,
        shareOfCsBaseYear: 0.1,
        shareOfCsLastFullYear: 0.1,
      },
    ],
    series: [{ category: 'cs.RO', name: 'Robotics', points: [point(2024, 100), point(2025, 150), point(2026, 999, true)] }],
    limitations: [],
  }
  const topics: EmergingTopics = {
    basis: 'Historically rising keywords. Not a forecast.',
    direction: 'rising',
    measure: 'share of papers',
    basePeriod: [2018, 2019],
    recentPeriod: [2024, 2025],
    minimumShare: 0.02,
    categories: [
      { code: 'cs.RO', name: 'Robotics', keywords: [keyword('large language models')] },
      { code: 'cs.DB', name: 'Databases', keywords: [keyword('text-to-sql')] },
    ],
  }
  function keyword(label: string) {
    return {
      rank: 1,
      term: label,
      label,
      baseShare: 0.001,
      recentShare: 0.05,
      changePercentagePoints: 4.9,
      growthScore: 3,
      similarTerms: [],
      yearly: [{ year: 2025, papersWithTerm: 5, papers: 100, share: 0.05 }],
    }
  }
  const evaluation = (name: 'random' | 'temporal', f1: number, significant: boolean) => ({
    name,
    description: '',
    trainSize: 8000,
    testSize: 2000,
    trainYears: name === 'temporal' ? [2018, 2022] : null,
    testYears: name === 'temporal' ? [2023, 2024] : null,
    models: [
      { id: 'linear_svm', name: 'TF-IDF + Linear SVM', accuracy: f1, macroPrecision: f1, macroRecall: f1, macroF1: f1, cvMacroF1Mean: 0.9, cvMacroF1Std: 0.01 },
    ],
    perCategory: [{ category: 'cs.RO', name: 'Robotics', precision: 0.9, recall: 0.9, f1: 0.95, support: 400 }],
    svmVsNaiveBayes: { onlySvmCorrect: 79, onlyNaiveBayesCorrect: 39, pValue: significant ? 0.0003 : 0.358, significantAt005: significant },
  })
  const metrics: ModelMetrics = {
    modelVersion: 'svm_tfidf_v1',
    trainedAt: '2026-10-19',
    algorithm: 'TF-IDF + LinearSVC',
    categories: [],
    trainingData: { source: 'arXiv', recordsRead: 1, sampleSize: 10000, years: [2018, 2024], labelPolicy: 'Primary category.' },
    evaluations: [evaluation('random', 0.9371, false), evaluation('temporal', 0.9285, true)],
    modelLoaded: true,
  }
  const RESEARCH = `${C3}/research`
  const routes = (predict: () => Response) => ({
    [ME]: () => json(200, student),
    [`POST ${RESEARCH}/predict`]: predict,
    [`GET ${RESEARCH}/trends`]: () => json(200, trends),
    [`GET ${RESEARCH}/emerging-topics`]: () => json(200, topics),
    [`GET ${RESEARCH}/model/metrics`]: () => json(200, metrics),
    [`GET ${RESEARCH}/opportunities/evaluation`]: () => json(200, opportunityEvaluation),
    [`GET ${RESEARCH}/gap-analysis/evaluation`]: () => json(200, gapEvaluation),
  })
  const ABSTRACT = 'We present a controller that lets a legged robot plan footsteps. '.repeat(4)

  async function classify(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText('Title'), 'Footstep planning')
    fireEvent.change(screen.getByLabelText('Abstract'), { target: { value: ABSTRACT } })
    await user.click(screen.getByRole('button', { name: 'Classify' }))
  }

  it('classifies a paper and shows the ranking and limitations, never a percentage', async () => {
    const backend = mockBackend(routes(() => json(200, prediction)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await classify(user)
    expect(backend.callsTo(`POST ${RESEARCH}/predict`)[0].body).toEqual({ title: 'Footstep planning', abstract: ABSTRACT })
    const result = await screen.findByRole('region', { name: 'Classification result' })
    expect(within(result).getByText('Robotics')).toBeDefined()
    expect(within(result).getAllByRole('listitem')[0].textContent).toBe('Computation & Language (NLP) (cs.CL)')
    expect(within(result).getByText(/no 'other' category/)).toBeDefined()
    expect(result.textContent).not.toMatch(/%|1\.8152|probability of/i)
  })

  it('shows the backend message when the classifier is unavailable, and field errors on the form', async () => {
    let answer = apiError(503, 'The topic classifier is not available.')
    mockBackend(routes(() => answer))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await classify(user)
    // The shared client never shows a 5xx body; a 503 gets a fixed, clear message instead.
    expect(await screen.findByText('This service is not available right now. Please try again later.')).toBeDefined()
    answer = apiError(400, 'The request was not valid.', { abstract: 'The abstract must have at least 30 words (it has 2).' })
    await user.click(screen.getByRole('button', { name: 'Classify' }))
    expect(await screen.findByText('The abstract must have at least 30 words (it has 2).')).toBeDefined()
  })

  it('shows historical trends without the incomplete year, with a table view', async () => {
    mockBackend(routes(() => json(200, prediction)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    expect(await screen.findByRole('img', { name: /Papers per year by arXiv category, 2024–2025/ })).toBeDefined()
    expect(screen.getByText(/2026 is incomplete and not shown/)).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Show table' }))
    const table = screen.getByRole('table', { name: /Papers per year by category/ })
    expect(within(table).getByText('150')).toBeDefined()
    expect(within(table).queryByText('999')).toBeNull()
    expect(screen.getByText('×1.5')).toBeDefined()
  })

  it('lists rising keywords per category and the evaluation results', async () => {
    mockBackend(routes(() => json(200, prediction)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    const keywords = await screen.findByRole('list', { name: 'Rising keywords in cs.RO' })
    expect(within(keywords).getByText('large language models')).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'cs.DB Databases' }))
    expect(within(screen.getByRole('list', { name: 'Rising keywords in cs.DB' })).getByText('text-to-sql')).toBeDefined()
    expect(screen.getByText(/Not a forecast/)).toBeDefined()

    expect((await screen.findAllByText('0.9371')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('0.9285').length).toBeGreaterThan(0)
    expect(screen.getByText(/not a statistically significant difference \(McNemar test, p = 0\.358\)/)).toBeDefined()
    expect(screen.getByText(/a statistically significant difference \(McNemar test, p < 0\.001\)/)).toBeDefined()
  })

  it('shows measured headline scores, highlightable trends and the evaluation charts', async () => {
    mockBackend(routes(() => json(200, prediction)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    // Headline numbers are the measured scores from the evaluation reports.
    const random = (await screen.findByText('Macro-F1, random test split')).parentElement as HTMLElement
    expect(within(random).getByText('0.9371')).toBeDefined()
    const newer = screen.getByText('Macro-F1 on newer papers').parentElement as HTMLElement
    expect(within(newer).getByText('0.9285')).toBeDefined()
    expect(screen.getByText('Model svm_tfidf_v1')).toBeDefined()

    const legend = within(await screen.findByRole('list', { name: 'Areas in the chart' }))
    const robotics = legend.getByRole('button', { name: 'cs.RO Robotics' })
    expect(robotics.getAttribute('aria-pressed')).toBe('false')
    await user.click(robotics)
    expect(robotics.getAttribute('aria-pressed')).toBe('true')

    expect(screen.getByRole('figure', { name: /Growth of papers per year from 2024 to 2025/ })).toBeDefined()
    expect(screen.getByRole('figure', { name: 'Macro-F1 of each model on the two test sets' })).toBeDefined()
    expect(screen.getByRole('figure', { name: 'F1 of the Linear SVM for each research area' })).toBeDefined()
    await user.click(screen.getByText('Show all numbers'))
    expect(screen.getByRole('table', { name: /Accuracy and macro-F1 of every model/ })).toBeDefined()
  })
})

describe('research dashboard (redesign)', () => {
  const OTHER = person('99999999-0000-0000-0000-000000000009', 'Other Student')
  const conversation = (id: string, author: typeof STUDENT, replyCount: number) => ({
    id, projectId: PROJECT_ID, kind: 'QUESTION', subject: `Subject ${id}`, author,
    createdAt: '2026-10-01T09:00:00Z', replyCount, lastActivityAt: '2026-10-02T09:00:00Z',
  })
  const meeting = (id: string, scheduledAt: string, minutes: string | null) => ({
    id, projectId: PROJECT_ID, title: `Meeting ${id}`, scheduledAt, durationMinutes: 30, location: null, agenda: null,
    createdBy: STUDENT, createdAt: '2026-09-01T09:00:00Z', minutes, minutesRecordedBy: minutes ? SUPERVISOR : null,
    minutesRecordedAt: minutes ? '2026-09-02T09:00:00Z' : null,
  })
  const evidence = (id: string, owner: typeof STUDENT, verified: boolean) => ({
    id, projectId: PROJECT_ID, student: owner, title: `Evidence ${id}`, description: null, occurredOn: '2026-10-05',
    activity: null, verified, verifiedBy: verified ? SUPERVISOR : null, verifiedAt: verified ? '2026-10-06T09:00:00Z' : null,
    createdAt: '2026-10-05T09:00:00Z',
  })
  const data = {
    conversations: [conversation('c1', STUDENT, 0), conversation('c2', STUDENT, 1), conversation('c3', OTHER, 0)],
    meetings: [meeting('m1', '2099-01-01T10:00:00Z', null), meeting('m2', '2020-01-01T10:00:00Z', null),
      meeting('m3', '2020-02-01T10:00:00Z', 'Done.')],
    resources: [],
    evidence: [evidence('e1', STUDENT, false), evidence('e2', STUDENT, true), evidence('e3', OTHER, false)],
  }
  const tile = async (label: RegExp) => within(await screen.findByRole('link', { name: label }))

  it('shows a student their own progress, counted from the project records', async () => {
    mockBackend({ [ME]: () => json(200, student), [MY_PROJECTS]: () => json(200, [project(['STUDENT'])]), ...summaryRoutes(data) })
    renderSignedInAt('/research')

    expect(await screen.findByRole('heading', { name: 'Your progress' })).toBeDefined()
    expect(screen.getByText('Student view')).toBeDefined()
    // Only the student's own items: e1 (not e3, which belongs to someone else).
    expect((await tile(/Your evidence awaiting verification/)).getByText('1')).toBeDefined()
    expect((await tile(/Your evidence awaiting verification/)).getByText('1 of 2 of your items verified')).toBeDefined()
    // c1 has no reply; c3 has none either but was started by someone else.
    expect((await tile(/Your conversations with no reply yet/)).getByText('1')).toBeDefined()
    expect((await tile(/Upcoming meetings/)).getByText('Next: Meeting m1')).toBeDefined()
    expect((await tile(/Meetings awaiting minutes/)).getByText('1')).toBeDefined()
    expect(within(screen.getByRole('list', { name: 'Recent activity' })).getAllByRole('listitem').length).toBeGreaterThan(0)
  })

  it('shows a supervisor everything that needs review in the project', async () => {
    mockBackend({ [ME]: () => json(200, staff), [MY_PROJECTS]: () => json(200, [project(['SUPERVISOR'])]), ...summaryRoutes(data) })
    renderSignedInAt('/research')

    expect(await screen.findByRole('heading', { name: 'Needs your review' })).toBeDefined()
    expect(screen.getByText('Supervisor view')).toBeDefined()
    expect((await tile(/Evidence to verify/)).getByText('2')).toBeDefined()
    expect((await tile(/Conversations with no reply yet/)).getByText('2')).toBeDefined()
    expect(screen.queryByRole('link', { name: /Your evidence/ })).toBeNull()
  })

  it('never asks for conversations or meetings on behalf of an evaluator', async () => {
    const backend = mockBackend({
      [ME]: () => json(200, staff),
      [MY_PROJECTS]: () => json(200, [project(['EVALUATOR'])]),
      [`GET ${C3}/projects/${PROJECT_ID}/resources`]: () => json(200, []),
      [`GET ${C3}/projects/${PROJECT_ID}/evidence`]: () => json(200, data.evidence),
    })
    renderSignedInAt('/research')

    expect((await tile(/Verified evidence items/)).getByText('1 / 3')).toBeDefined()
    expect(backend.callsTo(`GET ${C3}/projects/${PROJECT_ID}/conversations`)).toHaveLength(0)
    expect(backend.callsTo(`GET ${C3}/projects/${PROJECT_ID}/meetings`)).toHaveLength(0)
  })

  it('filters conversations that have no reply yet', async () => {
    mockBackend({ [ME]: () => json(200, staff), [MY_PROJECTS]: () => json(200, [project(['SUPERVISOR'])]), ...summaryRoutes(data) })
    const user = userEvent.setup()
    renderSignedInAt(page('collaboration'))

    const list = await screen.findByRole('list', { name: 'Conversations' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    await user.click(within(screen.getByRole('group', { name: 'Filter conversations' })).getByRole('button', { name: /No reply yet/ }))
    const filtered = within(screen.getByRole('list', { name: 'Conversations' }))
    expect(filtered.getAllByRole('listitem')).toHaveLength(2)
    expect(filtered.queryByText('Subject c2')).toBeNull()
  })

  it('lets a student narrow the evidence timeline to their own verified items', async () => {
    mockBackend({ [ME]: () => json(200, student), [MY_PROJECTS]: () => json(200, [project(['STUDENT'])]), ...summaryRoutes(data) })
    const user = userEvent.setup()
    renderSignedInAt(page('evidence'))

    await screen.findByRole('list', { name: 'Evidence timeline' })
    await user.click(screen.getByRole('button', { name: 'Mine' }))
    const mine = within(screen.getByRole('list', { name: 'Evidence timeline' }))
    expect(mine.queryByText('Evidence e3')).toBeNull()
    expect(screen.getByRole('img', { name: '1 of 2 items verified' })).toBeDefined()
    await user.click(within(screen.getByRole('group', { name: 'Filter by status' })).getByRole('button', { name: /^Verified/ }))
    const verified = within(screen.getByRole('list', { name: 'Evidence timeline' }))
    expect(verified.getByText('Evidence e2')).toBeDefined()
    expect(verified.queryByText('Evidence e1')).toBeNull()
  })
})

describe('research opportunities', () => {
  const RESEARCH = `${C3}/research`
  const topic = (topicId: number, label: string, lowerCoherence = false) => ({
    topicId, label, topTerms: label.split(' · '), lowerCoherence,
  })
  const paper = (arxivId: string, title: string, rank?: number) => ({
    arxivId, title, year: 2025, primaryCategory: 'cs.RO', categoryName: 'Robotics',
    url: `https://arxiv.org/abs/${arxivId}`, ...(rank ? { rank, similarity: 0.2 - rank / 100 } : {}),
  })
  const direction = (rank: number, a: string, b: string, assessment: string) => ({
    rank, title: `${a}  ×  ${b}`, topics: [topic(rank, a), topic(rank + 10, b, rank === 2)],
    summary: `${100 + rank} papers in 2024–2025 cover both topics.`,
    coverage: { assessment, note: 'Coverage note.' },
    evidence: { recentPapers: 100 + rank, olderPapers: rank, recentShare: 0.0016, olderShare: 0.0001, growthLogRatio: 2.1,
      similarPapersCombining: 3, otherCsCategoriesShare: 0.001, otherCsCategoriesPapers: 12, corpusPapersCombining: 400 },
    score: 0.8 - rank / 10,
    factors: { relevance: 0.9, low_coverage: 0.7, growth: 0.8, neighbour_support: 0.3 },
    weights: { relevance: 0.4, low_coverage: 0.25, growth: 0.2, neighbour_support: 0.15 },
    supportingPapers: [paper(`2501.0000${rank}`, `Supporting paper ${rank}`)],
  })
  const analysis = {
    basis: 'Low coverage in this corpus is not proof of a research gap.',
    classification: { category: 'cs.RO', categoryName: 'Robotics', modelVersion: 'svm_tfidf_v1',
      ranking: [{ rank: 1, category: 'cs.RO', categoryName: 'Robotics' }] },
    similarPapers: [paper('2411.00221', 'BOMP: Bin-Optimized Motion Planning', 1), paper('2507.17379', 'Language-Conditioned Mobile Manipulation', 2)],
    recognisedTerms: 60,
    topicProfile: [{ ...topic(21, 'robot · robots · human'), weight: 0.24, ownWeight: 0.3 }],
    directions: [
      direction(1, 'llms · large language', 'planning · motion · path', 'relatively_low'),
      direction(2, 'planning · motion · path', 'object · objects', 'dataset_coverage'),
      direction(3, 'robot · robots · human', 'manipulation · action', 'moderate'),
    ],
    insufficientEvidence: [],
    windows: { older: [2018, 2019], recent: [2024, 2025], olderPapers: 31000, recentPapers: 110000 },
    candidatesConsidered: 18,
    method: { retrieval: 'TF-IDF cosine similarity', score: '0.40 x relevance + ...' },
    limitations: ['Low coverage means relatively few papers in THIS corpus combine the topics. It is not proof of a research gap.'],
  }
  const ABSTRACT = 'We study language-guided grasp planning for household robots with a mobile manipulator. '.repeat(3)
  const routes = (answer: () => Response) => ({
    [ME]: () => json(200, student),
    [`GET ${RESEARCH}/trends`]: () => apiError(503, 'unavailable'),
    [`GET ${RESEARCH}/emerging-topics`]: () => apiError(503, 'unavailable'),
    [`GET ${RESEARCH}/model/metrics`]: () => apiError(503, 'unavailable'),
    [`GET ${RESEARCH}/opportunities/evaluation`]: () => json(200, opportunityEvaluation),
    [`GET ${RESEARCH}/gap-analysis/evaluation`]: () => json(200, gapEvaluation),
    [`POST ${RESEARCH}/opportunities`]: answer,
  })

  async function analyse(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText('Research title'), 'Language-guided grasp planning')
    fireEvent.change(screen.getByLabelText('Research abstract'), { target: { value: ABSTRACT } })
    await user.click(screen.getByRole('button', { name: 'Find research opportunities' }))
  }

  it('shows ranked directions with their evidence, real paper links and limitations', async () => {
    const backend = mockBackend(routes(() => json(200, analysis)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await analyse(user)
    expect(backend.callsTo(`POST ${RESEARCH}/opportunities`)[0].body).toEqual({
      title: 'Language-guided grasp planning', abstract: ABSTRACT,
    })
    const region = within(await screen.findByRole('region', { name: 'Research opportunity analysis' }))
    const directions = within(region.getByRole('list', { name: 'Potential research directions' }))
    expect(directions.getAllByRole('listitem', { name: undefined }).length).toBeGreaterThanOrEqual(3)
    expect(region.getByText('Relatively low coverage')).toBeDefined()
    expect(region.getByText('Likely a dataset-coverage effect')).toBeDefined()
    expect(region.getByText('Includes a lower-coherence topic')).toBeDefined()

    await user.click(region.getAllByText('Why this direction?')[0])
    const factors = within(region.getByRole('list', { name: 'Score factors for direction 1' }))
    expect(factors.getByText('Relevance to your text')).toBeDefined()
    const support = within(region.getByRole('list', { name: 'Supporting papers for direction 1' }))
    expect(support.getByRole('link', { name: 'Supporting paper 1' }).getAttribute('href')).toBe('https://arxiv.org/abs/2501.00001')

    const similar = within(region.getByRole('list', { name: 'Similar papers' }))
    expect(similar.getByRole('link', { name: 'BOMP: Bin-Optimized Motion Planning' }).getAttribute('href')).toBe(
      'https://arxiv.org/abs/2411.00221')
    expect(region.getByText('Robotics')).toBeDefined()
    const text = screen.getByRole('region', { name: 'Research opportunity analysis' }).textContent ?? ''
    expect(text).not.toMatch(/%|confidence/i)
    // The only mention of "unexplored" is the page's own disclaimer that it makes no such claim.
    expect(text.replace('not claims that a topic is unexplored', '')).not.toMatch(/unexplored|novel/i)
  })

  it('states how the analysis was evaluated, including that expert review is not done', async () => {
    mockBackend(routes(() => json(200, analysis)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await user.click(await screen.findByText('How this analysis was evaluated'))
    const list = within(screen.getByRole('list', { name: 'Opportunity analysis evaluation' }))
    expect(list.getByText(/Recall@10\s+0\.989, MRR 0\.948/)).toBeDefined()
    expect(list.getByText(/Expert review: not yet done/)).toBeDefined()
    expect(list.getByText(/Spearman ρ\s+0\.23 over 255 pairs/)).toBeDefined()
  })

  it('explains when the opportunity index is not available', async () => {
    mockBackend(routes(() => apiError(503, 'not available')))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await analyse(user)
    const form = within(screen.getByRole('form', { name: 'Find research opportunities' }))
    expect(await form.findByText('This service is not available right now. Please try again later.')).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Research opportunity analysis' })).toBeNull()
  })
})

describe('aspect-level gap analysis', () => {
  const RESEARCH = `${C3}/research`
  const paper = (arxivId: string, title: string, relevanceRank: number) => ({
    arxivId, title, year: 2025, primaryCategory: 'cs.RO', categoryName: 'Robotics', url: `https://arxiv.org/abs/${arxivId}`,
    relevanceRank, similarity: 0.2,
  })
  const aspect = (family: string, familyLabel: string, label: string) => ({ aspectId: `${family}:${label}`, family, familyLabel, label })
  const coverage = (label: string, k: number, inYourText = false) => ({
    ...aspect('setting', 'Evaluation setting', label), relevantPapers: k, relevantTotal: 100, share: k / 100,
    interval95: [Math.max(0, k / 100 - 0.05), Math.min(1, k / 100 + 0.05)] as [number, number],
    areaPapers: 900, areaTotal: 5000, areaShare: 0.18, inYourText,
  })
  const statement = {
    quote: 'Deployment in the wild remains underexplored.', type: 'under_explored',
    typeLabel: 'Topic described as under-explored by the authors', paper: paper('2501.00042', 'Robot learning in homes', 3),
    aspects: [aspect('setting', 'Evaluation setting', 'Real-world evaluation / deployment')],
  }
  // A real solution sentence (arXiv 2603.19936) once mistyped as the paper's own limitation.
  const addressed = {
    quote: 'In this study, we propose LIORNet, which eliminates these drawbacks and integrates the strengths of all three paradigms.',
    type: 'limitation_addressed', typeLabel: 'Limitation or gap the paper says it addresses',
    paper: paper('2603.19936', 'LIORNet: Self-Supervised LiDAR Snow Removal Framework', 5), aspects: [],
  }
  const CORROBORATED_RULE = 'An author statement and low coverage in the closest abstracts point to the same aspect. ' +
    'This agreement does not establish that the problem is unresolved.'
  const realWorld = aspect('setting', 'Evaluation setting', 'Real-world evaluation / deployment')
  const potentialGaps = [
    {
      heading: 'Real-world evaluation / deployment', aspect: realWorld, signals: ['author_statements', 'low_coverage'],
      uncertainty: 'corroborated', uncertaintyLabel: 'Corroborated signal',
      explanation: '1 author statement in 1 of the 100 most similar papers describes this as under-explored. Connected to your text through the aspect “Real-world evaluation / deployment”.',
      notes: ['The paper that describes this as under-explored works on it itself, so part of it may already be addressed.'],
      paperCount: 1, statementCount: 1, latestYear: 2025, closestRank: 3, sharedTerms: [],
      statements: [{ quote: statement.quote, type: statement.type, typeLabel: statement.typeLabel, paper: statement.paper }],
      coverage: { relevantPapers: 2, relevantTotal: 100, share: 0.02, interval95: [0.006, 0.07], examplePapers: [] },
    },
    {
      heading: 'Agriculture', aspect: aspect('application', 'Application domain', 'Agriculture'), signals: ['low_coverage'],
      uncertainty: 'exploratory', uncertaintyLabel: 'Exploratory signal',
      explanation: 'Your text mentions agriculture, but only 0 of the 100 most similar abstracts do.',
      notes: ['Few mentions in abstracts do not show that the aspect was not studied: full papers and other venues may cover it.'],
      paperCount: 0, statementCount: 0, latestYear: null, closestRank: null, sharedTerms: [], statements: [],
      coverage: { relevantPapers: 0, relevantTotal: 100, share: 0, interval95: [0, 0.037], examplePapers: [] },
    },
  ]
  const analysis = {
    evidenceLevel: 'abstract',
    basis: 'Abstract-level evidence from the most similar real arXiv papers.',
    relevantPapers: [paper('2411.00221', 'BOMP: Bin-Optimized Motion Planning', 1)],
    relevantTotal: 100,
    recognisedTerms: 50,
    wideArea: { topics: [{ topicId: 7, label: 'planning · motion · path' }], papers: 5000 },
    yourAspects: [aspect('setting', 'Evaluation setting', 'Simulation')],
    wellCovered: [coverage('Simulation', 41, true)],
    methodTerms: [{ term: 'grasp planning', relevantPapers: 2, relevantTotal: 100, interval95: [0.005, 0.07], fewMentions: true }],
    authorStatements: { under_explored: [statement], limitation_addressed: [addressed] },
    potentialGaps,
    potentialGapsScreening: {
      statementsConsidered: 9, candidates: 2, shown: 2,
      excluded: { limitationOfPriorWorkOrAddressedByThePaper: 4, limitationWithUnclearOwner: 2, notConnectedToYourText: 1, rarerThanTheWiderAreaOnly: 1 },
    },
    uncertaintyLabels: [
      { level: 'corroborated', label: 'Corroborated signal', rule: CORROBORATED_RULE },
      { level: 'indicative', label: 'Indicative signal', rule: 'Author statements in two or more of the closest papers, or one from the last 3 years.' },
      { level: 'exploratory', label: 'Exploratory signal', rule: 'One signal only.' },
    ],
    directlySupportedGaps: [{ ...realWorld, paperCount: 1, statements: [statement], inYourText: false }],
    inferredGaps: [
      {
        // Off-topic for the text: common in the wider area only (the phishing → Medical / clinical case).
        ...aspect('application', 'Application domain', 'Medical / clinical'), relevantPapers: 0, relevantTotal: 100, share: 0,
        interval95: [0, 0.037] as [number, number], areaPapers: 900, areaTotal: 5000, areaShare: 0.18, inYourText: false, rule: 'area',
        why: '0 of the 100 most similar abstracts mention it, against 18.0 in every 100 papers of the wider topic area (exploratory binomial test, q = 0.001).',
        qValue: 0.001, pValue: 0.0001, corroboratedByAuthorStatements: false, examplePapers: [],
      },
      {
        ...coverage('Agriculture', 0, true), rule: 'anchored', why: 'Your text mentions agriculture.',
        corroboratedByAuthorStatements: false, examplePapers: [],
      },
    ],
    method: { relevantPapers: '100 most similar abstracts' },
    limitations: ['Abstract-level evidence only: the arXiv snapshot contains no full paper text.'],
  }
  const ABSTRACT = 'We study language-guided grasp planning for household robots in simulation with a mobile manipulator. '.repeat(3)
  const routes = (answer: () => Response) => ({
    [ME]: () => json(200, student),
    [`GET ${RESEARCH}/trends`]: () => apiError(503, 'unavailable'),
    [`GET ${RESEARCH}/emerging-topics`]: () => apiError(503, 'unavailable'),
    [`GET ${RESEARCH}/model/metrics`]: () => apiError(503, 'unavailable'),
    [`GET ${RESEARCH}/opportunities/evaluation`]: () => apiError(503, 'unavailable'),
    [`GET ${RESEARCH}/gap-analysis/evaluation`]: () => json(200, gapEvaluation),
    [`POST ${RESEARCH}/gap-analysis`]: answer,
  })

  async function analyse(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText('Gap analysis title'), 'Language-guided grasp planning')
    fireEvent.change(screen.getByLabelText('Gap analysis abstract'), { target: { value: ABSTRACT } })
    await user.click(screen.getByRole('button', { name: 'Analyse research gaps' }))
  }

  it('lists evidence-supported potential gaps with uncertainty labels, cautions and paper links', async () => {
    const backend = mockBackend(routes(() => json(200, analysis)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await analyse(user)
    expect(backend.callsTo(`POST ${RESEARCH}/gap-analysis`)[0].body).toEqual({ title: 'Language-guided grasp planning', abstract: ABSTRACT })
    const region = within(await screen.findByRole('region', { name: 'Aspect-level gap analysis' }))
    expect(region.getByText('Abstract-level evidence')).toBeDefined()
    expect(region.getByRole('heading', { name: 'Potential Research Gaps Identified' })).toBeDefined()

    const gapList = region.getByRole('list', { name: 'Potential research gaps' })
    expect(gapList.children).toHaveLength(2)
    const gaps = within(gapList)
    expect(gaps.getByText('Corroborated signal')).toBeDefined()
    expect(gaps.getByText('Signals: Author statement + Few close abstracts mention it')).toBeDefined()
    expect(gaps.getByText('“Deployment in the wild remains underexplored.”')).toBeDefined()
    expect(gaps.getByRole('link', { name: 'Robot learning in homes' }).getAttribute('href')).toBe('https://arxiv.org/abs/2501.00042')
    expect(within(gaps.getByRole('list', { name: 'Cautions for Real-world evaluation / deployment' }))
      .getByText(/part of it may already be addressed/)).toBeDefined()
    expect(gaps.getByText('Exploratory signal')).toBeDefined()
    expect(gaps.getByText('No close abstract mentions it.')).toBeDefined()

    await user.click(region.getByText('How candidates were screened and what the labels mean'))
    expect(region.getByText(/Of 9 candidate statements in the closest abstracts,\s+4 describe limitations of earlier work/)).toBeDefined()
    expect(within(region.getByRole('list', { name: 'Uncertainty labels' })).getByText(CORROBORATED_RULE)).toBeDefined()

    // The app's own wording never claims that something was never studied or is unresolved.
    // "95% interval" names the statistical interval; any other percentage would be a finding claimed as a percentage.
    const own = (screen.getByRole('region', { name: 'Aspect-level gap analysis' }).textContent ?? '')
      .replaceAll(statement.quote, '')
      .replaceAll(CORROBORATED_RULE, '')
      .replaceAll('95% interval', '')
    expect(own.match(/never been (studied|researched)|has not been studied|unexplored|unresolved|definitely|confidence|%/i)?.[0]).toBeUndefined()
  })

  it('shows wider-area rarity only as context, never as a potential gap (phishing → Medical / clinical)', async () => {
    mockBackend(routes(() => json(200, analysis)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await analyse(user)
    const region = within(await screen.findByRole('region', { name: 'Aspect-level gap analysis' }))
    expect(within(region.getByRole('list', { name: 'Potential research gaps' })).queryByText('Medical / clinical')).toBeNull()

    const context = within(region.getByRole('list', { name: 'Area comparison' }))
    expect(context.getByText('Medical / clinical')).toBeDefined()
    expect(context.queryByText('Agriculture')).toBeNull()
    await user.click(context.getByText('Counts behind this comparison'))
    expect(context.getByText('18.0 per 100 (900 papers)')).toBeDefined()
    expect(within(region.getByRole('list', { name: 'Well-covered aspects' })).getByText('41 of 100')).toBeDefined()
  })

  it('keeps raw author statements, including addressed limitations, out of the potential gaps', async () => {
    mockBackend(routes(() => json(200, analysis)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await analyse(user)
    const region = within(await screen.findByRole('region', { name: 'Aspect-level gap analysis' }))
    expect(within(region.getByRole('list', { name: 'Potential research gaps' })).queryByText(`“${addressed.quote}”`)).toBeNull()
    await user.click(region.getByText('Limitation or gap the paper says it addresses (1)'))
    const raw = within(region.getByRole('list', { name: 'Limitation or gap the paper says it addresses' }))
    expect(raw.getByText(`“${addressed.quote}”`)).toBeDefined()
    expect(raw.getByRole('link', { name: addressed.paper.title }).getAttribute('href')).toBe('https://arxiv.org/abs/2603.19936')
  })

  it('says when no evidence-supported potential gap was found, without claiming none exist', async () => {
    mockBackend(routes(() => json(200, { ...analysis, potentialGaps: [], potentialGapsScreening: { ...analysis.potentialGapsScreening, candidates: 0, shown: 0 } })))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await analyse(user)
    const region = within(await screen.findByRole('region', { name: 'Aspect-level gap analysis' }))
    expect(region.getByText('No evidence-supported potential gaps found')).toBeDefined()
    expect(region.getByText(/This does not\s+mean none exist/)).toBeDefined()
    expect(region.queryByRole('list', { name: 'Potential research gaps' })).toBeNull()
    expect(within(region.getByRole('list', { name: 'Area comparison' })).getByText('Medical / clinical')).toBeDefined()
  })

  it('states that manual review metrics are not measured yet', async () => {
    mockBackend(routes(() => json(200, analysis)))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await user.click(await screen.findByText('How this analysis is checked'))
    const list = within(screen.getByRole('list', { name: 'Gap analysis evaluation' }))
    expect(list.getByText(/NOT measured/)).toBeDefined()
    expect(list.getByText(/90,000 of 90,000\s+checked as exact text/)).toBeDefined()
  })

  it('explains when the gap analysis is not available', async () => {
    mockBackend(routes(() => apiError(503, 'not available')))
    const user = userEvent.setup()
    renderSignedInAt('/research-intelligence')

    await analyse(user)
    const form = within(screen.getByRole('form', { name: 'Analyse research gaps' }))
    expect(await form.findByText('This service is not available right now. Please try again later.')).toBeDefined()
    expect(screen.queryByRole('region', { name: 'Aspect-level gap analysis' })).toBeNull()
  })
})
