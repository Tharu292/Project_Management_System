import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { vi } from 'vitest'
import App from '../App'
import { setToken } from '../auth/tokenStorage'
import { TEST_TOKEN } from './mockBackend'

// Shared by the tests that drive the whole app through its routes.

export const LOGIN = 'POST /api/v1/auth/login'
export const REGISTER = 'POST /api/v1/auth/register/student'
export const ME = 'GET /api/v1/auth/me'
export const CHANGE_PASSWORD = 'POST /api/v1/auth/change-password'
export const ADMIN_USERS = 'GET /api/v1/admin/users'
export const CREATE_STAFF = 'POST /api/v1/admin/users/staff'

export const CHANGE_REQUIRED_MESSAGE = 'You must change your password before continuing.'

export type TestUser = ReturnType<typeof userEvent.setup>

export function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** As after a page reload: a token is stored and the app must ask the backend who it belongs to. */
export function renderSignedInAt(path: string) {
  setToken(TEST_TOKEN)
  return renderAt(path)
}

export async function signIn(user: TestUser, email: string, password: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

export async function fillFields(user: TestUser, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    if (value !== '') {
      await user.type(screen.getByLabelText(label), value)
    }
  }
}

export function inputValue(label: string): string {
  return (screen.getByLabelText(label) as HTMLInputElement).value
}

export function spyOnConsole() {
  return (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
    vi.spyOn(console, level).mockImplementation(() => {}),
  )
}

export function everythingLogged(spies: ReturnType<typeof spyOnConsole>): string {
  return JSON.stringify(spies.flatMap((spy) => spy.mock.calls))
}
