import { useId, useState, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import { focusRing, panel } from './styles'

/** A panel whose content (usually a form) opens from a header button, to keep pages uncluttered. */
export default function Collapsible({
  icon,
  title,
  defaultOpen = false,
  children,
}: {
  icon: IconName
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  return (
    <div className={panel}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
        className={'flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left hover:bg-slate-50/80 ' + focusRing}
      >
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/20">
          <Icon name={icon} className="size-5" />
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-900">{title}</span>
        <Icon name="chevronDown" className={'size-5 text-slate-400 transition ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && (
        <div id={contentId} className="border-t border-slate-100 px-5 pt-4 pb-5">
          {children}
        </div>
      )}
    </div>
  )
}
