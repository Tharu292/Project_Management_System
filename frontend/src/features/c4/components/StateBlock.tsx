import type { ReactNode } from 'react'

export type StateKind = 'loading' | 'empty' | 'error' | 'unavailable' | 'unauthorized'

const KIND_CLASSES: Record<StateKind, string> = {
  loading: 'border-slate-200 bg-white text-slate-600',
  empty: 'border-slate-200 bg-white text-slate-600',
  error: 'border-red-200 bg-red-50 text-red-800',
  unavailable: 'border-slate-300 border-dashed bg-slate-50 text-slate-600',
  unauthorized: 'border-amber-200 bg-amber-50 text-amber-900',
}

interface StateBlockProps {
  kind: StateKind
  title: string
  /** A sentence or two explaining the state. */
  children?: ReactNode
  /** A button or link offering the next step, for example "Try again". */
  action?: ReactNode
}

/**
 * The one way a Component 4 page says it has nothing to show: still loading,
 * nothing there, failed, not available, or not allowed. Each looks different,
 * and none of them ever stands in for data.
 */
export default function StateBlock({ kind, title, children, action }: StateBlockProps) {
  const role = kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined

  return (
    <div role={role} className={`rounded-xl border px-4 py-8 text-center ${KIND_CLASSES[kind]}`}>
      <p className="flex items-center justify-center gap-3 text-base font-semibold">
        {kind === 'loading' && (
          <span
            aria-hidden="true"
            className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
          />
        )}
        {title}
      </p>
      {children && <div className="mx-auto mt-2 max-w-xl text-sm">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
