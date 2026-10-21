import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'

/** A friendly placeholder for an empty list. The message is plain text so it can be found by assistive tech and tests. */
export default function EmptyState({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <Icon name={icon} className="size-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-500">{children}</div>}
    </div>
  )
}
