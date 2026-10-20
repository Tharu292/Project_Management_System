# Component 3 local demo

How to run all five Component 3 modules on your own computer with a demo
project. **This is for local development only.** The demo seed never runs
unless you switch it on, and it is not a database migration.

## What you need once

- JDK 21, Node.js 22, PostgreSQL (18 is used here), and the ML service venv
  (see `ml-service/docs/api.md`).
- The trained model in `ml-service/models/`. Create it with
  `python -m ml.train_classifier`, see `ml-service/docs/dataset.md`.
- Two empty databases: `research_pms` and `research_pms_test`.
- Three **Windows user environment variables**. Never write these values into
  a file in the repository, a chat or a log.

| Variable | Used for |
|---|---|
| `DB_PASSWORD` | The PostgreSQL password the backend uses |
| `JWT_SECRET` | Signing sign-in tokens; at least 32 random bytes |
| `C3_DEMO_PASSWORD` | The password of the two demo accounts |

Create them in **your own** PowerShell window. The commands work in both
Windows PowerShell 5.1 and PowerShell 7, and nothing is displayed.

```powershell
# DB_PASSWORD: typed at a hidden prompt
$p = Read-Host "PostgreSQL password" -AsSecureString
[Environment]::SetEnvironmentVariable('DB_PASSWORD', [Net.NetworkCredential]::new('', $p).Password, 'User'); Remove-Variable p

# JWT_SECRET and C3_DEMO_PASSWORD: random, from the operating system's secure generator
$rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
$b = New-Object byte[] 48; $rng.GetBytes($b); [Environment]::SetEnvironmentVariable('JWT_SECRET', [Convert]::ToBase64String($b), 'User')
$b = New-Object byte[] 18; $rng.GetBytes($b)
[Environment]::SetEnvironmentVariable('C3_DEMO_PASSWORD', ([Convert]::ToBase64String($b) -replace '\+','-' -replace '/','_') + 'a7', 'User')
$rng.Dispose(); Remove-Variable b, rng
```

> Do not use `[Security.Cryptography.RandomNumberGenerator]::Fill`. It does not
> exist in Windows PowerShell 5.1, so the bytes stay zero and the "secret"
> becomes predictable.

Open a new terminal (or restart VS Code) after setting them.

## Start the three services

Use a separate terminal for each.

**1. ML service.** It listens on 127.0.0.1 only and is never called by the
browser directly.

```powershell
cd ml-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**2. Backend, with the demo seed switched on for this run only**

```powershell
cd backend
$env:APP_C3_DEMOSEED_ENABLED = 'true'
.\mvnw.cmd spring-boot:run
```

On startup:
- Flyway applies the shared and Component 3 migrations to `research_pms`.
- The log then shows `C3 demo seed finished. Created: [...]` on the first run,
  and `Created: nothing (all demo data existed)` on later runs.

Leave `APP_C3_DEMOSEED_ENABLED` out on ordinary runs.

**3. Frontend**

```powershell
cd frontend
npm run dev
```

## Open the demo

| What | Address |
|---|---|
| **Application** | **http://localhost:5173** |
| Research Workspace (modules 1–4) | http://localhost:5173/research |
| Research Intelligence (module 5) | http://localhost:5173/research-intelligence |
| Backend API | http://localhost:8080 |
| ML service API documentation | http://127.0.0.1:8000/docs |

Use **`localhost`**, not `127.0.0.1`, for the application. The backend's CORS
setting allows the browser origin `http://localhost:5173` only.

| Demo account | Email | Role in project `C3-DEMO` |
|---|---|---|
| Demo Student | `it99990001@my.sliit.lk` | Student |
| Demo Supervisor | `c3.demo.supervisor@sliit.lk` | Supervisor |

Both accounts use the password stored in `C3_DEMO_PASSWORD`. To see it on
your own screen only when you need it, for example to type it into the sign-in
form:

```powershell
[Environment]::GetEnvironmentVariable('C3_DEMO_PASSWORD','User')
```

Suggested walk-through:
1. Sign in as the student and post a question in Collaboration.
2. Sign in as the supervisor in a private window and reply.
3. Schedule a meeting and record its minutes.
4. Add a resource and search for it.
5. As the student, submit evidence linked to the meeting.
6. As the supervisor, verify the evidence.
7. Classify an abstract in Research Intelligence, then look at the trends,
   rising keywords and model evaluation.

## What the demo seed does, and does not do

The seed is `backend/src/main/java/com/researchpms/backend/c3/demo/C3DemoSeeder.java`.

- **It runs only** when `app.c3.demo-seed.enabled=true` and `C3_DEMO_PASSWORD`
  meets the password policy. Otherwise it creates nothing.
- **It only inserts:**
  - the two accounts, with passwords hashed by the application's own BCrypt
    encoder;
  - project `C3-DEMO`;
  - the two memberships.
- **Existing records are never touched.** An existing account, project or
  membership is left exactly as it is, password included. Nothing is updated
  or deleted.
- **On a conflict, nothing changes.** If the demo data conflicts with existing
  records (for example another person already has the demo registration
  number), the whole seed is rolled back and the backend starts normally.
- **Records made during a demo are kept.** Conversations, meetings, resources
  and evidence created while demonstrating are ordinary data in
  `research_pms`. There is no delete feature yet. For a clean slate, drop and
  recreate your local `research_pms` database, and the next start migrates
  and seeds it again.
