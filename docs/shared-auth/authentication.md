# Authentication (shared module)

The backend uses Spring Security with BCrypt password hashes and stateless JWT
access tokens. There is no SSO, OAuth2 or email verification in this prototype.

## Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register/student` | public | Student self-registration |
| POST | `/api/v1/auth/login` | public | Login for students, staff and admins |
| GET | `/api/v1/auth/me` | signed in | The current user |

Every other URL requires a valid token. A new endpoint is protected
automatically; it only becomes public if it is added to `SecurityConfig`.

There is no public staff registration. Staff and admin accounts will be created
through admin functionality later; once such a user exists, the same login
endpoint authenticates them.

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
  with at least one letter and one digit.
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
            "registrationNumber": "...", "staffId": null }
}
```

`expiresIn` is in seconds. Any failure (unknown email, wrong password, disabled
account) returns the same `401` with "Invalid email or password."

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
| 403 | Signed in but not allowed |
| 409 | Duplicate email or registration number |

## Token contents

HS256-signed, with exactly these claims: `sub` (user UUID), `email`,
`systemRole`, `iat`, `exp`. Project roles are deliberately not in the token.

The user is reloaded from the database on every request, so disabling or
deleting an account takes effect immediately, and role changes do not wait for
the token to expire.

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
- No refresh tokens, logout or token revocation. A token is valid until it
  expires, unless the account is disabled or deleted.
- No rate limiting or account lockout on login or registration.
- Registration tells the caller when an email or registration number is
  already taken.
- Project-level authorization (project roles) is not part of this phase.
