import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import { actionButtonClass } from '../../../components/AppShell'
import FormField from '../../../components/FormField'
import { createConversation, getConversation, listConversations, replyToConversation } from '../api/c3Api'
import type { ConversationKind } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { SelectField, TextAreaField } from '../components/fields'
import { type ProjectAccess, cardClass, formError, formatDateTime } from '../display'

const KIND_LABELS: Record<ConversationKind, string> = { PROGRESS_UPDATE: 'Progress update', QUESTION: 'Question' }

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
    <form onSubmit={submit} className={cardClass + ' space-y-3'} aria-label="New progress update or question">
      <h3 className="font-semibold text-slate-900">New progress update or question</h3>
      {error && <Alert tone="error">{error.message}</Alert>}
      <SelectField
        id="conversation-kind"
        label="Type"
        value={kind}
        onChange={(e) => setKind(e.target.value as ConversationKind)}
        options={[
          { value: 'PROGRESS_UPDATE', label: 'Progress update' },
          { value: 'QUESTION', label: 'Question' },
        ]}
        error={error?.fields.kind}
      />
      <FormField
        id="conversation-subject"
        label="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={200}
        required
        error={error?.fields.subject}
      />
      <TextAreaField
        id="conversation-body"
        label="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        required
        error={error?.fields.body}
      />
      <button type="submit" className={actionButtonClass} disabled={saving}>
        {saving ? 'Posting…' : 'Post'}
      </button>
    </form>
  )
}

function ConversationThread({ conversationId, onReplied }: { conversationId: string; onReplied: () => void }) {
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
        <article className={cardClass} aria-label={`Conversation: ${conversation.subject}`}>
          <p className="text-xs font-semibold tracking-wide text-indigo-700 uppercase">
            {KIND_LABELS[conversation.kind]}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{conversation.subject}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {conversation.author.name} · {formatDateTime(conversation.createdAt)}
          </p>
          <p className="mt-3 text-sm whitespace-pre-wrap text-slate-800">{conversation.body}</p>
          <ol className="mt-5 space-y-3 border-t border-slate-200 pt-4" aria-label="Replies">
            {conversation.replies.length === 0 && <li className="text-sm text-slate-500">No replies yet.</li>}
            {conversation.replies.map((r) => (
              <li key={r.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">
                  {r.author.name} · {formatDateTime(r.createdAt)}
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-slate-800">{r.body}</p>
              </li>
            ))}
          </ol>
          <form onSubmit={submit} className="mt-4 space-y-3" aria-label="Reply">
            {error && <Alert tone="error">{error.message}</Alert>}
            <TextAreaField
              id="reply-body"
              label="Your reply"
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={5000}
              required
              error={error?.fields.body}
            />
            <button type="submit" className={actionButtonClass} disabled={saving}>
              {saving ? 'Sending…' : 'Send reply'}
            </button>
          </form>
        </article>
      )}
    </StateView>
  )
}

export default function CollaborationModule({ projectId, access }: { projectId: string; access: ProjectAccess }) {
  const { state, reload } = useLoad(() => listConversations(projectId), `conversations-${projectId}`)
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <div className="space-y-4">
        {access.isStudent ? (
          <NewConversationForm
            projectId={projectId}
            onCreated={(id) => {
              setOpenId(id)
              reload()
            }}
          />
        ) : (
          <p className="text-sm text-slate-600">Students start conversations; you can read and reply to them.</p>
        )}
        <StateView state={state} retry={reload} loadingText="Loading conversations…">
          {(conversations) =>
            conversations.length === 0 ? (
              <p className="text-sm text-slate-500">No conversations yet.</p>
            ) : (
              <ul className="space-y-2" aria-label="Conversations">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(c.id)}
                      aria-current={openId === c.id ? 'true' : undefined}
                      className={
                        'w-full rounded-lg border px-3 py-2 text-left hover:border-indigo-300 ' +
                        (openId === c.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white')
                      }
                    >
                      <span className="block text-sm font-medium text-slate-900">{c.subject}</span>
                      <span className="block text-xs text-slate-500">
                        {KIND_LABELS[c.kind]} · {c.author.name} · {c.replyCount}{' '}
                        {c.replyCount === 1 ? 'reply' : 'replies'} · {formatDateTime(c.lastActivityAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          }
        </StateView>
      </div>
      <div>
        {openId ? (
          <ConversationThread key={openId} conversationId={openId} onReplied={reload} />
        ) : (
          <p className={cardClass + ' text-sm text-slate-500'}>Choose a conversation to read it and reply.</p>
        )}
      </div>
    </div>
  )
}
