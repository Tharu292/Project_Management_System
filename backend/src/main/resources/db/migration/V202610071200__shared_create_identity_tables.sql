-- Shared identity foundation: users, projects and project memberships.
-- Owned by the shared module; used by all four components.

CREATE TABLE users (
    id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name          varchar(100) NOT NULL,
    last_name           varchar(100) NOT NULL,
    email               varchar(254) NOT NULL,
    password_hash       varchar(100) NOT NULL,
    account_type        varchar(20)  NOT NULL,
    system_role         varchar(20)  NOT NULL DEFAULT 'USER',
    registration_number varchar(20),
    staff_id            varchar(30),
    enabled             boolean      NOT NULL DEFAULT true,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email),
    -- UNIQUE allows any number of NULLs, so these apply only when a value is present.
    CONSTRAINT uq_users_registration_number UNIQUE (registration_number),
    CONSTRAINT uq_users_staff_id UNIQUE (staff_id),
    CONSTRAINT ck_users_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT ck_users_registration_number_uppercase CHECK (registration_number = upper(registration_number)),
    CONSTRAINT ck_users_account_type CHECK (account_type IN ('STUDENT', 'STAFF')),
    CONSTRAINT ck_users_system_role CHECK (system_role IN ('USER', 'ADMIN'))
);

CREATE INDEX idx_users_account_type ON users (account_type);

CREATE TABLE projects (
    id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code varchar(30)  NOT NULL,
    title        varchar(255) NOT NULL,
    status       varchar(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_projects_project_code UNIQUE (project_code),
    CONSTRAINT ck_projects_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED'))
);

CREATE TABLE project_members (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL,
    project_id   uuid        NOT NULL,
    project_role varchar(20) NOT NULL,
    active       boolean     NOT NULL DEFAULT true,
    joined_at    timestamptz NOT NULL DEFAULT now(),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects (id),
    -- One row per role: a user may hold several roles in a project, but not the same role twice.
    CONSTRAINT uq_project_members_user_project_role UNIQUE (user_id, project_id, project_role),
    CONSTRAINT ck_project_members_project_role
        CHECK (project_role IN ('STUDENT', 'SUPERVISOR', 'CO_SUPERVISOR', 'EVALUATOR'))
);

-- The unique constraint above already serves lookups by user; this serves lookups by project.
CREATE INDEX idx_project_members_project_role ON project_members (project_id, project_role);
