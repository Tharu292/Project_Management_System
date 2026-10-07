import { vi } from 'vitest'
import type { User } from '../auth/types'

// A stand-in for the Spring Boot API: tests replace `fetch` and answer with
// the same JSON shapes the real backend returns. Nothing here is a real credential.

export const TEST_TOKEN = 'test.access.token'
export const TEST_PASSWORD = 'Example-Passw0rd'

export const student: User = {
  id: '11111111-2222-3333-4444-555555555555',
  firstName: 'Test',
  lastName: 'Student',
  email: 'it00000000@my.sliit.lk',
  accountType: 'STUDENT',
  systemRole: 'USER',
  registrationNumber: 'IT00000000',
  staffId: null,
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export function apiError(status: number, message: string, fieldErrors: Record<string, string> = {}): Response {
  return json(status, { timestamp: '2026-01-01T00:00:00Z', status, error: 'Error', message, path: '/', fieldErrors })
}

export interface RecordedCall {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

type Handler = (call: RecordedCall) => Response | Promise<Response>

/** Installs a fake `fetch`. Keys look like "POST /api/v1/auth/login". */
export function mockBackend(routes: Record<string, Handler>) {
  const calls: RecordedCall[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: RecordedCall = {
      method: init?.method ?? 'GET',
      path: new URL(String(input)).pathname,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)
    const handler = routes[`${call.method} ${call.path}`]
    if (!handler) {
      throw new Error(`Unexpected request: ${call.method} ${call.path}`)
    }
    return handler(call)
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    calls,
    callsTo: (key: string) => calls.filter((call) => `${call.method} ${call.path}` === key),
  }
}

/** A response the test releases by hand, to observe the in-between state. */
export function deferred() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
