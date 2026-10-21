// Shared Tailwind class strings for the Component 3 pages. Kept local to the
// feature so the redesign never restyles shared or other components' pages.

export const panel = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60'
export const panelPadding = 'p-5 sm:p-6'
export const panelClass = `${panel} ${panelPadding}`

export const eyebrowClass = 'text-xs font-semibold tracking-wider text-indigo-600 uppercase'
export const sectionTitleClass = 'text-lg font-semibold tracking-tight text-slate-900'
export const mutedTextClass = 'text-sm text-slate-500'

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white ' +
  'shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 ' +
  focusRing

export const quietButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm ' +
  'font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed ' +
  'disabled:text-slate-400 ' + focusRing

export const violetButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white ' +
  'shadow-sm shadow-violet-600/20 hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300 ' +
  focusRing

export const linkTextClass = 'font-medium text-indigo-700 underline-offset-2 hover:underline ' + focusRing

export type Tone = 'indigo' | 'violet' | 'green' | 'amber' | 'slate' | 'red'

export const TONE_BADGE: Record<Tone, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/15',
  red: 'bg-red-50 text-red-700 ring-red-600/15',
}

export const TONE_ICON: Record<Tone, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  violet: 'bg-violet-50 text-violet-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  slate: 'bg-slate-100 text-slate-600',
  red: 'bg-red-50 text-red-600',
}
