# Frontend authentication (shared)

The React app signs users in against the Spring Boot backend, which is the only
authentication authority. See `authentication.md` for the API itself and
`project-access.md` for project permissions.

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
public configuration only. Never put `JWT_SECRET`, `DB_PASSWORD` or any other
secret in a frontend environment file.

## Structure

```
frontend/src/
  api/client.ts          the only code that calls fetch
  api/authApi.ts         registerStudent, login, getCurrentUser
  auth/types.ts          TypeScript mirror of the backend DTOs
  auth/tokenStorage.ts   the only code that touches sessionStorage
  auth/AuthContext.ts    useAuth()
  auth/AuthProvider.tsx  authentication state
  auth/ProtectedRoute.tsx / PublicOnlyRoute.tsx
  pages/                 Login, Register, Dashboard (placeholder)
```

Backend endpoints used: `POST /api/v1/auth/register/student`,
`POST /api/v1/auth/login`, `GET /api/v1/auth/me`.

## Routes

| Path | Access |
|---|---|
| `/login`, `/register` | Public. A signed-in user is sent on to the dashboard. |
| `/dashboard` | Signed-in users only (placeholder page). |
| anything else | Redirects to `/dashboard`. |

To protect a new page, nest its route inside `<ProtectedRoute>` in `App.tsx`.

## How it works

**AuthProvider** holds `user`, `isAuthenticated` and `isInitializing`, and
offers `login` and `logout`. Components read it with `useAuth()`.

**Login.** The form calls `login(email, password)`. On success the access token
is stored and the user from the response becomes the current user; the visitor
is then sent to the page they originally asked for, or to the dashboard.

**Registration.** Students only. The backend returns the new user and no
token, so the app shows a confirmation on the login page and the student signs
in normally. The form sends only the fields the backend accepts; account type,
roles and status are decided by the server.

**Restoring a session.** On startup, if a token is stored, the app calls
`/auth/me` and uses the answer as the current user. The token is never decoded
in the browser: the backend reloads the user from the database, so it is the
only reliable source. While this check runs, protected pages show a loading
state instead of flashing the login page.

**Logout.** There is no backend logout endpoint. Logging out removes the token
from the browser and clears the user. The token itself stays valid until it
expires, but the browser no longer has it.

**Calling the API from a new feature.** Use `apiRequest(path, { auth: true })`
from `api/client.ts`. It attaches `Authorization: Bearer <token>`; do not build
that header anywhere else.

## 401 and 403

| Status | Meaning | What the app does |
|---|---|---|
| 401 on an authenticated request | Token missing, expired or invalid | Removes the token, clears the user, returns to login |
| 401 from the login form | Wrong email or password | Shows the message; nothing else changes |
| 403 | Signed in, but not allowed to do this | Shows the message; the user stays signed in |

Other errors: 400 shows the backend's message per field, 409 shows the
duplicate message, and 5xx or network failures show a generic message. Server
error details are never displayed.

## Account type, system role and project role

These are three separate things and must not be derived from one another.

| Concept | Values | Where it comes from | What it means |
|---|---|---|---|
| Account type | `STUDENT`, `STAFF` | `user.accountType` | The kind of account. Grants no permission. |
| System role | `USER`, `ADMIN` | `user.systemRole` | System-wide authority. `USER` does not mean student; `ADMIN` is not a project member. |
| Project role | `STUDENT`, `SUPERVISOR`, `CO_SUPERVISOR`, `EVALUATOR` | Project membership, per project | What the user may do in one project. |

The `User` type has no project role, and the token does not carry one. Never
infer a project role from the token, the email domain, the account type or the
system role. Project roles will be provided by the backend per project.

## Token storage and security limits

- The access token is kept in `sessionStorage` (never `localStorage`). It
  survives a page reload and is dropped when the tab is closed.
- This is a prototype trade-off. `sessionStorage` can be read by any script
  running on the page, so a cross-site-scripting bug would expose the token. A
  production system could use `HttpOnly`, `Secure`, `SameSite` cookies instead,
  which would need backend changes.
- Passwords are never stored and nothing sensitive is logged.
- Route guards in React are a convenience for the user. They are not security:
  the backend checks every request.
- There are no refresh tokens. When the token expires (one hour by default)
  the next request returns 401 and the user signs in again.
- If the backend cannot be reached during startup, the user is shown as signed
  out but the token is kept, so reloading once the backend is back restores
  the session.
