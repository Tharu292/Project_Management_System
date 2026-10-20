import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../api/client'

export type LoadState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/** Shown for a 503. The shared client never passes a server error's own text on, so only the status is used. */
export const UNAVAILABLE_MESSAGE = 'This service is not available right now. Please try again later.'

export function errorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    return caught.status === 503 ? UNAVAILABLE_MESSAGE : caught.message
  }
  return 'Something went wrong. Please try again.'
}

/**
 * Loads data once and again whenever `key` changes. `reload` fetches again and
 * keeps showing the current data meanwhile, like the admin pages do.
 */
export function useLoad<T>(load: () => Promise<T>, key: string): { state: LoadState<T>; reload: () => void } {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    load()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch((caught: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(caught) })
      })
    return () => {
      cancelled = true
    }
    // `load` is recreated on every render; `key` says when the request really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const reload = useCallback(() => setAttempt((current) => current + 1), [])
  return { state, reload }
}
