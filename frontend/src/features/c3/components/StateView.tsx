import type { ReactNode } from 'react'
import Alert from '../../../components/Alert'
import { secondaryButtonClass } from '../../../components/AppShell'
import type { LoadState } from '../api/useLoad'

/** Shows loading, an error with a retry button, or the loaded data. */
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
      <p role="status" className="text-sm text-slate-600">
        {loadingText}
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="space-y-3">
        <Alert tone="error">{state.message}</Alert>
        <button type="button" onClick={retry} className={secondaryButtonClass}>
          Try again
        </button>
      </div>
    )
  }
  return <>{children(state.data)}</>
}
