// The backend's password policy (PasswordPolicy.java), repeated here only to
// give feedback before a request is sent. The backend remains the authority.

export const PASSWORD_MIN_LENGTH = 8
/** BCrypt reads at most 72 bytes, counted in UTF-8, not characters. */
export const PASSWORD_MAX_BYTES = 72

export const PASSWORD_REQUIREMENTS: string[] = [
  `At least ${PASSWORD_MIN_LENGTH} characters`,
  'At least one letter and one digit',
  `No longer than ${PASSWORD_MAX_BYTES} bytes (accented and non-Latin characters count as more than one)`,
]

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, with at least one letter and one digit.`

export const PASSWORD_TOO_LONG = `Password is too long. The limit is ${PASSWORD_MAX_BYTES} bytes; accented and non-Latin characters count as more than one.`

export const PASSWORDS_DO_NOT_MATCH = 'Passwords do not match.'

export function isWithinPasswordLimit(password: string): boolean {
  return new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES
}

/** What is wrong with a new password, in the backend's words, or null when it is acceptable. */
export function newPasswordProblem(password: string): string | null {
  if (!isWithinPasswordLimit(password)) {
    return PASSWORD_TOO_LONG
  }
  if (password.length < PASSWORD_MIN_LENGTH || !/\p{L}/u.test(password) || !/\p{Nd}/u.test(password)) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters and contain at least one letter and one digit.`
  }
  return null
}
