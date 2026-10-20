import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import { actionButtonClass, secondaryButtonClass } from '../../../components/AppShell'
import FormField from '../../../components/FormField'
import { createMeeting, listMeetings, recordMinutes } from '../api/c3Api'
import type { Meeting } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { TextAreaField } from '../components/fields'
import { cardClass, formError, formatDateTime } from '../display'

type FormProblem = { message: string; fields: Record<string, string> } | null

function isWebAddress(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function NewMeetingForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState('')
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState('')
  const [agenda, setAgenda] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<FormProblem>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!when) {
      setError({ message: 'Please correct the highlighted field.', fields: { scheduledAt: 'Choose the date and time.' } })
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createMeeting(projectId, {
        title,
        // The input gives local time without a zone; the backend stores an instant.
        scheduledAt: new Date(when).toISOString(),
        durationMinutes: duration ? Number(duration) : undefined,
        location: location || undefined,
        agenda: agenda || undefined,
      })
      setTitle('')
      setWhen('')
      setDuration('')
      setLocation('')
      setAgenda('')
      onCreated()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={cardClass + ' space-y-3'} aria-label="Schedule a meeting">
      <h3 className="font-semibold text-slate-900">Schedule a meeting</h3>
      {error && <Alert tone="error">{error.message}</Alert>}
      <FormField id="meeting-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)}
        maxLength={200} required error={error?.fields.title} />
      <FormField id="meeting-when" label="Date and time" type="datetime-local" value={when}
        onChange={(e) => setWhen(e.target.value)} required error={error?.fields.scheduledAt} />
      <FormField id="meeting-duration" label="Duration (minutes)" type="number" min={1} max={1440} value={duration}
        onChange={(e) => setDuration(e.target.value)} error={error?.fields.durationMinutes} />
      <FormField id="meeting-location" label="Location or meeting link" value={location}
        onChange={(e) => setLocation(e.target.value)} maxLength={500} error={error?.fields.location} />
      <TextAreaField id="meeting-agenda" label="Agenda" rows={3} value={agenda}
        onChange={(e) => setAgenda(e.target.value)} maxLength={5000} error={error?.fields.agenda} />
      <button type="submit" className={actionButtonClass} disabled={saving}>
        {saving ? 'Saving…' : 'Schedule meeting'}
      </button>
    </form>
  )
}

function MinutesForm({ meeting, onRecorded }: { meeting: Meeting; onRecorded: () => void }) {
  const [minutes, setMinutes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<FormProblem>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await recordMinutes(meeting.id, minutes)
      onRecorded()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2" aria-label={`Minutes for ${meeting.title}`}>
      {error && <Alert tone="error">{error.message}</Alert>}
      <TextAreaField id={`minutes-${meeting.id}`} label="Minutes" rows={3} value={minutes}
        onChange={(e) => setMinutes(e.target.value)} maxLength={10000} required error={error?.fields.minutes}
        hint="Decisions, agreed actions and who does them. Minutes can be recorded once." />
      <button type="submit" className={secondaryButtonClass} disabled={saving}>
        {saving ? 'Saving…' : 'Record minutes'}
      </button>
    </form>
  )
}

function MeetingCard({ meeting, now, onChanged }: { meeting: Meeting; now: number; onChanged: () => void }) {
  const started = new Date(meeting.scheduledAt).getTime() <= now
  return (
    <li className={cardClass}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{meeting.title}</h3>
        <span
          className={
            'rounded-full px-2 py-0.5 text-xs font-semibold ' +
            (meeting.minutes
              ? 'bg-green-100 text-green-800'
              : started
                ? 'bg-amber-100 text-amber-900'
                : 'bg-indigo-100 text-indigo-800')
          }
        >
          {meeting.minutes ? 'Minutes recorded' : started ? 'Minutes pending' : 'Upcoming'}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {formatDateTime(meeting.scheduledAt)}
        {meeting.durationMinutes ? ` · ${meeting.durationMinutes} min` : ''}
        {meeting.location && (
          <>
            {' · '}
            {isWebAddress(meeting.location) ? (
              <a href={meeting.location} target="_blank" rel="noreferrer noopener" className="text-indigo-700 underline">
                {meeting.location}
              </a>
            ) : (
              meeting.location
            )}
          </>
        )}
      </p>
      {meeting.agenda && (
        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-800">
          <span className="font-medium">Agenda: </span>
          {meeting.agenda}
        </p>
      )}
      {meeting.minutes ? (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">
            Minutes by {meeting.minutesRecordedBy?.name} · {formatDateTime(meeting.minutesRecordedAt ?? meeting.createdAt)}
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-slate-800">{meeting.minutes}</p>
        </div>
      ) : (
        started && <MinutesForm meeting={meeting} onRecorded={onChanged} />
      )}
      <p className="mt-3 text-xs text-slate-400">Scheduled by {meeting.createdBy.name}</p>
    </li>
  )
}

export default function MeetingsModule({ projectId }: { projectId: string }) {
  const { state, reload } = useLoad(() => listMeetings(projectId), `meetings-${projectId}`)
  // Taken once per visit, so the page does not change between renders.
  const [now] = useState(() => Date.now())
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <NewMeetingForm projectId={projectId} onCreated={reload} />
      <div>
        <h3 className="mb-3 font-semibold text-slate-900">Meeting history</h3>
        <StateView state={state} retry={reload} loadingText="Loading meetings…">
          {(meetings) =>
            meetings.length === 0 ? (
              <p className="text-sm text-slate-500">No meetings yet.</p>
            ) : (
              <ul className="space-y-3" aria-label="Meetings">
                {meetings.map((m) => (
                  <MeetingCard key={m.id} meeting={m} now={now} onChanged={reload} />
                ))}
              </ul>
            )
          }
        </StateView>
      </div>
    </div>
  )
}
