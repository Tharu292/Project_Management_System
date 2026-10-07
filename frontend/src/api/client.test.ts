import { describe, expect, it, vi } from 'vitest'
import { getToken, removeToken, setToken } from '../auth/tokenStorage'
import { TEST_TOKEN, apiError, deferred, json, mockBackend } from '../test/mockBackend'
import { getCurrentUser, login } from './authApi'
import { API_BASE_URL, ApiError, apiRequest, setUnauthorizedHandler } from './client'

describe('token storage', () => {
  it('keeps the token in sessionStorage and never in localStorage', () => {
    setToken(TEST_TOKEN)

    expect(getToken()).toBe(TEST_TOKEN)
    expect(Object.values(sessionStorage)).toContain(TEST_TOKEN)
    expect(localStorage.length).toBe(0)

    removeToken()
    expect(getToken()).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })
})

describe('API client', () => {
  it('defaults to the local backend URL', () => {
    expect(API_BASE_URL).toBe('http://localhost:8080')
  })

  it('attaches the bearer token to authenticated requests only', async () => {
    setToken(TEST_TOKEN)
    const backend = mockBackend({
      'GET /api/v1/auth/me': () => json(200, {}),
      'POST /api/v1/auth/login': () => json(200, {}),
    })

    await getCurrentUser()
    await login({ email: 'a@my.sliit.lk', password: 'x' })

    expect(backend.callsTo('GET /api/v1/auth/me')[0].headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`)
    expect(backend.callsTo('POST /api/v1/auth/login')[0].headers.Authorization).toBeUndefined()
  })

  it('sends no Authorization header when there is no token', async () => {
    const backend = mockBackend({ 'GET /api/v1/auth/me': () => json(200, {}) })

    await getCurrentUser()

    expect(backend.calls[0].headers.Authorization).toBeUndefined()
  })

  it('on 401 for an authenticated request removes the token and notifies the auth state', async () => {
    setToken(TEST_TOKEN)
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    mockBackend({ 'GET /api/v1/auth/me': () => apiError(401, 'Authentication is required.') })

    await expect(getCurrentUser()).rejects.toMatchObject({ status: 401 })

    expect(getToken()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    setUnauthorizedHandler(null)
  })

  it('a late 401 for an old token does not remove a newer token', async () => {
    setToken('old.stale.token')
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    const pending = deferred()
    mockBackend({ 'GET /api/v1/auth/me': () => pending.promise })

    const staleRequest = getCurrentUser()
    setToken(TEST_TOKEN)
    pending.resolve(apiError(401, 'Authentication is required.'))

    await expect(staleRequest).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBe(TEST_TOKEN)
    expect(onUnauthorized).not.toHaveBeenCalled()
    setUnauthorizedHandler(null)
  })

  it('on 403 keeps the token and does not sign the user out', async () => {
    setToken(TEST_TOKEN)
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    mockBackend({ 'GET /api/v1/projects/x': () => apiError(403, 'You do not have permission to do this.') })

    await expect(apiRequest('/api/v1/projects/x', { auth: true })).rejects.toMatchObject({
      status: 403,
      message: 'You do not have permission to do this.',
    })

    expect(getToken()).toBe(TEST_TOKEN)
    expect(onUnauthorized).not.toHaveBeenCalled()
    setUnauthorizedHandler(null)
  })

  it('a failed login (401 on a public request) does not disturb an existing session', async () => {
    setToken(TEST_TOKEN)
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    mockBackend({ 'POST /api/v1/auth/login': () => apiError(401, 'Invalid email or password.') })

    await expect(login({ email: 'a@my.sliit.lk', password: 'x' })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password.',
    })

    expect(getToken()).toBe(TEST_TOKEN)
    expect(onUnauthorized).not.toHaveBeenCalled()
    setUnauthorizedHandler(null)
  })

  it('exposes backend validation messages per field', async () => {
    mockBackend({
      'POST /api/v1/auth/login': () => apiError(400, 'Validation failed.', { email: 'must not be blank' }),
    })

    const error = await login({ email: '', password: '' }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'Validation failed.', fieldErrors: { email: 'must not be blank' } })
  })

  it('never passes server-error detail through', async () => {
    mockBackend({
      'GET /api/v1/auth/me': () =>
        json(500, { message: 'org.postgresql.util.PSQLException: relation "users"', trace: 'at com.example...' }),
    })

    const error = (await getCurrentUser().catch((caught: unknown) => caught)) as ApiError

    expect(error.status).toBe(500)
    expect(error.message).toBe('Something went wrong. Please try again.')
    expect(JSON.stringify(error)).not.toContain('PSQLException')
  })

  it('reports an unreachable server without throwing a raw network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(getCurrentUser()).rejects.toMatchObject({
      status: 0,
      message: 'Cannot reach the server. Check your connection and try again.',
    })
  })

  it('falls back to a safe message when the error body is not JSON', async () => {
    mockBackend({ 'GET /api/v1/auth/me': () => new Response('<html>Bad gateway</html>', { status: 404 }) })

    await expect(getCurrentUser()).rejects.toMatchObject({ status: 404, message: 'Not found.' })
  })
})
