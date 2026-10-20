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

describe('navigation and workspace', () => {
  it('shows the main menu and all five module cards to a student', async () => {
    mockBackend({ [ME]: () => json(200, student), [MY_PROJECTS]: () => json(200, [project(['STUDENT'])]) })
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
    mockBackend({ [ME]: () => json(200, staff), [MY_PROJECTS]: () => json(200, [project(['EVALUATOR'])]) })
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
    await user.type(screen.getByLabelText('Title'), 'Progress review')
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-11-02T10:00' } })
    await user.type(screen.getByLabelText('Location or meeting link'), 'Lab 3')
    await user.click(screen.getByRole('button', { name: 'Schedule meeting' }))
    const sent = backend.callsTo(`POST ${C3}/projects/${PROJECT_ID}/meetings`)[0].body as Record<string, unknown>
    expect(sent.title).toBe('Progress review')
    expect(sent.scheduledAt).toBe(new Date('2026-11-02T10:00').toISOString())
    expect(sent.location).toBe('Lab 3')

    await user.type(screen.getByLabelText('Minutes'), 'Agreed the scope.')
    await user.click(screen.getByRole('button', { name: 'Record minutes' }))
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
})
