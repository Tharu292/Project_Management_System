import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../../api/client'

export type LoadState<T> =
  | { status: 'loading' }
  /** `httpStatus` is 0 when the server could not be reached. */
  | { status: 'error'; message: string; httpStatus: number }
  | { status: 'ready'; data: T }

interface Settled<T> {
  loader: () => Promise<T>
  attempt: number
  state: LoadState<T>
}

/**
 * Loads data for a page and reports exactly one of: loading, failed, or
 * ready. Pass a loader wrapped in `useCallback`; when it changes, or `retry`
 * is called, the data is loaded again. A failure stays a failure: nothing is
 * substituted for data that could not be loaded.
 */
export function useLoad<T>(loader: () => Promise<T>): { state: LoadState<T>; retry: () => void } {
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loader()
      .then((data) => {
        if (!cancelled) setSettled({ loader, attempt, state: { status: 'ready', data } })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        const state: LoadState<T> =
          caught instanceof ApiError
            ? { status: 'error', message: caught.message, httpStatus: caught.status }
            : { status: 'error', message: 'Something went wrong. Please try again.', httpStatus: 0 }
        setSettled({ loader, attempt, state })
      })
    return () => {
      cancelled = true
    }
  }, [loader, attempt])

  const retry = useCallback(() => setAttempt((current) => current + 1), [])

  // A result belongs to the request that produced it. Until the current request settles, the page is loading.
  const state: LoadState<T> =
    settled !== null && settled.loader === loader && settled.attempt === attempt ? settled.state : { status: 'loading' }

  return { state, retry }
}
