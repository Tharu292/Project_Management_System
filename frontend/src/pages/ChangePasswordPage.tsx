import { useState, type ChangeEvent, type FormEvent } from 'react'
import { changePassword } from '../api/authApi'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { PASSWORDS_DO_NOT_MATCH, PASSWORD_REQUIREMENTS, newPasswordProblem } from '../auth/passwordPolicy'
import type { ChangePasswordRequest } from '../auth/types'
import Alert from '../components/Alert'
import AuthLayout, { linkClass, primaryButtonClass } from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'

const EMPTY_FORM: ChangePasswordRequest = { currentPassword: '', newPassword: '', confirmPassword: '' }

type FieldErrors = Partial<Record<keyof ChangePasswordRequest, string>>

/** The same checks the backend makes, so most mistakes are caught before a request is sent. */
function validate(form: ChangePasswordRequest): FieldErrors {
  const errors: FieldErrors = {}
  if (form.currentPassword === '') {
    errors.currentPassword = 'Enter your current password.'
  }
  const problem = newPasswordProblem(form.newPassword)
  if (problem) {
    errors.newPassword = problem
  } else if (form.newPassword === form.currentPassword) {
    errors.newPassword = 'New password must be different from the current password.'
  }
  if (form.confirmPassword !== form.newPassword) {
    errors.confirmPassword = PASSWORDS_DO_NOT_MATCH
  }
  return errors
}

/**
 * The only page open to a user whose password was chosen by someone else.
 * A successful change invalidates the token on the backend, so the session
 * is dropped here and the user signs in again with the new password.
 */
export default function ChangePasswordPage() {
  const { user, logout, finishPasswordChange } = useAuth()
  const [form, setForm] = useState<ChangePasswordRequest>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function update(field: keyof ChangePasswordRequest) {
    return (event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    setError(null)
    const problems = validate(form)
    setFieldErrors(problems)
    if (Object.keys(problems).length > 0) {
      return
    }
    setSubmitting(true)
    try {
      await changePassword(form)
      setForm(EMPTY_FORM)
      // The token is now invalid; PasswordChangeRoute sends the signed-out user to the sign-in page.
      finishPasswordChange()
    } catch (caught) {
      setForm(EMPTY_FORM)
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFieldErrors(caught.fieldErrors)
      } else {
        setError('Something went wrong. Please try again.')
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Change your password"
      subtitle="Your account was set up with a temporary password. Choose a new one before you continue."
      footer={
        <>
          {user && <>Signed in as {user.email}. </>}
          <button type="button" onClick={logout} className={linkClass}>
            Log out
          </button>
        </>
      }
    >
      <div className="mb-4 space-y-4">
        <Alert tone="info">
          Until you change it you cannot use the rest of the system. After changing it you will sign in again with
          your new password.
        </Alert>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <PasswordField
          id="currentPassword"
          label="Current password"
          name="currentPassword"
          autoComplete="current-password"
          hint="The temporary password you were given."
          required
          value={form.currentPassword}
          onChange={update('currentPassword')}
          error={fieldErrors.currentPassword}
          disabled={submitting}
        />
        <PasswordField
          id="newPassword"
          label="New password"
          name="newPassword"
          autoComplete="new-password"
          required
          value={form.newPassword}
          onChange={update('newPassword')}
          error={fieldErrors.newPassword}
          disabled={submitting}
        />
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p id="password-requirements" className="text-xs font-semibold text-slate-700">
            Your new password must have:
          </p>
          <ul aria-labelledby="password-requirements" className="mt-1 list-disc pl-5 text-xs text-slate-600">
            {PASSWORD_REQUIREMENTS.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
            <li>A different value from your current password</li>
          </ul>
        </div>
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          error={fieldErrors.confirmPassword}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? 'Changing password…' : 'Change password'}
        </button>
      </form>
    </AuthLayout>
  )
}
