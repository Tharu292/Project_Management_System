# Database migrations (all components)

The database schema is managed by Flyway. Hibernate runs with
`spring.jpa.hibernate.ddl-auto=validate`, so it only checks that entities match
the tables; it never creates or alters them. Every new table or column needs a
migration file.

## Where files go

`backend/src/main/resources/db/migration/`

## Naming convention

```
V<yyyyMMddHHmm>__<owner>_<description>.sql
```

- `<yyyyMMddHHmm>` is the time you create the file, for example `202610071200`.
  Using a timestamp instead of `V1`, `V2`, ... means four branches never compete
  for the same version number.
- `<owner>` is `shared`, `c1`, `c2`, `c3` or `c4`.
- Two underscores separate the version from the description.

Examples:

```
V202610071200__shared_create_identity_tables.sql
V202610151030__c1_create_task_tables.sql
V202610201615__c4_create_reflection_tables.sql
```

## Rules

1. Never edit a migration that has been merged into `main`. Flyway stores a
   checksum of each applied file and refuses to start if one changes. Write a
   new migration instead.
2. Prefix component tables with the component (`c1_`, `c2_`, `c3_`, `c4_` or a
   short agreed prefix) so names cannot collide. Shared tables (`users`,
   `projects`, `project_members`) have no prefix.
3. Reference shared tables by UUID foreign key, for example
   `user_id uuid NOT NULL REFERENCES users (id)`.
4. `spring.flyway.out-of-order=true` is enabled, so a migration with an older
   timestamp that reaches `main` later is still applied.

## Local setup

Tests use a separate database so they cannot touch development data. Create it
once:

```sql
CREATE DATABASE research_pms_test;
```

Both databases are migrated automatically when the application or the tests
start. If you changed an unmerged migration of your own and Flyway reports a
checksum mismatch locally, drop and recreate your local database.
