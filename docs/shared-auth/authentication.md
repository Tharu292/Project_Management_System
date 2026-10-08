# Authentication (shared module)

The backend uses Spring Security with BCrypt password hashes and stateless JWT
access tokens. There is no SSO, OAuth2 or email verification in this prototype.

## Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register/student` | public | Student self-registration |
| POST | `/api/v1/auth/login` | public | Login for students, staff and admins |
| GET | `/api/v1/auth/me` | signed in | The current user |
| POST | `/api/v1/auth/change-password` | signed in | Change your own password |

Every other URL requires a valid token and a password that does not still have
to be changed (see "Mandatory first-login password change"). A new endpoint is
protected automatically; it only becomes public if it is added to
`SecurityConfig`.

There is no public staff or administrator registration. Staff accounts are
created by an administrator and the first administrator by a startup bootstrap
(see `admin-user-management.md`); the same login endpoint authenticates them.

### Register a student

```json
{
  "firstName": "Test",
  "lastName": "Student",
  "email": "it23385764@my.sliit.lk",
  "registrationNumber": "IT23385764",
  "password": "...",
  "confirmPassword": "..."
}
```

- The email must be an `@my.sliit.lk` address. The whole address is matched, so
  `@sliit.lk`, `@gmail.com` and `@my.sliit.lk.fake.com` are refused.
- Email is trimmed and lower-cased; registration number is trimmed and upper-cased.
- Registration number may contain only letters and digits (at most 20). It is
  not cross-checked against the email, because the exact SLIIT format has not
  been confirmed.
- Password policy (`PasswordPolicy`): at least 8 characters, at most 72 bytes,
  with at least one letter and one digit. See "Password length" below.
- The server sets account type `STUDENT`, system role `USER` and `enabled = true`.
  Any such fields sent by the client are ignored.
- Registration does not add the student to a project.
- Returns `201` with the user. Returns `409` for a duplicate email or
  registration number, `400` for an invalid request.

### Log in

```json
{ "email": "it23385764@my.sliit.lk", "password": "..." }
```

Returns:

```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": "...", "firstName": "...", "lastName": "...", "email": "...",
            "accountType": "STUDENT", "systemRole": "USER",
            "registrationNumber": "...", "staffId": null,
            "mustChangePassword": false }
}
```

`expiresIn` is in seconds. Any failure (unknown email, wrong password, disabled
account) returns the same `401` with "Invalid email or password." A password
longer than 72 bytes is refused with `400` before any account is looked at
(see "Password length").

The `user` object is the same one `GET /api/v1/auth/me` and student
registration return. When `mustChangePassword` is `true` the client should
send the user straight to a change-password form.

### Change your password

`POST /api/v1/auth/change-password`, with the access token:

```json
{ "currentPassword": "...", "newPassword": "...", "confirmPassword": "..." }
```

- Any signed-in user may change their own password. The account is always the
  token's owner; nothing in the body can select another account.
- `currentPassword` is checked against the stored BCrypt hash.
- `newPassword` follows the same `PasswordPolicy` as registration, must equal
  `confirmPassword`, and must differ from the current password.
- Returns `204` with no body and **no new token**. Every token issued before
  the change, including the one used for this request, stops working, so the
  client discards its token and the user logs in again with the new password.
- Returns `400` with a `fieldErrors` entry for `currentPassword` ("Current
  password is incorrect."), `confirmPassword` ("Passwords do not match.") or
  `newPassword` (policy, or "New password must be different from the current
  password."). Nothing is changed. Returns `401` without a valid token.
- The user's row is locked for the whole change, so it cannot interleave with
  an administrator enabling or disabling the same account, or with a second
  change. If the account was disabled or its tokens were invalidated while the
  request was waiting for that lock, the request is refused with `401` and
  nothing is changed.

### Password length

BCrypt, the hash used for passwords, reads at most 72 **bytes**. The limit is
measured in UTF-8 bytes, not characters: an accented or non-Latin character
counts as two or three, an emoji as four. `PasswordPolicy.fitsHashLimit` is the
single definition, and every place that accepts a password applies it:

| Where | Field | A longer value gives |
|---|---|---|
| Student registration, staff creation | `password` | `400`, `fieldErrors.password` |
| Login | `password` | `400`, `fieldErrors.password` |
| Change password | `currentPassword`, `newPassword` | `400`, that field |
| Administrator bootstrap | `BOOTSTRAP_ADMIN_PASSWORD` | Nothing is provisioned; logged |

The message is "Password is too long. The limit is 72 bytes; accented and
non-Latin characters count as more than one." No stored password can be
longer than the limit, so a longer one can never be correct; refusing it up
front also means a long value that merely starts with the real password is
not accepted.

## Mandatory first-login password change

An account whose password was chosen by someone other than its owner has
`mustChangePassword = true`:

| Account | `mustChangePassword` when created |
|---|---|
| Student (self-registered) | `false` |
| Staff (created by an administrator) | `true` |
| First administrator (bootstrap) | `true` |

Such a user can log in, but until they change their password the backend lets
them use only:

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`

(and the public login and student registration endpoints). Every other request
is refused with `403` and the message "You must change your password before
continuing.", whatever system role or project roles the user holds. An
administrator in this state cannot use `/api/v1/admin/**` either.

This is enforced in `SecurityConfig`: while the flag is set the user is given
no system role, and every rule except the two endpoints above requires one
(any value of `SystemRole`, so a role added later needs no change there). A
component does not need to check anything, and a new endpoint is closed to
such users by default.

As a second line of defence the shared services apply the same rule
themselves. For a caller who must still change their password, every
current-user check in `ProjectAccessService` (`requireMember`, `requireRole`,
`requireAnyRole`, `requireMemberOrAdmin`, `requireAdmin` and the matching
`is...`/`has...` methods) answers as if the user held no project role and were
not an administrator. `CurrentUserService.isPasswordChangeRequired()` exposes
the state for code that needs it.

Rules for components:

- Do not add `.authenticated()` or `.permitAll()` rules to `SecurityConfig`
  for component endpoints; the default rule is the right one.
- Guard project data with `ProjectAccessService`, not with a hand-written
  check of `getCurrentSystemRole()` or of the membership tables.

A successful password change clears the flag. The user then logs in again and
has their normal access.

### Call a protected endpoint

```
Authorization: Bearer <accessToken>
```

## Errors

All errors share one body:

```json
{
  "timestamp": "...", "status": 400, "error": "Bad Request",
  "message": "Validation failed.", "path": "/api/v1/auth/login",
  "fieldErrors": { "email": "must not be blank" }
}
```

| Status | Meaning |
|---|---|
| 400 | Invalid or malformed request |
| 401 | Not signed in, bad/expired token, or wrong credentials |
| 403 | Signed in but not allowed, or the password must be changed first |
| 409 | Duplicate email or registration number |

## Token contents

HS256-signed, with exactly these claims: `sub` (user UUID), `email`,
`systemRole`, `securityVersion`, `iat`, `exp`. Project roles are deliberately
not in the token.

The user is reloaded from the database on every request, so disabling or
deleting an account takes effect immediately, and role changes do not wait for
the token to expire.

### Token invalidation (`securityVersion`)

Every user has a `security_version` number in the database (starting at 0).
It is copied into each token when the token is issued, and on every request
the token's value is compared with the user's current one. A token with a
different value, or with none, is refused with `401`.

The number is raised by one, and so all of the user's existing tokens die,
when:

- the user changes their password;
- the account is disabled.

It never goes down and nothing else changes it. Re-enabling an account does
not raise it and does not revive old tokens: the user logs in again. The
number is never returned by any API.

Both changes are made with the user's row locked (`UserLocks`), so a password
change and a disable arriving together run one after the other and neither
can write back the other's old values. Any future code that modifies an
existing user must load it through `UserLocks.lock`, inside a transaction,
and not through `UserRepository.findById`. Login also refuses to issue a token
if the account's version moved while the password was being checked.

Tokens issued before this feature was deployed have no `securityVersion` and
are refused, so every user logs in once more after the upgrade.

## Using the current user in a component

Inject `CurrentUserService`. Do not read the `Authorization` header or parse
tokens yourself.

```java
UUID userId = currentUserService.getCurrentUserId();
User user = currentUserService.getCurrentUser();
AccountType type = currentUserService.getCurrentAccountType();
SystemRole role = currentUserService.getCurrentSystemRole();
boolean signedIn = currentUserService.isAuthenticated();
```

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | yes | none | Token signing key, at least 32 bytes |
| `JWT_EXPIRATION_MS` | no | `3600000` (1 hour) | Token lifetime in milliseconds |
| `CORS_ALLOWED_ORIGINS` | no | `http://localhost:5173` | Comma-separated browser origins |

The application will not start without a `JWT_SECRET` of at least 32 bytes.
There is no built-in fallback secret.

### Local development secret

Each developer generates their own secret and stores it as a user-level
environment variable. It is never written to a file in the repository.

PowerShell:

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Environment]::SetEnvironmentVariable('JWT_SECRET', [Convert]::ToBase64String($bytes), 'User')
```

Restart the terminal or IDE afterwards so it picks the variable up. Changing
the secret invalidates all existing tokens.

Tests use a fixed, test-only key from `src/test/resources/config/application.properties`
and do not need `JWT_SECRET`.

## Known limitations of the prototype

- Restricting registration to `@my.sliit.lk` does **not** prove the person owns
  that mailbox; anyone can type such an address. Email verification or SLIIT
  SSO is a production enhancement.
- No refresh tokens or logout. A token is valid until it expires, unless the
  account is disabled or deleted or its password is changed. There is no way
  to invalidate one single token.
- No password reset: a user who forgets their password cannot recover the
  account through the API, and an administrator cannot set a new one.
- No password history: only the current password is refused as the new one.
- No limit on wrong `currentPassword` attempts.
- The existing frontend does not yet handle `mustChangePassword`; until it
  does, a staff member or administrator who has just been given an account
  sees their requests refused with `403` after logging in.
- No rate limiting or account lockout on login or registration.
- Registration tells the caller when an email or registration number is
  already taken.
- Project-level authorization (project roles) is not part of this phase.
