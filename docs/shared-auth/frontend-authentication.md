# Frontend authentication and administration (shared)

The React app signs users in against the Spring Boot backend, which is the only
authentication authority. See `authentication.md` for the API itself,
`admin-user-management.md` for the administrator API and `project-access.md`
for project permissions.

## Running it locally

1. Start the backend (`http://localhost:8080`). The frontend never starts it.
2. In `frontend/`:

   ```
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173`.

The dev server is pinned to port 5173 because the backend only accepts browser
requests from that origin. If the port is busy, free it rather than changing
the port.

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit and component tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run build` | Type-check and production build |

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8080` | Where the backend is |

To override it, copy `frontend/.env.example` to `frontend/.env.local`. Every
`VITE_` variable is embedded in the JavaScript sent to the browser, so this is
public configuration only. Never put `JWT_SECRET`, `DB_PASSWORD`, an
administrator password or any other secret in a frontend environment file.

## Structure

```
frontend/src/
  api/client.ts            the only code that calls fetch
  api/authApi.ts           registerStudent, login, getCurrentUser, changePassword
  api/adminApi.ts          listUsers, getUser, createStaff, setUserEnabled
  auth/types.ts            TypeScript mirror of the backend DTOs
  auth/tokenStorage.ts     the only code that touches sessionStorage
  auth/AuthContext.ts      useAuth()
  auth/AuthProvider.tsx    authentication state
  auth/landing.ts          paths, and where each kind of user starts
  auth/passwordPolicy.ts   the backend's password rules, for early feedback
  auth/ProtectedRoute.tsx  signed in, and not waiting to change a password
  auth/AdminRoute.tsx      system administrators only (inside ProtectedRoute)
  auth/PasswordChangeRoute.tsx  /change-password
  auth/PublicOnlyRoute.tsx      /login and /register
  auth/HomeRedirect.tsx         "/" and unknown paths
  components/              AppShell, AuthLayout, FormField, PasswordField, Alert, ConfirmDialog
  pages/                   Login, Register, ChangePassword, Dashboard (placeholder)
  pages/admin/             AdminDashboard, AdminUsers, AdminUserDetail, CreateStaff
  test/                    the fake backend used by tests only
```

## Backend endpoints used

| Call | Endpoint | Request | Response |
|---|---|---|---|
| `registerStudent` | `POST /api/v1/auth/register/student` | `StudentRegistrationRequest` | `201` `UserResponse` |
| `login` | `POST /api/v1/auth/login` | `LoginRequest` | `200` `LoginResponse` |
| `getCurrentUser` | `GET /api/v1/auth/me` | none | `200` `UserResponse` |
| `changePassword` | `POST /api/v1/auth/change-password` | `ChangePasswordRequest` | `204`, no body, no token |
| `listUsers` | `GET /api/v1/admin/users` | none | `200` `AdminUserResponse[]` |
| `getUser` | `GET /api/v1/admin/users/{userId}` | none | `200` `AdminUserResponse` |
| `createStaff` | `POST /api/v1/admin/users/staff` | `CreateStaffRequest` | `201` `AdminUserResponse` |
| `setUserEnabled` | `PATCH /api/v1/admin/users/{userId}/enabled` | `{ "enabled": boolean }` | `200` `AdminUserResponse` |

`auth/types.ts` mirrors those DTOs field for field. The backend is
authoritative: change the types only when the DTOs change. Note that student
registration is `/auth/register/student`; there is no `/auth/register`.

## Routes

| Path | Who may open it |
|---|---|
| `/login`, `/register` | Signed-out visitors. A signed-in user is sent on to their start page. |
| `/change-password` | Only a signed-in user whose `mustChangePassword` is `true`. |
| `/dashboard` | Any signed-in user who does not have to change their password (placeholder page). |
| `/admin/dashboard` | System administrators. |
| `/admin/users` | System administrators. |
| `/admin/users/new-staff` | System administrators. |
| `/admin/users/{userId}` | System administrators. |
| `/admin` | Redirects to `/admin/dashboard`. |
| `/` and anything else | Redirects to sign-in, or to the signed-in user's start page. |

To protect a new page, nest its route inside `<ProtectedRoute>` in `App.tsx`.
To restrict it to administrators, nest it inside `<AdminRoute>` as well.

### Start page

After signing in, and whenever a signed-in user opens `/`:

1. `mustChangePassword` is `true` → `/change-password`.
2. Otherwise, system role `ADMIN` → `/admin/dashboard`.
3. Otherwise → `/dashboard`.

This is decided only from what the backend returned for the user
(`auth/landing.ts`). It is never decided from the email domain, and account
type `STAFF` is never treated as supervisor, evaluator or administrator.

If a signed-out visitor asked for a specific page first, they are returned to
it after signing in, provided it is an in-app path they may open. A
non-administrator is not returned to an `/admin` page.

### Guard behaviour

| Visitor | `/login`, `/register` | `/change-password` | `/dashboard` | `/admin/...` |
|---|---|---|---|---|
| Signed out | Shown | → `/login` | → `/login` | → `/login` |
| Signed in, must change password | → `/change-password` | Shown | → `/change-password` | → `/change-password` |
| Signed in, `USER` | → `/dashboard` | → `/dashboard` | Shown | → `/dashboard` with "You do not have permission to open that page." |
| Signed in, `ADMIN` | → `/admin/dashboard` | → `/admin/dashboard` | Shown | Shown |

Each guard redirects only to a page the same visitor is allowed to see, so
redirects cannot loop. While a stored token is still being checked, every
guard shows a loading state instead of deciding early.

## How it works

**AuthProvider** holds `user`, `isAuthenticated`, `isInitializing` and
`sessionNotice`, and offers `login`, `logout` and `finishPasswordChange`.
Components read it with `useAuth()`.

**Universal login.** There is one sign-in form at `/login` for students, staff
and administrators. It has no account-type, role or project-role choice. On
success the access token is stored and the user from the response becomes the
current user; the start-page rules above then apply.

**Student registration.** Students only, at `/register`. The backend returns
the new user and no token, so the app shows a confirmation on the sign-in page
and the student signs in normally. The form sends only the fields the backend
accepts; account type, roles and status are decided by the server.

**Restoring a session.** On startup, if a token is stored, the app calls
`/auth/me` and uses the answer as the current user, including
`mustChangePassword`. The token is never decoded in the browser. While this
check runs, protected pages show a loading state instead of flashing the
sign-in page or protected content.

**Logout.** There is no backend logout endpoint. Logging out removes the token
from the browser and clears the user. It is available on every signed-in page,
including `/change-password`.

**Calling the API from a new feature.** Use `apiRequest(path, { auth: true })`
from `api/client.ts`. It attaches `Authorization: Bearer <token>`; do not build
that header anywhere else.

## First-login password change

Staff accounts created by an administrator, and the bootstrap administrator,
come back from the backend with `mustChangePassword: true`. Students who
registered themselves do not.

1. The user signs in at `/login` as usual.
2. Because `mustChangePassword` is `true`, they are sent to `/change-password`
   and every other signed-in page redirects there. No administrator data is
   requested for a flagged administrator.
3. The page explains that the temporary password must be replaced and lists
   the rules for the new one.
4. The form has current password, new password and confirmation, each with a
   show/hide control. Before anything is sent it checks the backend's own
   rules (`auth/passwordPolicy.ts`): at least 8 characters, a letter and a
   digit, at most 72 UTF-8 bytes, different from the current password, and a
   matching confirmation.
5. It posts to `POST /api/v1/auth/change-password`.
6. On `204` the backend has invalidated the token. The app removes it, clears
   the user, and the sign-in page shows "Password changed. Sign in with your
   new password." The old token is never sent again.
7. The user signs in with the new password and lands on their start page.

Errors: a wrong current password, or any other rule the backend rejects,
arrives as `400` with `fieldErrors` and is shown on the field. After any
failed attempt the three password fields are cleared. A `401` (the token
expired meanwhile) returns the user to sign-in.

There is no voluntary password-change page yet. A user who does not have to
change their password is redirected away from `/change-password`.

## Administration

The administration menu (Admin Dashboard, User Management, Create Staff) is
shown only when the signed-in user's system role is `ADMIN`. Other users never
see it, and `AdminRoute` keeps them off the pages; the backend refuses their
requests in any case.

**Admin dashboard** (`/admin/dashboard`). Shows who is signed in and counts
taken from `GET /api/v1/admin/users`: total, students, staff, enabled,
disabled, and password change pending. Nothing is estimated or invented. It
states that administration covers accounts only and does not give access to
research projects.

**User management** (`/admin/users`). A table of every account with name,
email, account type, system role, registration number or staff ID, status,
whether a password change is pending, and creation date. Search (name, email,
registration number, staff ID) and the account-type and status filters work in
the browser on the list already fetched, because the backend has no search or
pagination. Each row links to the account's details page.

**Enable / disable.** Ordinary accounts have an Enable or Disable button, on
the list and on the details page. It asks for confirmation, sends
`PATCH .../enabled`, and reloads the list afterwards. Administrator accounts
have no such button, matching the backend rule.

**Create staff** (`/admin/users/new-staff`). Fields: first name, last name,
staff email, staff ID, temporary password and confirmation. The email must be
an exact `@sliit.lk` address; names, email and staff ID are trimmed and the
email lower-cased, as the backend does. There are no selectors for account
type, system role, status or project role: the backend sets `STAFF`, `USER`,
enabled and `mustChangePassword = true`. A duplicate email or staff ID (`409`)
is shown on the page and on the field. After success the page confirms the
name and email only. Nothing is emailed: the administrator passes the
temporary password on privately, and the staff member must change it at first
sign-in. The temporary password is not shown again, stored or logged.

## 401 and 403

| Status | Meaning | What the app does |
|---|---|---|
| 401 on an authenticated request | Token missing, expired or invalidated (password changed, account disabled) | Removes the token, clears the user, returns to sign-in with "Your session has ended. Please sign in again." |
| 401 from the sign-in form | Wrong email or password, or a disabled account | Shows the backend's message; nothing else changes |
| 403 | Signed in, but not allowed | Shows the message; the user stays signed in |

A `403` can also mean the account changed after it was loaded, for example it
now has to change its password ("You must change your password before
continuing."). So on any `403` from an authenticated request the app asks
`/auth/me` again and updates the current user. If the user is now flagged, the
guards send them to `/change-password`; otherwise nothing moves. This does not
depend on the wording of the error.

Other errors: `400` shows the backend's message per field, `409` shows the
duplicate message, and `5xx` or network failures show a generic message.
Server error details are never displayed.

## Account type, system role and project role

These are three separate things and must not be derived from one another.

| Concept | Values | Where it comes from | What it means |
|---|---|---|---|
| Account type | `STUDENT`, `STAFF` | `user.accountType` | The kind of account. Grants no permission. |
| System role | `USER`, `ADMIN` | `user.systemRole` | System-wide authority. `USER` does not mean student; `ADMIN` is not a project member. |
| Project role | `STUDENT`, `SUPERVISOR`, `CO_SUPERVISOR`, `EVALUATOR` | Project membership, per project | What the user may do in one project. |

The `User` type has no project role, and the token does not carry one. Never
infer a project role from the token, the email domain, the account type or the
system role. Nothing in the sign-in or staff-creation forms selects one.

## Token storage and security limits

- The access token is kept in `sessionStorage` (never `localStorage`). It
  survives a page reload and is dropped when the tab is closed.
- This is a prototype trade-off. `sessionStorage` can be read by any script
  running on the page, so a cross-site-scripting bug would expose the token. A
  production system could use `HttpOnly`, `Secure`, `SameSite` cookies instead,
  which would need backend changes.
- Passwords are never stored and nothing sensitive is logged. Password fields
  are cleared after every submission.
- Route guards and the hidden administration menu are a convenience for the
  user. They are not security: the backend checks every request.
- The password rules repeated in `auth/passwordPolicy.ts` and the staff email
  rule in `CreateStaffPage.tsx` only give early feedback. If they ever drift
  from the backend, the backend's answer is what counts and is still shown.
- There are no refresh tokens. When the token expires (one hour by default)
  the next request returns 401 and the user signs in again.
- If the backend cannot be reached during startup, the user is shown as signed
  out but the token is kept, so reloading once the backend is back restores
  the session.
- The user list is fetched whole and filtered in the browser. That is fine for
  a prototype and will not scale to a large number of accounts.
- There is no forgotten-password flow, and an administrator cannot reset a
  password or make an account change its password again.

## Manual verification

Needs the backend running against a database that already has an
administrator (see `admin-user-management.md` for the bootstrap). Use test
accounts only.

1. Open `/admin/users` while signed out: you are sent to `/login`.
2. Sign in as the bootstrap administrator with its initial password: you land
   on `/change-password`. Try `/admin/dashboard` in the address bar: you are
   returned to `/change-password`.
3. Submit a wrong current password, then mismatched new passwords: each is
   reported on its field and you stay on the page.
4. Change the password properly: you are returned to `/login` with "Password
   changed. Sign in with your new password." The old password no longer works.
5. Sign in with the new password: you land on `/admin/dashboard` and the
   counts match the user list.
6. Open Create Staff. Try a `@my.sliit.lk` address: it is refused. Create a
   staff account with an `@sliit.lk` address: the confirmation shows the name
   and email, not the password.
7. Create the same email again: the duplicate message appears on the page and
   on the email field.
8. In User Management, search for the new account and check it shows
   "Password change pending". The administrator's own row has no Disable
   button.
9. In a private window, sign in as the new staff member: you are sent to
   `/change-password`. Change the password, sign in again: you land on
   `/dashboard` with no administration menu. Open `/admin/users`: you are
   returned to `/dashboard` with a permission message.
10. As the administrator, disable that staff account and confirm. In the
    private window, reload: the staff member is returned to `/login` and
    cannot sign in. Enable the account again: they can sign in again.
11. Register a student at `/register` and sign in: you land on `/dashboard`
    without being asked to change the password.
12. Log out from each kind of account: you return to `/login` and `/dashboard`
    is protected again.
