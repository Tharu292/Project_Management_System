import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import FormField from '../../../components/FormField'
import { createMeeting, listMeetings, recordMinutes } from '../api/c3Api'
import type { Meeting } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { TextAreaField } from '../components/fields'
import { formError, formatDateTime } from '../display'
import Badge from '../ui/Badge'
import Collapsible from '../ui/Collapsible'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import { panel, primaryButtonClass, quietButtonClass, sectionTitleClass } from '../ui/styles'

type FormProblem = { message: string; fields: Record<string, string> } | null

const month = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const timeOfDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })

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
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" aria-label="Schedule a meeting">
      {error && <div className="sm:col-span-2"><Alert tone="error">{error.message}</Alert></div>}
      <div className="sm:col-span-2">
        <FormField id="meeting-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)}
          maxLength={200} required error={error?.fields.title} />
      </div>
      <FormField id="meeting-when" label="Date and time" type="datetime-local" value={when}
        onChange={(e) => setWhen(e.target.value)} required error={error?.fields.scheduledAt} />
      <FormField id="meeting-duration" label="Duration (minutes)" type="number" min={1} max={1440} value={duration}
        onChange={(e) => setDuration(e.target.value)} error={error?.fields.durationMinutes} />
      <div className="sm:col-span-2">
        <FormField id="meeting-location" label="Location or meeting link" value={location}
          onChange={(e) => setLocation(e.target.value)} maxLength={500} error={error?.fields.location} />
      </div>
      <div className="sm:col-span-2">
        <TextAreaField id="meeting-agenda" label="Agenda" rows={3} value={agenda}
          onChange={(e) => setAgenda(e.target.value)} maxLength={5000} error={error?.fields.agenda} />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className={primaryButtonClass} disabled={saving}>
          <Icon name="calendar" className="size-4" />
          {saving ? 'Saving…' : 'Schedule meeting'}
        </button>
      </div>
    </form>
  )
}

function MinutesForm({ meeting, onRecorded }: { meeting: Meeting; onRecorded: () => void }) {
  const [open, setOpen] = useState(false)
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

  if (!open) {
    return (
      <button type="button" className={quietButtonClass + ' mt-4'} onClick={() => setOpen(true)}>
        <Icon name="note" className="size-4" />
        Record minutes
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4" aria-label={`Minutes for ${meeting.title}`}>
      {error && <Alert tone="error">{error.message}</Alert>}
      <TextAreaField id={`minutes-${meeting.id}`} label="Minutes" rows={4} value={minutes}
        onChange={(e) => setMinutes(e.target.value)} maxLength={10000} required error={error?.fields.minutes}
        hint="Decisions, agreed actions and who does them. Minutes can be recorded once." />
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass} disabled={saving}>
          {saving ? 'Saving…' : 'Save minutes'}
        </button>
        <button type="button" className={quietButtonClass} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function MeetingCard({ meeting, now, onChanged }: { meeting: Meeting; now: number; onChanged: () => void }) {
  const at = new Date(meeting.scheduledAt)
  const started = at.getTime() <= now
  return (
    <li className={`${panel} flex gap-4 p-5`}>
      <div className={
        'flex w-16 shrink-0 flex-col items-center justify-center self-start rounded-xl py-2 ' +
        (started ? 'bg-slate-100 text-slate-600' : 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20')
      }>
        <span className="text-xs font-semibold uppercase">{month.format(at)}</span>
        <span className="text-2xl leading-none font-semibold">{at.getDate()}</span>
        <span className="mt-0.5 text-[11px] opacity-80">{at.getFullYear()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h4 className="font-semibold text-slate-900">{meeting.title}</h4>
          {meeting.minutes ? (
            <Badge tone="green" icon="check">Minutes recorded</Badge>
          ) : started ? (
            <Badge tone="amber" icon="hourglass">Minutes pending</Badge>
          ) : (
            <Badge tone="indigo" icon="calendar">Upcoming</Badge>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" className="size-4 text-slate-400" />
            {timeOfDay.format(at)}
            {meeting.durationMinutes ? ` · ${meeting.durationMinutes} min` : ''}
          </span>
          {meeting.location && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Icon name={isWebAddress(meeting.location) ? 'link' : 'pin'} className="size-4 text-slate-400" />
              {isWebAddress(meeting.location) ? (
                <a href={meeting.location} target="_blank" rel="noreferrer noopener" className="truncate text-indigo-700 underline">
                  {meeting.location}
                </a>
              ) : (
                meeting.location
              )}
            </span>
          )}
        </p>
        {meeting.agenda && (
          <p className="mt-3 text-sm whitespace-pre-wrap text-slate-700">
            <span className="font-semibold text-slate-900">Agenda: </span>
            {meeting.agenda}
          </p>
        )}
        {meeting.minutes ? (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-xs font-semibold text-emerald-800">
              Minutes · {meeting.minutesRecordedBy?.name} · {formatDateTime(meeting.minutesRecordedAt ?? meeting.createdAt)}
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-slate-800">{meeting.minutes}</p>
          </div>
        ) : (
          started && <MinutesForm meeting={meeting} onRecorded={onChanged} />
        )}
        <p className="mt-3 text-xs text-slate-400">Scheduled by {meeting.createdBy.name}</p>
      </div>
    </li>
  )
}

export default function MeetingsModule({ projectId }: { projectId: string }) {
  const { state, reload } = useLoad(() => listMeetings(projectId), `meetings-${projectId}`)
  // Taken once per visit, so the page does not change between renders.
  const [now] = useState(() => Date.now())
  return (
    <StateView state={state} retry={reload} loadingText="Loading meetings…">
      {(meetings) => {
        const upcoming = meetings.filter((m) => new Date(m.scheduledAt).getTime() > now).reverse()
        const past = meetings.filter((m) => new Date(m.scheduledAt).getTime() <= now)
        return (
          <div className="space-y-8">
            <Collapsible icon="plus" title="Schedule a meeting" defaultOpen={meetings.length === 0}>
              <NewMeetingForm projectId={projectId} onCreated={reload} />
            </Collapsible>
            {meetings.length === 0 ? (
              <EmptyState icon="calendar" title="No meetings yet.">Schedule the first supervision meeting above.</EmptyState>
            ) : (
              <>
                <section aria-labelledby="upcoming-heading">
                  <h3 id="upcoming-heading" className={sectionTitleClass + ' mb-3 flex items-center gap-2'}>
                    Upcoming <Badge tone="indigo">{String(upcoming.length)}</Badge>
                  </h3>
                  {upcoming.length === 0 ? (
                    <p className="text-sm text-slate-500">No upcoming meetings.</p>
                  ) : (
                    <ul className="space-y-3" aria-label="Upcoming meetings">
                      {upcoming.map((m) => <MeetingCard key={m.id} meeting={m} now={now} onChanged={reload} />)}
                    </ul>
                  )}
                </section>
                <section aria-labelledby="past-heading">
                  <h3 id="past-heading" className={sectionTitleClass + ' mb-3 flex items-center gap-2'}>
                    Meeting history <Badge tone="slate">{String(past.length)}</Badge>
                  </h3>
                  {past.length === 0 ? (
                    <p className="text-sm text-slate-500">No past meetings yet.</p>
                  ) : (
                    <ul className="space-y-3" aria-label="Past meetings">
                      {past.map((m) => <MeetingCard key={m.id} meeting={m} now={now} onChanged={reload} />)}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        )
      }}
    </StateView>
  )
}
