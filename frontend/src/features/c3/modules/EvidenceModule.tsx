import { useState, type FormEvent } from 'react'
import { useAuth } from '../../../auth/AuthContext'
import Alert from '../../../components/Alert'
import FormField from '../../../components/FormField'
import { createEvidence, listConversations, listEvidence, listMeetings, listResources, verifyEvidence } from '../api/c3Api'
import type { ActivityType, Evidence } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { SelectField, TextAreaField } from '../components/fields'
import { type ProjectAccess, formError, formatDate, formatDateTime, today } from '../display'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import Collapsible from '../ui/Collapsible'
import EmptyState from '../ui/EmptyState'
import FilterChips from '../ui/FilterChips'
import Icon, { type IconName } from '../ui/Icon'
import { panel, panelClass, primaryButtonClass } from '../ui/styles'

const ACTIVITY: Record<ActivityType, { label: string; icon: IconName }> = {
  MEETING: { label: 'Meeting', icon: 'calendar' },
  CONVERSATION: { label: 'Conversation', icon: 'chat' },
  RESOURCE: { label: 'Resource', icon: 'book' },
  OTHER: { label: 'Not linked', icon: 'tag' },
}
const monthHeading = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

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
    <form onSubmit={submit} className="space-y-3" aria-label="Add evidence">
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
        options={(Object.keys(ACTIVITY) as ActivityType[]).map((value) => ({ value, label: ACTIVITY[value].label }))} />
      {activityType !== 'OTHER' && (
        <StateView state={options.state} retry={options.reload} loadingText="Loading activities…">
          {(choices) =>
            choices.length === 0 ? (
              <p className="text-sm text-slate-500">This project has no {ACTIVITY[activityType].label.toLowerCase()}s yet.</p>
            ) : (
              <SelectField id="evidence-activity" label={ACTIVITY[activityType].label} value={activityId}
                onChange={(e) => setActivityId(e.target.value)} required error={error?.fields.activityId}
                options={[{ value: '', label: 'Choose…' }, ...choices]} />
            )
          }
        </StateView>
      )}
      <button type="submit" className={primaryButtonClass} disabled={saving}>
        <Icon name="plus" className="size-4" />
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
    <div className="mt-4 space-y-2">
      {error && <Alert tone="error">{error}</Alert>}
      <button type="button" onClick={verify} disabled={saving} className={primaryButtonClass}
        aria-label={`Verify evidence: ${evidence.title}`}>
        <Icon name="badgeCheck" className="size-4" />
        {saving ? 'Verifying…' : 'Verify'}
      </button>
    </div>
  )
}

function EvidenceCard({ evidence, canVerify, onVerified }: { evidence: Evidence; canVerify: boolean; onVerified: () => void }) {
  const e = evidence
  return (
    <li className="relative">
      <span aria-hidden="true" className={
        'absolute top-6 -left-[1.4rem] inline-flex size-6 items-center justify-center rounded-full ring-4 ring-slate-50 ' +
        (e.verified ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white')
      }>
        <Icon name={e.verified ? 'check' : 'hourglass'} className="size-3.5" />
      </span>
      <div className={`${panel} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">{formatDate(e.occurredOn)}</p>
            <h4 className="mt-0.5 font-semibold text-slate-900">{e.title}</h4>
          </div>
          {e.verified ? (
            <Badge tone="green" icon="badgeCheck">Verified</Badge>
          ) : (
            <Badge tone="amber" icon="hourglass">Awaiting verification</Badge>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Avatar id={e.student.id} name={e.student.name} size="sm" />
          <span>{e.student.name}</span>
          {e.activity && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              <Icon name={ACTIVITY[e.activity.type].icon} className="size-3.5" />
              {ACTIVITY[e.activity.type].label}: {e.activity.title ?? 'removed'}
            </span>
          )}
        </div>
        {e.description && <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">{e.description}</p>}
        {e.verified && e.verifiedBy && e.verifiedAt && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Icon name="check" className="size-3.5" />
            Verified by {e.verifiedBy.name} · {formatDateTime(e.verifiedAt)}
          </p>
        )}
        {!e.verified && canVerify && <VerifyButton evidence={e} onVerified={onVerified} />}
      </div>
    </li>
  )
}

type StatusFilter = 'all' | 'verified' | 'awaiting'
type ScopeFilter = 'mine' | 'all'

export default function EvidenceModule({ projectId, access }: { projectId: string; access: ProjectAccess }) {
  const { user } = useAuth()
  const { state, reload } = useLoad(() => listEvidence(projectId), `evidence-${projectId}`)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [scope, setScope] = useState<ScopeFilter>('all')

  return (
    <StateView state={state} retry={reload} loadingText="Loading evidence…">
      {(items) => {
        const inScope = scope === 'mine' ? items.filter((e) => e.student.id === user?.id) : items
        const verified = inScope.filter((e) => e.verified).length
        const visible = inScope.filter((e) => status === 'all' || (status === 'verified') === e.verified)
        const groups: { label: string; items: Evidence[] }[] = []
        for (const e of visible) {
          const [y, m] = e.occurredOn.split('-').map(Number)
          const label = monthHeading.format(new Date(y, m - 1, 1))
          const last = groups[groups.length - 1]
          if (last?.label === label) last.items.push(e)
          else groups.push({ label, items: [e] })
        }
        const ratio = inScope.length ? verified / inScope.length : 0
        return (
          <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
            <div className="space-y-4">
              {access.isStudent ? (
                <Collapsible icon="plus" title="Add evidence of your work" defaultOpen={items.length === 0}>
                  <NewEvidenceForm projectId={projectId} onCreated={reload} />
                </Collapsible>
              ) : (
                <p className="flex items-start gap-2 text-sm text-slate-600">
                  <Icon name="info" className="mt-0.5 size-4 text-indigo-500" />
                  {access.isSupervisor ? 'Students record evidence of their work; you verify it.' : 'You can read the evidence timeline.'}
                </p>
              )}
              <div className={panelClass}>
                <p className="text-sm font-semibold text-slate-900">Verification progress</p>
                <p className="mt-1 text-xs text-slate-500">
                  {scope === 'mine' ? 'Your items' : 'All items in the project'}
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Items', inScope.length, 'text-slate-900'],
                    ['Verified', verified, 'text-emerald-700'],
                    ['Awaiting', inScope.length - verified, 'text-amber-700'],
                  ].map(([label, value, color]) => (
                    <div key={label as string} className="rounded-xl bg-slate-50 py-2">
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className={'text-xl font-semibold ' + color}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" role="img"
                  aria-label={`${verified} of ${inScope.length} items verified`}>
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${ratio * 100}%` }} />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  This portfolio records evidence and its verification only. Marks and grades are not given here.
                </p>
              </div>
            </div>
            <div className="min-w-0 space-y-4">
              {items.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <FilterChips label="Filter by status" value={status} onChange={setStatus} options={[
                    { value: 'all', label: 'All', count: inScope.length },
                    { value: 'verified', label: 'Verified', count: verified },
                    { value: 'awaiting', label: 'Awaiting', count: inScope.length - verified },
                  ]} />
                  {access.isStudent && (
                    <FilterChips label="Whose evidence" value={scope} onChange={setScope} options={[
                      { value: 'all', label: 'Whole project' },
                      { value: 'mine', label: 'Mine' },
                    ]} />
                  )}
                </div>
              )}
              {items.length === 0 ? (
                <EmptyState icon="badgeCheck" title="No evidence yet.">
                  {access.isStudent ? 'Record what you did and link it to a meeting, conversation or resource.' : 'Evidence recorded by students appears here.'}
                </EmptyState>
              ) : visible.length === 0 ? (
                <p className="text-sm text-slate-500">No evidence matches this filter.</p>
              ) : (
                <ol className="space-y-6" aria-label="Evidence timeline">
                  {groups.map((group) => (
                    <li key={group.label}>
                      <h4 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">{group.label}</h4>
                      <ol className="ml-3 space-y-4 border-l-2 border-slate-200 pl-6">
                        {group.items.map((e) => (
                          <EvidenceCard key={e.id} evidence={e} canVerify={access.isSupervisor} onVerified={reload} />
                        ))}
                      </ol>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )
      }}
    </StateView>
  )
}
