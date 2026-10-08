import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import { createStaff } from '../../api/adminApi'
import { ApiError } from '../../api/client'
import { ADMIN_USERS_PATH } from '../../auth/landing'
import { PASSWORDS_DO_NOT_MATCH, PASSWORD_HINT, newPasswordProblem } from '../../auth/passwordPolicy'
import type { AdminUser, CreateStaffRequest } from '../../auth/types'
import Alert from '../../components/Alert'
import AppShell, { actionButtonClass, secondaryButtonClass } from '../../components/AppShell'
import FormField from '../../components/FormField'
import PasswordField from '../../components/PasswordField'
import { fullName } from './userDisplay'

const EMPTY_FORM: CreateStaffRequest = {
  firstName: '',
  lastName: '',
  email: '',
  staffId: '',
  password: '',
  confirmPassword: '',
}

/** The backend's rule (StaffEmailPolicy): the whole, lower-cased address must end in exactly @sliit.lk. */
const STAFF_EMAIL_PATTERN = /^[a-z0-9._%+-]+@sliit\.lk$/
const STAFF_EMAIL_MESSAGE = 'Staff email must use the @sliit.lk domain.'
const SHARE_PRIVATELY =
  'Nothing is emailed. Give the staff member their email and temporary password yourself, through a private ' +
  'channel. They will be required to choose a new password the first time they sign in.'

type FieldErrors = Partial<Record<keyof CreateStaffRequest, string>>

/** Trims and lower-cases the same way the backend does, so the request shows what will be stored. */
function normalise(form: CreateStaffRequest): CreateStaffRequest {
  return {
    ...form,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    staffId: form.staffId.trim(),
  }
}

function validate(form: CreateStaffRequest): FieldErrors {
  const errors: FieldErrors = {}
  if (form.firstName === '') errors.firstName = 'Enter a first name.'
  if (form.lastName === '') errors.lastName = 'Enter a last name.'
  if (form.email === '') {
    errors.email = 'Enter a staff email address.'
  } else if (!STAFF_EMAIL_PATTERN.test(form.email)) {
    errors.email = STAFF_EMAIL_MESSAGE
  }
  if (form.staffId === '') errors.staffId = 'Enter a staff ID.'
  const problem = newPasswordProblem(form.password)
  if (problem) errors.password = problem
  if (form.confirmPassword !== form.password) errors.confirmPassword = PASSWORDS_DO_NOT_MATCH
  return errors
}

/** A duplicate is reported as one message; point at the field it is about as well. */
function duplicateField(error: ApiError): FieldErrors {
  if (error.status !== 409) {
    return {}
  }
  const message = error.message.toLowerCase()
  if (message.includes('staff id') && !message.includes('email')) return { staffId: error.message }
  if (message.includes('email') && !message.includes('staff id')) return { email: error.message }
  return {}
}

/**
 * Creates a staff account. The form offers only what the backend accepts:
 * account type, system role, status and project roles are not choices here.
 */
export default function CreateStaffPage() {
  const [form, setForm] = useState<CreateStaffRequest>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<AdminUser | null>(null)

  function update(field: keyof CreateStaffRequest) {
    return (event: ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) {
      return
    }
    setError(null)
    const request = normalise(form)
    const problems = validate(request)
    setFieldErrors(problems)
    if (Object.keys(problems).length > 0) {
      return
    }
    setSubmitting(true)
    try {
      const staff = await createStaff(request)
      // The temporary password is not kept once the account exists.
      setForm(EMPTY_FORM)
      setCreated(staff)
    } catch (caught) {
      setForm((current) => ({ ...current, password: '', confirmPassword: '' }))
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFieldErrors({ ...caught.fieldErrors, ...duplicateField(caught) })
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold text-slate-900">Staff account created</h1>
          <div className="mt-6 space-y-4">
            <Alert tone="success">
              An account for {fullName(created)} ({created.email}) has been created.
            </Alert>
            <Alert tone="info">{SHARE_PRIVATELY}</Alert>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to={ADMIN_USERS_PATH} className={actionButtonClass}>
              Go to user management
            </Link>
            <button type="button" onClick={() => setCreated(null)} className={secondaryButtonClass + ' py-2'}>
              Create another staff account
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Create staff account</h1>
        <p className="mt-1 text-slate-600">
          For lecturers and other university staff. Students register themselves; this form cannot create student or
          administrator accounts.
        </p>

        <div className="mt-6 space-y-4">
          <Alert tone="info">{SHARE_PRIVATELY}</Alert>
          {error && <Alert tone="error">{error}</Alert>}
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="firstName"
              label="First name"
              name="firstName"
              autoComplete="off"
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
              autoComplete="off"
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
            label="Staff email"
            type="email"
            name="email"
            autoComplete="off"
            required
            maxLength={254}
            placeholder="name@sliit.lk"
            hint="Must be an @sliit.lk address. Student (@my.sliit.lk) addresses are not accepted."
            value={form.email}
            onChange={update('email')}
            error={fieldErrors.email}
            disabled={submitting}
          />
          <FormField
            id="staffId"
            label="Staff ID"
            name="staffId"
            autoComplete="off"
            required
            maxLength={30}
            hint="Must be unique. At most 30 characters."
            value={form.staffId}
            onChange={update('staffId')}
            error={fieldErrors.staffId}
            disabled={submitting}
          />
          <PasswordField
            id="password"
            label="Temporary password"
            name="password"
            autoComplete="new-password"
            required
            hint={PASSWORD_HINT}
            value={form.password}
            onChange={update('password')}
            error={fieldErrors.password}
            disabled={submitting}
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm temporary password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            error={fieldErrors.confirmPassword}
            disabled={submitting}
          />
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="submit" disabled={submitting} className={actionButtonClass}>
              {submitting ? 'Creating account…' : 'Create staff account'}
            </button>
            <Link to={ADMIN_USERS_PATH} className={secondaryButtonClass + ' py-2'}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AppShell>
  )
}
