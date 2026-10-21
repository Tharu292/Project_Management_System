import { focusRing } from './styles'

/** A row of toggle buttons for filtering a list in the browser. */
export default function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ' +
              focusRing +
              ' ' +
              (active
                ? 'bg-indigo-600 text-white ring-indigo-600'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900')
            }
          >
            {option.label}
            {option.count !== undefined && (
              <span className={'rounded-full px-1.5 text-[11px] ' + (active ? 'bg-white/20' : 'bg-slate-100')}>
                {option.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
