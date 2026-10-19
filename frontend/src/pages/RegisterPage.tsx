import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { registerStudent } from '../api/authApi'
import { ApiError } from '../api/client'
import AuthLayout, { linkClass, primaryButtonClass } from '../components/AuthLayout'
import FormField from '../components/FormField'
import type { StudentRegistrationRequest } from '../auth/types'

const EMPTY_FORM: StudentRegistrationRequest = {
  firstName: '',
  lastName: '',
  email: '',
  registrationNumber: '',
  password: '',
  confirmPassword: '',
}

/**
 * Student self-registration only. The form sends exactly the fields the
 * backend accepts; account type, roles and status are decided by the server.
 * Validation rules live in the backend, whose messages are shown per field.
 */
export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<StudentRegistrationRequest>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function update(field: keyof StudentRegistrationRequest) {
    return (event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    setError(null)
    setFieldErrors({})
    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' })
      return
    }
    setSubmitting(true)
    try {
      const created = await registerStudent(form)
      // Registration does not sign the student in; they log in normally next.
      navigate('/login', { replace: true, state: { registeredEmail: created.email } })
    } catch (caught) {
      setForm((current) => ({ ...current, password: '', confirmPassword: '' }))
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
      title="Create a student account"
      subtitle="Registration is open to students only. Staff accounts are created by an administrator."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className={linkClass}>
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="firstName"
            label="First name"
            name="firstName"
            autoComplete="given-name"
            required
            maxLength={100}
            value={form.firstName}
            onChange={update('firstName')}
            error={fieldErrors.firstName}
            disabled={submitting}
          />
          <FormField
            id="lastName"
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            required
            maxLength={100}
            value={form.lastName}
            onChange={update('lastName')}
            error={fieldErrors.lastName}
            disabled={submitting}
          />
        </div>
        <FormField
          id="email"
          label="Student email"
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="it12345678@my.sliit.lk"
          hint="Must be your @my.sliit.lk student address."
          value={form.email}
          onChange={update('email')}
          error={fieldErrors.email}
          disabled={submitting}
        />
        <FormField
          id="registrationNumber"
          label="Registration number"
          name="registrationNumber"
          autoComplete="off"
          required
          maxLength={20}
          placeholder="IT12345678"
          hint="Letters and digits only."
          value={form.registrationNumber}
          onChange={update('registrationNumber')}
          error={fieldErrors.registrationNumber}
          disabled={submitting}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters, with at least one letter and one digit."
          value={form.password}
          onChange={update('password')}
          error={fieldErrors.password}
          disabled={submitting}
        />
        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={form.confirmPassword}
          onChange={update('confirmPassword')}
          error={fieldErrors.confirmPassword}
          disabled={submitting}
        />
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
