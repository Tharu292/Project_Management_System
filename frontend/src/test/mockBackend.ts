import { vi } from 'vitest'
import type { AdminUser, User } from '../auth/types'

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
  mustChangePassword: false,
}

/** An ordinary staff account that has already replaced its temporary password. */
export const staff: User = {
  id: '22222222-3333-4444-5555-666666666666',
  firstName: 'Test',
  lastName: 'Lecturer',
  email: 'test.lecturer@sliit.lk',
  accountType: 'STAFF',
  systemRole: 'USER',
  registrationNumber: null,
  staffId: 'STF-0001',
  mustChangePassword: false,
}

export const admin: User = {
  id: '33333333-4444-5555-6666-777777777777',
  firstName: 'System',
  lastName: 'Administrator',
  email: 'admin@sliit.lk',
  accountType: 'STAFF',
  systemRole: 'ADMIN',
  registrationNumber: null,
  staffId: null,
  mustChangePassword: false,
}

/** As the backend returns them straight after an administrator, or the bootstrap, created the account. */
export const flaggedStaff: User = { ...staff, mustChangePassword: true }
export const flaggedAdmin: User = { ...admin, mustChangePassword: true }

function asAdminUser(user: User, enabled: boolean, createdAt: string): AdminUser {
  return { ...user, enabled, createdAt }
}

export const newStaffAccount: AdminUser = asAdminUser(
  {
    ...staff,
    id: '44444444-5555-6666-7777-888888888888',
    firstName: 'New',
    lastName: 'Lecturer',
    email: 'new.lecturer@sliit.lk',
    staffId: 'STF-0002',
    mustChangePassword: true,
  },
  true,
  '2026-10-07T09:00:00Z',
)

export const disabledStudent: AdminUser = asAdminUser(
  {
    ...student,
    id: '55555555-6666-7777-8888-999999999999',
    firstName: 'Former',
    lastName: 'Member',
    email: 'it11111111@my.sliit.lk',
    registrationNumber: 'IT11111111',
  },
  false,
  '2026-10-06T09:00:00Z',
)

/** GET /api/v1/admin/users: 5 accounts, 2 students, 3 staff, 4 enabled, 1 disabled, 1 password change pending. */
export const adminUserList: AdminUser[] = [
  asAdminUser(admin, true, '2026-10-01T09:00:00Z'),
  asAdminUser(student, true, '2026-10-02T09:00:00Z'),
  asAdminUser(staff, true, '2026-10-03T09:00:00Z'),
  disabledStudent,
  newStaffAccount,
]

export function loginResponse(user: User): Response {
  return json(200, { accessToken: TEST_TOKEN, tokenType: 'Bearer', expiresIn: 3600, user })
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
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
