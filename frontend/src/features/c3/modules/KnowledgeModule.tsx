import { useState, type FormEvent } from 'react'
import Alert from '../../../components/Alert'
import FormField from '../../../components/FormField'
import { createResource, listResources } from '../api/c3Api'
import type { ResearchResource, ResourceType } from '../api/types'
import { useLoad } from '../api/useLoad'
import StateView from '../components/StateView'
import { SelectField, TextAreaField } from '../components/fields'
import { type ProjectAccess, formError, formatDateTime } from '../display'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import Collapsible from '../ui/Collapsible'
import EmptyState from '../ui/EmptyState'
import FilterChips from '../ui/FilterChips'
import Icon, { type IconName } from '../ui/Icon'
import { TONE_ICON, panel, primaryButtonClass, quietButtonClass, type Tone } from '../ui/styles'

const TYPES: Record<ResourceType, { label: string; icon: IconName; tone: Tone }> = {
  PAPER: { label: 'Paper', icon: 'paper', tone: 'indigo' },
  LINK: { label: 'Link', icon: 'link', tone: 'slate' },
  NOTE: { label: 'Note', icon: 'note', tone: 'amber' },
  DATASET: { label: 'Dataset', icon: 'database', tone: 'green' },
  DOCUMENT: { label: 'Document', icon: 'document', tone: 'violet' },
}
const TYPE_OPTIONS = (Object.keys(TYPES) as ResourceType[]).map((value) => ({ value, label: TYPES[value].label }))

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

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
    <form onSubmit={submit} className="space-y-3" aria-label="Add a resource">
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
      <button type="submit" className={primaryButtonClass} disabled={saving}>
        <Icon name="plus" className="size-4" />
        {saving ? 'Saving…' : 'Add resource'}
      </button>
    </form>
  )
}

function ResourceCard({ resource }: { resource: ResearchResource }) {
  const type = TYPES[resource.type]
  return (
    <li className={`${panel} flex h-full flex-col p-5`}>
      <div className="flex items-start gap-3">
        <span className={'inline-flex size-10 shrink-0 items-center justify-center rounded-xl ' + TONE_ICON[type.tone]}>
          <Icon name={type.icon} className="size-5" />
        </span>
        <div className="min-w-0">
          <Badge tone={type.tone}>{type.label}</Badge>
          <h4 className="mt-1.5 font-semibold text-slate-900">{resource.title}</h4>
          {resource.url && <p className="text-xs text-slate-500">{hostname(resource.url)}</p>}
        </div>
      </div>
      {resource.description && (
        <p className="mt-3 line-clamp-4 text-sm whitespace-pre-wrap text-slate-700">{resource.description}</p>
      )}
      {resource.url && (
        <a href={resource.url} target="_blank" rel="noreferrer noopener"
          className="mt-3 inline-flex min-w-0 items-center gap-1.5 text-sm text-indigo-700 hover:underline">
          <Icon name="link" className="size-4" />
          <span className="truncate">{resource.url}</span>
        </a>
      )}
      <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-slate-500">
        <Avatar id={resource.addedBy.id} name={resource.addedBy.name} size="sm" />
        <span>
          Added by {resource.addedBy.name} · {formatDateTime(resource.createdAt)}
        </span>
      </div>
    </li>
  )
}

export default function KnowledgeModule({ projectId, access }: { projectId: string; access: ProjectAccess }) {
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<{ q: string; type: ResourceType | '' }>({ q: '', type: '' })
  const { state, reload } = useLoad(
    () => listResources(projectId, filter.q || undefined, filter.type || undefined),
    `resources-${projectId}-${filter.q}-${filter.type}`,
  )
  const filtered = Boolean(filter.q || filter.type)

  function search(event: FormEvent) {
    event.preventDefault()
    setFilter({ ...filter, q: draft.trim() })
  }

  return (
    <div className="space-y-6">
      <div className={`${panel} space-y-4 p-5`}>
        <form onSubmit={search} role="search" aria-label="Search resources" className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <FormField id="resource-search" label="Search" value={draft} placeholder="Title, description or address"
              onChange={(e) => setDraft(e.target.value)} maxLength={200} />
          </div>
          <button type="submit" className={quietButtonClass + ' mb-0.5'}>
            <Icon name="search" className="size-4" />
            Search
          </button>
        </form>
        <FilterChips label="Filter by type" value={filter.type}
          onChange={(type) => setFilter({ ...filter, type })}
          options={[{ value: '' as const, label: 'All types' }, ...TYPE_OPTIONS]} />
      </div>
      <StateView state={state} retry={reload} loadingText="Loading resources…">
        {(resources) => (
          <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
            <div>
              {access.isTeam ? (
                <Collapsible icon="plus" title="Add a resource" defaultOpen={resources.length === 0 && !filtered}>
                  <NewResourceForm projectId={projectId} onCreated={reload} />
                </Collapsible>
              ) : (
                <p className="flex items-start gap-2 text-sm text-slate-600">
                  <Icon name="info" className="mt-0.5 size-4 text-indigo-500" />
                  You can read and search the repository. The supervision team adds resources.
                </p>
              )}
            </div>
            <div className="min-w-0">
              <p className="mb-3 text-sm text-slate-500">
                {resources.length} {resources.length === 1 ? 'resource' : 'resources'}
                {filtered ? ' match the search' : ' in this project'}
              </p>
              {resources.length === 0 ? (
                filtered ? (
                  <EmptyState icon="search" title="No resources match the search.">Try other words or another type.</EmptyState>
                ) : (
                  <EmptyState icon="book" title="No resources yet.">Papers, links, notes and datasets added by the team appear here.</EmptyState>
                )
              ) : (
                <ul className="grid gap-4 md:grid-cols-2" aria-label="Resources">
                  {resources.map((r) => <ResourceCard key={r.id} resource={r} />)}
                </ul>
              )}
            </div>
          </div>
        )}
      </StateView>
    </div>
  )
}
