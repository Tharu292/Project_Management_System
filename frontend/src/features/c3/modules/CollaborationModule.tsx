import { useState, type FormEvent } from 'react'
import { useAuth } from '../../../auth/AuthContext'
import Alert from '../../../components/Alert'
import FormField from '../../../components/FormField'
import { createConversation, getConversation, listConversations, replyToConversation } from '../api/c3Api'
import type { ConversationKind, ConversationSummary } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { SelectField, TextAreaField } from '../components/fields'
import { type ProjectAccess, formError, formatDateTime } from '../display'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import Collapsible from '../ui/Collapsible'
import EmptyState from '../ui/EmptyState'
import FilterChips from '../ui/FilterChips'
import Icon from '../ui/Icon'
import { focusRing, panel, primaryButtonClass } from '../ui/styles'

const KIND_LABELS: Record<ConversationKind, string> = { PROGRESS_UPDATE: 'Progress update', QUESTION: 'Question' }

function KindBadge({ kind }: { kind: ConversationKind }) {
  return kind === 'QUESTION' ? (
    <Badge tone="violet" icon="question">Question</Badge>
  ) : (
    <Badge tone="indigo" icon="flag">Progress update</Badge>
  )
}

type Filter = 'all' | 'QUESTION' | 'PROGRESS_UPDATE' | 'unanswered'

function NewConversationForm({ projectId, onCreated }: { projectId: string; onCreated: (id: string) => void }) {
  const [kind, setKind] = useState<ConversationKind>('PROGRESS_UPDATE')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await createConversation(projectId, { kind, subject, body })
      setSubject('')
      setBody('')
      onCreated(created.id)
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="New progress update or question">
      {error && <Alert tone="error">{error.message}</Alert>}
      <SelectField id="conversation-kind" label="Type" value={kind}
        onChange={(e) => setKind(e.target.value as ConversationKind)}
        options={[
          { value: 'PROGRESS_UPDATE', label: 'Progress update' },
          { value: 'QUESTION', label: 'Question' },
        ]}
        error={error?.fields.kind} />
      <FormField id="conversation-subject" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)}
        maxLength={200} required error={error?.fields.subject} />
      <TextAreaField id="conversation-body" label="Message" value={body} onChange={(e) => setBody(e.target.value)}
        maxLength={5000} required error={error?.fields.body} />
      <button type="submit" className={primaryButtonClass} disabled={saving}>
        <Icon name="arrowRight" className="size-4" />
        {saving ? 'Posting…' : 'Post'}
      </button>
    </form>
  )
}

function ConversationThread({ conversationId, onReplied }: { conversationId: string; onReplied: () => void }) {
  const { user } = useAuth()
  const { state, reload } = useLoad(() => getConversation(conversationId), conversationId)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await replyToConversation(conversationId, reply)
      setReply('')
      reload()
      onReplied()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <StateView state={state} retry={reload} loadingText="Loading the conversation…">
      {(conversation) => (
        <article className={panel} aria-label={`Conversation: ${conversation.subject}`}>
          <header className="border-b border-slate-100 p-5">
            <KindBadge kind={conversation.kind} />
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">{conversation.subject}</h3>
            <div className="mt-3 flex items-center gap-3">
              <Avatar id={conversation.author.id} name={conversation.author.name} />
              <p className="text-sm">
                <span className="font-medium text-slate-900">
                  {conversation.author.id === user?.id ? 'You' : conversation.author.name}
                </span>
                <span className="block text-xs text-slate-500">{formatDateTime(conversation.createdAt)}</span>
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-800">{conversation.body}</p>
          </header>
          <div className="bg-slate-50/60 p-5">
            <p className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
              {conversation.replies.length} {conversation.replies.length === 1 ? 'reply' : 'replies'}
            </p>
            <ol className="space-y-3" aria-label="Replies">
              {conversation.replies.length === 0 && <li className="text-sm text-slate-500">No replies yet.</li>}
              {conversation.replies.map((r) => {
                const mine = r.author.id === user?.id
                return (
                  <li key={r.id} className={'flex gap-3 ' + (mine ? 'flex-row-reverse text-right' : '')}>
                    <Avatar id={r.author.id} name={r.author.name} size="sm" />
                    <div className={'max-w-[85%] rounded-2xl px-4 py-2.5 ' + (mine ? 'bg-indigo-600 text-white' : 'bg-white shadow-sm ring-1 ring-slate-200')}>
                      <p className={'text-xs ' + (mine ? 'text-indigo-100' : 'text-slate-500')}>
                        {mine ? 'You' : r.author.name} · {formatDateTime(r.createdAt)}
                      </p>
                      <p className={'mt-1 text-left text-sm whitespace-pre-wrap ' + (mine ? 'text-white' : 'text-slate-800')}>{r.body}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
            <form onSubmit={submit} className="mt-5 space-y-3" aria-label="Reply">
              {error && <Alert tone="error">{error.message}</Alert>}
              <TextAreaField id="reply-body" label="Your reply" rows={3} value={reply}
                onChange={(e) => setReply(e.target.value)} maxLength={5000} required error={error?.fields.body} />
              <button type="submit" className={primaryButtonClass} disabled={saving}>
                <Icon name="arrowRight" className="size-4" />
                {saving ? 'Sending…' : 'Send reply'}
              </button>
            </form>
          </div>
        </article>
      )}
    </StateView>
  )
}

function matches(c: ConversationSummary, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'unanswered') return c.replyCount === 0
  return c.kind === filter
}

export default function CollaborationModule({ projectId, access }: { projectId: string; access: ProjectAccess }) {
  const { state, reload } = useLoad(() => listConversations(projectId), `conversations-${projectId}`)
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-4">
        <StateView state={state} retry={reload} loadingText="Loading conversations…">
          {(conversations) => {
            const visible = conversations.filter((c) => matches(c, filter))
            return (
              <div className="space-y-4">
                {access.isStudent ? (
                  <Collapsible icon="plus" title="New progress update or question" defaultOpen={conversations.length === 0}>
                    <NewConversationForm projectId={projectId} onCreated={(id) => {
                      setOpenId(id)
                      setFilter('all')
                      reload()
                    }} />
                  </Collapsible>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Icon name="info" className="size-4 text-indigo-500" />
                    Students start conversations; you can read and reply to them.
                  </p>
                )}
                {conversations.length === 0 ? (
                  <EmptyState icon="chat" title="No conversations yet.">
                    {access.isStudent ? 'Post a progress update or ask your supervisor a question.' : 'Conversations started by students appear here.'}
                  </EmptyState>
                ) : (
                  <>
                    <FilterChips label="Filter conversations" value={filter} onChange={setFilter} options={[
                      { value: 'all', label: 'All', count: conversations.length },
                      { value: 'QUESTION', label: 'Questions', count: conversations.filter((c) => c.kind === 'QUESTION').length },
                      { value: 'PROGRESS_UPDATE', label: 'Updates', count: conversations.filter((c) => c.kind === 'PROGRESS_UPDATE').length },
                      { value: 'unanswered', label: 'No reply yet', count: conversations.filter((c) => c.replyCount === 0).length },
                    ]} />
                    {visible.length === 0 ? (
                      <p className="text-sm text-slate-500">No conversations match this filter.</p>
                    ) : (
                      <ul className="space-y-2" aria-label="Conversations">
                        {visible.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => setOpenId(c.id)}
                              aria-current={openId === c.id ? 'true' : undefined}
                              className={
                                'flex w-full gap-3 rounded-2xl border p-4 text-left transition ' + focusRing + ' ' +
                                (openId === c.id
                                  ? 'border-indigo-300 bg-indigo-50/70 shadow-sm'
                                  : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm')
                              }
                            >
                              <Avatar id={c.author.id} name={c.author.name} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-900">{c.subject}</span>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {KIND_LABELS[c.kind]} · {c.author.name} · {formatDateTime(c.lastActivityAt)}
                                </span>
                                <span className="mt-2 flex flex-wrap gap-1.5">
                                  {c.replyCount === 0 ? (
                                    <Badge tone="amber" icon="hourglass">No reply yet</Badge>
                                  ) : (
                                    <Badge tone="green" icon="check">{`${c.replyCount} ${c.replyCount === 1 ? 'reply' : 'replies'}`}</Badge>
                                  )}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )
          }}
        </StateView>
      </div>
      <div className="min-w-0">
        {openId ? (
          <ConversationThread key={openId} conversationId={openId} onReplied={reload} />
        ) : (
          <EmptyState icon="chat" title="Choose a conversation">
            Its messages and replies open here, and you can reply.
          </EmptyState>
        )}
      </div>
    </div>
  )
}
