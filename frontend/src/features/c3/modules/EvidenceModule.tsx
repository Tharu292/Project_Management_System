import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import { actionButtonClass, secondaryButtonClass } from '../../../components/AppShell'
import FormField from '../../../components/FormField'
import { createEvidence, listConversations, listEvidence, listMeetings, listResources, verifyEvidence } from '../api/c3Api'
import type { ActivityType, Evidence } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { SelectField, TextAreaField } from '../components/fields'
import { type ProjectAccess, cardClass, formError, formatDate, formatDateTime, today } from '../display'

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  MEETING: 'Meeting',
  CONVERSATION: 'Conversation',
  RESOURCE: 'Resource',
  OTHER: 'Not linked',
}

async function activityOptions(projectId: string, type: ActivityType): Promise<{ value: string; label: string }[]> {
  switch (type) {
    case 'MEETING':
      return (await listMeetings(projectId)).map((m) => ({ value: m.id, label: `${m.title} (${formatDateTime(m.scheduledAt)})` }))
    case 'CONVERSATION':
      return (await listConversations(projectId)).map((c) => ({ value: c.id, label: c.subject }))
    case 'RESOURCE':
      return (await listResources(projectId)).map((r) => ({ value: r.id, label: r.title }))
    default:
      return []
  }
}

function NewEvidenceForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [occurredOn, setOccurredOn] = useState(today())
  const [activityType, setActivityType] = useState<ActivityType>('OTHER')
  const [activityId, setActivityId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null)
  const options = useLoad(() => activityOptions(projectId, activityType), `${projectId}-${activityType}`)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createEvidence(projectId, {
        title,
        description: description || undefined,
        occurredOn,
        activityType,
        activityId: activityType === 'OTHER' ? undefined : activityId || undefined,
      })
      setTitle('')
      setDescription('')
      setActivityType('OTHER')
      setActivityId('')
      onCreated()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={cardClass + ' space-y-3'} aria-label="Add evidence">
      <h3 className="font-semibold text-slate-900">Add evidence of your work</h3>
      {error && <Alert tone="error">{error.message}</Alert>}
      <FormField id="evidence-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)}
        maxLength={200} required error={error?.fields.title} />
      <TextAreaField id="evidence-description" label="What you did" rows={3} value={description}
        onChange={(e) => setDescription(e.target.value)} maxLength={5000} error={error?.fields.description} />
      <FormField id="evidence-date" label="Date" type="date" value={occurredOn} max={today()}
        onChange={(e) => setOccurredOn(e.target.value)} required error={error?.fields.occurredOn} />
      <SelectField id="evidence-activity-type" label="Linked activity" value={activityType}
        onChange={(e) => {
          setActivityType(e.target.value as ActivityType)
          setActivityId('')
        }}
        options={(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((value) => ({ value, label: ACTIVITY_LABELS[value] }))} />
      {activityType !== 'OTHER' && (
        <StateView state={options.state} retry={options.reload} loadingText="Loading activities…">
          {(choices) =>
            choices.length === 0 ? (
              <p className="text-sm text-slate-500">This project has no {ACTIVITY_LABELS[activityType].toLowerCase()}s yet.</p>
            ) : (
              <SelectField id="evidence-activity" label={ACTIVITY_LABELS[activityType]} value={activityId}
                onChange={(e) => setActivityId(e.target.value)} required error={error?.fields.activityId}
                options={[{ value: '', label: 'Choose…' }, ...choices]} />
            )
          }
        </StateView>
      )}
      <button type="submit" className={actionButtonClass} disabled={saving}>
        {saving ? 'Saving…' : 'Add evidence'}
      </button>
    </form>
  )
}

function VerifyButton({ evidence, onVerified }: { evidence: Evidence; onVerified: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function verify() {
    setSaving(true)
    setError(null)
    try {
      await verifyEvidence(evidence.id)
      onVerified()
    } catch (caught) {
      setError(formError(caught).message)
      setSaving(false)
    }
  }
  return (
    <div className="mt-3 space-y-2">
      {error && <Alert tone="error">{error}</Alert>}
      <button type="button" onClick={verify} disabled={saving} className={secondaryButtonClass}
        aria-label={`Verify evidence: ${evidence.title}`}>
        {saving ? 'Verifying…' : 'Verify'}
      </button>
    </div>
  )
}

export default function EvidenceModule({ projectId, access }: { projectId: string; access: ProjectAccess }) {
  const { state, reload } = useLoad(() => listEvidence(projectId), `evidence-${projectId}`)
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <div className="space-y-4">
        {access.isStudent ? (
          <NewEvidenceForm projectId={projectId} onCreated={reload} />
        ) : (
          <p className="text-sm text-slate-600">
            {access.isSupervisor
              ? 'Students record evidence of their work; you verify it.'
              : 'You can read the evidence timeline.'}
          </p>
        )}
        <p className="text-xs text-slate-500">
          This portfolio records evidence and its verification only. Marks and grades are not given here.
        </p>
      </div>
      <div>
        <h3 className="mb-3 font-semibold text-slate-900">Evidence timeline</h3>
        <StateView state={state} retry={reload} loadingText="Loading evidence…">
          {(items) =>
            items.length === 0 ? (
              <p className="text-sm text-slate-500">No evidence yet.</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-600">
                  {items.length} {items.length === 1 ? 'item' : 'items'}, {items.filter((e) => e.verified).length} verified
                </p>
                <ol className="relative space-y-3 border-l-2 border-slate-200 pl-5" aria-label="Evidence timeline">
                  {items.map((e) => (
                    <li key={e.id} className={cardClass + ' relative'}>
                      <span aria-hidden="true"
                        className={'absolute top-6 -left-[1.95rem] size-3 rounded-full ring-4 ring-slate-50 ' +
                          (e.verified ? 'bg-green-600' : 'bg-slate-400')} />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="font-semibold text-slate-900">{e.title}</h4>
                        <span className={'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                          (e.verified ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700')}>
                          {e.verified ? 'Verified' : 'Awaiting verification'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDate(e.occurredOn)} · {e.student.name}
                        {e.activity && ` · ${ACTIVITY_LABELS[e.activity.type]}: ${e.activity.title ?? 'removed'}`}
                      </p>
                      {e.description && <p className="mt-2 text-sm whitespace-pre-wrap text-slate-800">{e.description}</p>}
                      {e.verified && e.verifiedBy && e.verifiedAt && (
                        <p className="mt-2 text-xs text-slate-500">
                          Verified by {e.verifiedBy.name} · {formatDateTime(e.verifiedAt)}
                        </p>
                      )}
                      {!e.verified && access.isSupervisor && <VerifyButton evidence={e} onVerified={reload} />}
                    </li>
                  ))}
                </ol>
              </>
            )
          }
        </StateView>
      </div>
    </div>
  )
}
