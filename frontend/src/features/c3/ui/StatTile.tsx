import type { ReactNode } from 'react'
import { Link } from 'react-router'
import Icon, { type IconName } from './Icon'
import { TONE_ICON, focusRing, panel, type Tone } from './styles'

/**
 * One number with its label. Used only for values that come from the backend:
 * counts of current records or measured model scores, never estimates.
 */
export default function StatTile({
  icon,
  tone = 'indigo',
  label,
  value,
  detail,
  to,
}: {
  icon: IconName
  tone?: Tone
  label: string
  value: ReactNode
  detail?: ReactNode
  to?: string
}) {
  const body = (
    <>
      <span className={'inline-flex size-10 items-center justify-center rounded-xl ' + TONE_ICON[tone]}>
        <Icon name={icon} className="size-5" />
      </span>
      <span className="mt-3 block text-3xl font-semibold tracking-tight text-slate-900">{value}</span>
      <span className="mt-1 block text-sm font-medium text-slate-700">{label}</span>
      {detail && <span className="mt-1 block text-xs text-slate-500">{detail}</span>}
    </>
  )
  const base = `${panel} block h-full p-5`
  return to ? (
    <Link to={to} className={`${base} transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md ${focusRing}`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}
