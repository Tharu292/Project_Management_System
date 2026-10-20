import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import { actionButtonClass, secondaryButtonClass } from '../../../components/AppShell'
import FormField from '../../../components/FormField'
import { createResource, listResources } from '../api/c3Api'
import type { ResourceType } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { SelectField, TextAreaField } from '../components/fields'
import { type ProjectAccess, cardClass, formError, formatDateTime } from '../display'

const TYPE_LABELS: Record<ResourceType, string> = {
  PAPER: 'Paper',
  LINK: 'Link',
  NOTE: 'Note',
  DATASET: 'Dataset',
  DOCUMENT: 'Document',
}
const TYPE_OPTIONS = (Object.keys(TYPE_LABELS) as ResourceType[]).map((value) => ({ value, label: TYPE_LABELS[value] }))

function NewResourceForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [type, setType] = useState<ResourceType>('PAPER')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<{ message: string; fields: Record<string, string> } | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createResource(projectId, { type, title, url: url || undefined, description: description || undefined })
      setTitle('')
      setUrl('')
      setDescription('')
      onCreated()
    } catch (caught) {
      setError(formError(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={cardClass + ' space-y-3'} aria-label="Add a resource">
      <h3 className="font-semibold text-slate-900">Add a resource</h3>
      {error && <Alert tone="error">{error.message}</Alert>}
      <SelectField id="resource-type" label="Type" value={type} onChange={(e) => setType(e.target.value as ResourceType)}
        options={TYPE_OPTIONS} error={error?.fields.type} />
      <FormField id="resource-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)}
        maxLength={300} required error={error?.fields.title} />
      <FormField id="resource-url" label="Web address" type="url" placeholder="https://" value={url}
        onChange={(e) => setUrl(e.target.value)} maxLength={2000} error={error?.fields.url}
        hint={type === 'DOCUMENT' ? 'Link to the document, for example in shared storage. File upload is not available yet.' : undefined} />
      <TextAreaField id="resource-description" label={type === 'NOTE' ? 'Note' : 'Description'} rows={3}
        value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000}
        error={error?.fields.description} />
      <button type="submit" className={actionButtonClass} disabled={saving}>
        {saving ? 'Saving…' : 'Add resource'}
      </button>
    </form>
  )
}

export default function KnowledgeModule({ projectId, access }: { projectId: string; access: ProjectAccess }) {
  const [draft, setDraft] = useState({ q: '', type: '' })
  const [filter, setFilter] = useState({ q: '', type: '' })
  const { state, reload } = useLoad(
    () => listResources(projectId, filter.q || undefined, (filter.type || undefined) as ResourceType | undefined),
    `resources-${projectId}-${filter.q}-${filter.type}`,
  )

  function search(event: FormEvent) {
    event.preventDefault()
    setFilter({ q: draft.q.trim(), type: draft.type })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <div>
        {access.isTeam ? (
          <NewResourceForm projectId={projectId} onCreated={reload} />
        ) : (
          <p className="text-sm text-slate-600">You can read and search the repository. The supervision team adds resources.</p>
        )}
      </div>
      <div>
        <form onSubmit={search} role="search" aria-label="Search resources" className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <FormField id="resource-search" label="Search" value={draft.q} placeholder="Title, description or address"
              onChange={(e) => setDraft({ ...draft, q: e.target.value })} maxLength={200} />
          </div>
          <div className="w-40">
            <SelectField id="resource-filter" label="Type" value={draft.type}
              onChange={(e) => setDraft({ ...draft, type: e.target.value })}
              options={[{ value: '', label: 'All types' }, ...TYPE_OPTIONS]} />
          </div>
          <button type="submit" className={secondaryButtonClass + ' mb-0.5'}>
            Search
          </button>
        </form>
        <div className="mt-4">
          <StateView state={state} retry={reload} loadingText="Loading resources…">
            {(resources) =>
              resources.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {filter.q || filter.type ? 'No resources match the search.' : 'No resources yet.'}
                </p>
              ) : (
                <ul className="space-y-3" aria-label="Resources">
                  {resources.map((r) => (
                    <li key={r.id} className={cardClass}>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {TYPE_LABELS[r.type]}
                        </span>
                        <h3 className="font-semibold text-slate-900">{r.title}</h3>
                      </div>
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noreferrer noopener"
                          className="mt-1 block text-sm break-all text-indigo-700 underline">
                          {r.url}
                        </a>
                      )}
                      {r.description && <p className="mt-2 text-sm whitespace-pre-wrap text-slate-800">{r.description}</p>}
                      <p className="mt-2 text-xs text-slate-400">
                        Added by {r.addedBy.name} · {formatDateTime(r.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            }
          </StateView>
        </div>
      </div>
    </div>
  )
}
