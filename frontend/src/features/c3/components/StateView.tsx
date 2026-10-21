import type { ReactNode } from 'react'
import Alert from '../../../components/Alert'
import type { LoadState } from '../api/useLoad'
import { quietButtonClass } from '../ui/styles'

/** Shows a loading placeholder, an error with a retry button, or the loaded data. */
export default function StateView<T>({
  state,
  retry,
  loadingText,
  children,
}: {
  state: LoadState<T>
  retry: () => void
  loadingText: string
  children: (data: T) => ReactNode
}) {
  if (state.status === 'loading') {
    return (
      <div role="status" className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
          {loadingText}
        </p>
        <div aria-hidden="true" className="space-y-2">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100/70" />
        </div>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="space-y-3">
        <Alert tone="error">{state.message}</Alert>
        <button type="button" onClick={retry} className={quietButtonClass}>
          Try again
        </button>
      </div>
    )
  }
  return <>{children(state.data)}</>
}
