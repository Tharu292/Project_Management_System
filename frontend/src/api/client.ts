import { getToken, removeToken } from '../auth/tokenStorage'

// Public configuration only: VITE_ variables are shipped to the browser.
const configuredBaseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL
export const API_BASE_URL = (configuredBaseUrl || 'http://localhost:8080').replace(/\/+$/, '')

/** A failed API call, reduced to what is safe to show a user. */
export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached. */
  readonly status: number
  /** Per-field validation messages from the backend; empty when there are none. */
  readonly fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'The request was not valid.',
  401: 'Please sign in to continue.',
  403: 'You do not have permission to do this.',
  404: 'Not found.',
  409: 'This conflicts with existing data.',
}
const UNEXPECTED = 'Something went wrong. Please try again.'
const UNREACHABLE = 'Cannot reach the server. Check your connection and try again.'

let unauthorizedHandler: (() => void) | null = null

/** Lets the auth state react when an authenticated request is rejected with 401. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

/** The one authenticated endpoint that never answers 403: it is how the app re-checks who the user is. */
export const CURRENT_USER_PATH = '/api/v1/auth/me'

let forbiddenHandler: (() => void) | null = null

/**
 * Lets the auth state re-check the user when an authenticated request is
 * rejected with 403: the account may have changed since it was loaded.
 */
export function setForbiddenHandler(handler: (() => void) | null): void {
  forbiddenHandler = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Attach the stored bearer token. Leave false for public endpoints. */
  auth?: boolean
}

/**
 * The single place that talks to the backend. With `auth`, the bearer token is
 * attached here; a 401 on such a request means the token is no longer valid,
 * so it is removed and the auth state is told. A 403 leaves the session alone:
 * the user is still signed in, just not allowed to do that one thing. The auth
 * state is told so it can re-check the user, but nobody is signed out.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const sentToken = auth ? getToken() : null
  if (sentToken) {
    headers.Authorization = `Bearer ${sentToken}`
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, UNREACHABLE)
  }

  if (response.ok) {
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T)
  }

  const error = await toApiError(response)
  // Only when the rejected token is still the stored one: a late answer to an
  // old token must not sign out a session that was started in the meantime.
  if (response.status === 401 && auth && getToken() === sentToken) {
    removeToken()
    unauthorizedHandler?.()
  }
  if (response.status === 403 && auth && path !== CURRENT_USER_PATH && getToken() === sentToken) {
    forbiddenHandler?.()
  }
  throw error
}

/** Uses the backend's client-safe message for 4xx; never passes server-error detail through. */
async function toApiError(response: Response): Promise<ApiError> {
  const status = response.status
  if (status >= 500) {
    return new ApiError(status, UNEXPECTED)
  }
  let message = FALLBACK_MESSAGES[status] ?? UNEXPECTED
  const fieldErrors: Record<string, string> = {}
  try {
    const body: unknown = await response.json()
    if (body !== null && typeof body === 'object') {
      const { message: backendMessage, fieldErrors: backendFieldErrors } = body as Record<string, unknown>
      if (typeof backendMessage === 'string' && backendMessage.trim() !== '') {
        message = backendMessage
      }
      if (backendFieldErrors !== null && typeof backendFieldErrors === 'object') {
        for (const [field, text] of Object.entries(backendFieldErrors)) {
          if (typeof text === 'string') {
            fieldErrors[field] = text
          }
        }
      }
    }
  } catch {
    // Not JSON: keep the fallback message.
  }
  return new ApiError(status, message, fieldErrors)
}
