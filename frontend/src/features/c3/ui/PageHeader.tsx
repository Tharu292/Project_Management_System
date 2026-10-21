import type { ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import { TONE_ICON, type Tone } from './styles'

/** The title block of a C3 page: icon, label, title, description and optional actions. */
export default function PageHeader({
  icon,
  tone = 'indigo',
  eyebrow,
  title,
  description,
  actions,
}: {
  icon: IconName
  tone?: Tone
  eyebrow: string
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        <span className={'hidden size-12 items-center justify-center rounded-2xl sm:inline-flex ' + TONE_ICON[tone]}>
          <Icon name={icon} className="size-6" />
        </span>
        <div className="min-w-0">
          <p className={'text-xs font-semibold tracking-wider uppercase ' + (tone === 'violet' ? 'text-violet-600' : 'text-indigo-600')}>
            {eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {description && <div className="mt-2 max-w-3xl text-sm text-slate-600 sm:text-base">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
