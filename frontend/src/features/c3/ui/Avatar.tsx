const COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Initials of a person; the colour is derived from their id so it stays the same everywhere. */
export default function Avatar({ id, name, size = 'md' }: { id: string; name: string; size?: 'sm' | 'md' }) {
  const hash = [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return (
    <span
      aria-hidden="true"
      className={
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold ' +
        (size === 'sm' ? 'size-7 text-[11px] ' : 'size-9 text-xs ') +
        COLORS[hash % COLORS.length]
      }
    >
      {initials(name)}
    </span>
  )
}
