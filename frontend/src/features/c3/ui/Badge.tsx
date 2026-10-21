import Icon, { type IconName } from './Icon'
import { TONE_BADGE, type Tone } from './styles'

/** A status or role label. Meaning is always carried by the text (and an icon), never by colour alone. */
export default function Badge({ tone = 'slate', icon, children }: { tone?: Tone; icon?: IconName; children: string }) {
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset ' +
        TONE_BADGE[tone]
      }
    >
      {icon && <Icon name={icon} className="size-3.5" />}
      {children}
    </span>
  )
}
