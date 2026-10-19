
# Administrator and user management (shared module)

How accounts come into existence, and what a system administrator can do with
them. See `authentication.md` for login and tokens and `project-access.md` for
project permissions.

## Who creates which account

| Account | How it is created |
|---|---|
| Student | Self-registration: `POST /api/v1/auth/register/student` (`@my.sliit.lk` only) |
| Staff | By an administrator: `POST /api/v1/admin/users/staff` (`@sliit.lk` only) |
| First administrator | Startup bootstrap from environment variables (below) |

There is no public staff registration and no public administrator
registration. Everyone, including administrators, signs in through the same
`POST /api/v1/auth/login`.

## Account type, system role and project role

| Concept | Values | Meaning |
|---|---|---|
| Account type | `STUDENT`, `STAFF` | The kind of institutional account. Grants no permission. |
| System role | `USER`, `ADMIN` | System-wide administration. |
| Project role | `STUDENT`, `SUPERVISOR`, `CO_SUPERVISOR`, `EVALUATOR` | Permissions inside one project. |

These never imply one another. A staff account created here is `STAFF` /
`USER`: it is not a supervisor or evaluator of anything until it is added to a
project. An administrator is not a member of any project. Nothing in this
module assigns project roles or memberships.

## First administrator (bootstrap)

On startup the application provisions the first administrator from the
environment, once.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `BOOTSTRAP_ADMIN_EMAIL` | yes | none | Must be an `@sliit.lk` address |
| `BOOTSTRAP_ADMIN_PASSWORD` | yes | none | Must satisfy the normal password policy |
| `BOOTSTRAP_ADMIN_FIRST_NAME` | no | `System` | |
| `BOOTSTRAP_ADMIN_LAST_NAME` | no | `Administrator` | |
| `BOOTSTRAP_ADMIN_STAFF_ID` | no | none | At most 30 characters |

The account is created as `STAFF` / `ADMIN`, enabled, with the password stored
as a BCrypt hash and `mustChangePassword = true`. The bootstrap password is
therefore only good for one thing: logging in and replacing it. Until the
administrator has done that, `/api/v1/admin/**` answers `403` (see
"Mandatory first-login password change" in `authentication.md`).

What happens at each start:

1. If any administrator already exists (enabled or disabled), nothing is done.
2. Otherwise, if neither email nor password is set, nothing is done.
3. Otherwise the configuration is checked and the administrator is created.

Safety rules:

- It only ever inserts a new account. It never changes an existing account's
  password, email, staff ID or role, so restarting is harmless.
- It never promotes an existing account. If the configured email already
  belongs to someone, nothing is created.
- A staff ID that is already in use, an email outside `@sliit.lk`, a weak
  password, or only one of email/password being set all result in nothing
  being created.
- Disabling the administrator later does not cause a new one to be created.
- Problems are written to the log as an error that names the variable at
  fault but never contains its value. The application still starts.

Check the startup log for one of:

```
Bootstrap administrator provisioned.
Bootstrap administrator: an administrator already exists; skipping provisioning.
Bootstrap administrator: not configured; no administrator was provisioned.
Bootstrap administrator: <what is wrong> No administrator was provisioned.
```

### Local setup

Set the variables in your own environment, never in a file in the repository.
PowerShell, with your own values in place of the placeholders:

```powershell
[Environment]::SetEnvironmentVariable('BOOTSTRAP_ADMIN_EMAIL', '<your admin address>@sliit.lk', 'User')
[Environment]::SetEnvironmentVariable('BOOTSTRAP_ADMIN_PASSWORD', '<a strong password>', 'User')
```

Open a new terminal, start the backend, and confirm the log line above. Then
log in as the administrator and change the password with
`POST /api/v1/auth/change-password`, and log in again with the new one. Once
the administrator exists the two variables are no longer used and can be
removed:

```powershell
[Environment]::SetEnvironmentVariable('BOOTSTRAP_ADMIN_PASSWORD', $null, 'User')
```

Automated tests never run the bootstrap from the environment.

## Administrator endpoints

All of `/api/v1/admin/**` requires a signed-in user whose system role is
`ADMIN` and who has already replaced their initial password. The check is
made by the backend on every request (the user is reloaded from the database
each time), not by the frontend.

| Caller | Result |
|---|---|
| No or invalid token | 401 |
| Signed in as `USER` (student or staff) | 403 |
| Signed in as `ADMIN`, password change still required | 403 |
| Signed in as `ADMIN` | Allowed |

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/admin/users/staff` | Create a staff account |
| GET | `/api/v1/admin/users` | List all accounts |
| GET | `/api/v1/admin/users/{userId}` | One account |
| PATCH | `/api/v1/admin/users/{userId}/enabled` | Enable or disable an account |

Every response uses this shape (never a password or hash, and no project
information):

```json
{
  "id": "...", "firstName": "...", "lastName": "...", "email": "...",
  "accountType": "STAFF", "systemRole": "USER",
  "registrationNumber": null, "staffId": "...",
  "enabled": true, "mustChangePassword": true, "createdAt": "..."
}
```

`mustChangePassword` shows whether the account's owner has yet to replace the
password they were given.

### Create a staff account

```json
{
  "firstName": "...", "lastName": "...",
  "email": "name@sliit.lk", "staffId": "...",
  "password": "...", "confirmPassword": "..."
}
```

- Email must be an `@sliit.lk` address (`@my.sliit.lk` is refused) and is
  trimmed and lower-cased.
- Staff ID is required, trimmed, at most 30 characters, and unique.
- The password follows the same policy as student registration.
- The server sets `STAFF` / `USER` / enabled and `mustChangePassword = true`.
  Any such fields sent by the client are ignored.
- The password the administrator chooses is an initial password only. The
  staff member can log in with it, but can do nothing except read their own
  details and change it, and must then log in again.
- Returns `201`; `400` for an invalid request; `409` for a duplicate email or
  staff ID.

### List accounts

Returns every account, oldest first. There is no pagination or filtering in
the prototype.

### Enable or disable an account

```json
{ "enabled": false }
```

- Works on ordinary (`USER`) accounts, students and staff alike. Only the
  enabled flag changes.
- Setting the value an account already has succeeds and changes nothing.
- Administrator accounts cannot be changed here (`403`), so an administrator
  cannot lock themselves or another administrator out.
- Unknown user: `404`.

A disabled user cannot log in. A token they already hold stops working on
their next request and never works again: disabling raises the account's
security version (see "Token invalidation" in `authentication.md`).
Re-enabling the account lets the user log in again for a new token; it does
not revive old ones. Enabling an account that is already enabled, or
disabling one that is already disabled, invalidates nothing.

The account's row is locked while it is enabled or disabled. If the user is
changing their password at the same moment, the two happen one after the
other: a disable is never undone by the password change, and never puts the
old password back.

## Prototype limitations

- One administrator is provisioned by the bootstrap. There is no way to create
  further administrators, or to promote or demote an account.
- Administrator accounts cannot be disabled through the API.
- No password reset, no email verification, no account deletion and no
  profile editing. Users can change their own password; an administrator
  cannot set or reset anyone's password after creating the account.
- The administrator chooses a staff member's initial password and must pass it
  on to them by some other means; nothing is emailed. It does not expire if
  the staff member never logs in.
- An administrator cannot make an existing account change its password again.
- The `@sliit.lk` rule does not prove that the mailbox exists or belongs to
  the person.
- Staff IDs are compared exactly, so `ABC-1` and `abc-1` count as different.
- The list endpoint returns all accounts at once.
