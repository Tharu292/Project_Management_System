# Project access (shared module)

Authentication says who the caller is (see `authentication.md`). Project
access says what they may do in a particular project. It is decided only by
active rows in `project_members`.

## Roles

| Kind | Values | Stored in | Scope |
|---|---|---|---|
| System role | `USER`, `ADMIN` | `users.system_role` | Whole system |
| Project role | `STUDENT`, `SUPERVISOR`, `CO_SUPERVISOR`, `EVALUATOR` | `project_members.project_role` | One project |

- A user may hold several roles in the same project (one row per role) and
  different roles in different projects. Always ask "does the user hold role X
  in project Y", never "what is the user's role".
- A row with `active = false` grants nothing.
- Account type (`STUDENT` / `STAFF`) is not a permission. Only project roles are.
- Project roles are not in the JWT. They are read from the database on every
  check, so adding or removing a member takes effect immediately.

## Using it in a component

Inject `ProjectAccessService` and call a guard at the start of the service or
controller method that touches a project resource:

```java
projectAccess.requireMember(projectId);
projectAccess.requireRole(projectId, ProjectRole.SUPERVISOR);
projectAccess.requireAnyRole(projectId, ProjectRole.SUPERVISOR, ProjectRole.CO_SUPERVISOR);
```

When a decision depends on the role rather than being a plain allow/deny:

```java
Set<ProjectRole> roles = projectAccess.getCurrentUserRoles(projectId);
boolean supervises = projectAccess.currentUserHasRole(projectId, ProjectRole.SUPERVISOR);
```

To ask about a user other than the caller (for example, "is this student in
the project?"):

```java
projectAccess.isMember(userId, projectId);
projectAccess.hasRole(userId, projectId, ProjectRole.STUDENT);
projectAccess.getRoles(userId, projectId);
```

Always take the project id from the resource being accessed (load the task,
meeting, reflection, ... and use its project id). A project id sent by the
client only proves access to that project, not to the resource.

## Responses

| Situation | Status |
|---|---|
| No or invalid token | 401 |
| Signed in, but not a member / lacks the role | 403 |
| Project id does not exist | 403 (same as a project the user is not in, so ids cannot be probed) |

## Admins

`ADMIN` is not a bypass. The rule for all project data is:

```
authenticated user -> active ProjectMember -> project role -> access
```

An admin without an active membership fails `requireMember`, `requireRole`
and `requireAnyRole` exactly like any other non-member, and has no roles. An
admin who is a member has only the roles of that membership.

`requireMemberOrAdmin` is the single exception. It is an explicit opt-in for
future administrative operations (for example, an admin screen that manages a
project's member list). Do not use it to guard ordinary or sensitive project
data such as tasks, documents, evaluations or wellbeing data; use
`requireMember` or a role check there. `requireAdmin` is for system-level
operations that are not about one project's data.

## Not part of the shared module

- Creating projects and adding or removing members. Whichever component owns
  that workflow writes `Project` / `ProjectMember` rows through the shared
  repositories.
- Rules about what each role may do inside a component. Each component decides
  that and enforces it with the guards above.
