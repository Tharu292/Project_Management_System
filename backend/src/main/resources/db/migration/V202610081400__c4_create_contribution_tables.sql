-- Component 4: contribution evidence and the Contribution Indicator.
-- Visible to the active members of the same project group and to the staff
-- assigned to it. Nothing here refers to, or is derived from, wellbeing data.

-- One row per version of the weights. Every calculated snapshot records the
-- version that produced it, so results stay reproducible when weights change.
CREATE TABLE c4_scoring_config (
    id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    version              integer      NOT NULL,
    development_weight   numeric(5,4) NOT NULL,
    task_weight          numeric(5,4) NOT NULL,
    collaboration_weight numeric(5,4) NOT NULL,
    -- METRIC_WEIGHTS: the share of the whole indicator each metric carries; the metrics
    -- of a category add up to that category's weight.
    -- PULL_REQUEST_STATE_MULTIPLIERS: how much a pull request counts in each state.
    metric_weights       jsonb        NOT NULL,
    active               boolean      NOT NULL DEFAULT false,
    note                 varchar(500),
    created_by           uuid,
    created_at           timestamptz  NOT NULL DEFAULT now(),
    updated_at           timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_c4_scoring_config_version UNIQUE (version),
    CONSTRAINT fk_c4_scoring_config_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT ck_c4_scoring_config_weight_range CHECK (
        development_weight BETWEEN 0 AND 1 AND task_weight BETWEEN 0 AND 1 AND collaboration_weight BETWEEN 0 AND 1),
    CONSTRAINT ck_c4_scoring_config_weight_sum CHECK (development_weight + task_weight + collaboration_weight = 1),
    -- COALESCE is needed: a missing key gives NULL, and a check constraint lets a NULL result through.
    CONSTRAINT ck_c4_scoring_config_metric_weights CHECK (
        COALESCE(jsonb_typeof(metric_weights -> 'METRIC_WEIGHTS'), '') = 'object'
        AND COALESCE(jsonb_typeof(metric_weights -> 'PULL_REQUEST_STATE_MULTIPLIERS'), '') = 'object')
);

-- At most one version is in use at a time.
CREATE UNIQUE INDEX uq_c4_scoring_config_one_active ON c4_scoring_config (active) WHERE active;

-- Configuration, not student data: version 1 of the weights.
--
--   Development      40%   commits 30%, pull requests 10%
--   Task completion  40%   completed assigned tasks 40%
--   Collaboration    20%   issue comments 10%, pull-request reviews 10%
--
-- These are the initial weights of the research design. They are configurable and
-- have not been validated; changing them means adding a new version, not editing this one.
--
-- PROVISIONAL: the pull-request state multipliers (merged 1.0, open 0.6, closed
-- without merging 0.3) are research assumptions, kept as configuration so that they
-- can be tested and replaced. Each pull request counts once, in its latest state.
INSERT INTO c4_scoring_config (version, development_weight, task_weight, collaboration_weight, metric_weights, active, note)
VALUES (1, 0.4000, 0.4000, 0.2000,
        '{"METRIC_WEIGHTS": {"COMMIT": 0.30, "PULL_REQUEST": 0.10, "COMPLETED_TASK": 0.40,
                             "ISSUE_COMMENT": 0.10, "PULL_REQUEST_REVIEW": 0.10},
          "PULL_REQUEST_STATE_MULTIPLIERS": {"MERGED": 1.0, "OPEN": 0.6, "CLOSED_UNMERGED": 0.3},
          "PROVISIONAL": ["PULL_REQUEST_STATE_MULTIPLIERS"]}'::jsonb,
        true,
        'Initial weights, configurable and not validated: Development 40% (commits 30%, pull requests 10%), '
        'Task completion 40%, Collaboration 20% (issue comments 10%, pull-request reviews 10%). '
        'PROVISIONAL: pull-request state multipliers (merged 1.0, open 0.6, closed unmerged 0.3) are research assumptions.');

CREATE TABLE c4_repository_link (
    id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid         NOT NULL,
    repo_owner varchar(100) NOT NULL,
    repo_name  varchar(100) NOT NULL,
    active     boolean      NOT NULL DEFAULT true,
    linked_by  uuid         NOT NULL,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_repository_link_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c4_repository_link_linked_by FOREIGN KEY (linked_by) REFERENCES users (id),
    CONSTRAINT uq_c4_repository_link UNIQUE (project_id, repo_owner, repo_name),
    -- GitHub names are case-insensitive, so they are stored lower-cased.
    CONSTRAINT ck_c4_repository_link_lowercase CHECK (repo_owner = lower(repo_owner) AND repo_name = lower(repo_name))
);

-- The GitHub username used to attribute repository activity to a student.
CREATE TABLE c4_github_identity (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL,
    github_login varchar(39) NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_github_identity_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT uq_c4_github_identity_user UNIQUE (user_id),
    CONSTRAINT uq_c4_github_identity_login UNIQUE (github_login),
    CONSTRAINT ck_c4_github_identity_lowercase CHECK (github_login = lower(github_login))
);

-- Every collection attempt, so that "the source could not be read" is recorded
-- and can never be mistaken for "the student did nothing".
CREATE TABLE c4_evidence_sync_run (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  uuid         NOT NULL,
    source      varchar(30)  NOT NULL,
    status      varchar(20)  NOT NULL,
    started_at  timestamptz  NOT NULL,
    finished_at timestamptz,
    detail      varchar(500),
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_evidence_sync_run_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT ck_c4_evidence_sync_run_source CHECK (source IN ('GITHUB', 'TASKS')),
    CONSTRAINT ck_c4_evidence_sync_run_status CHECK (status IN ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'))
);

CREATE INDEX idx_c4_evidence_sync_run_project ON c4_evidence_sync_run (project_id, started_at);

-- One row per piece of evidence. The same external item can only be stored once,
-- and each type belongs to exactly one category, so nothing is counted twice.
-- A pull request is one row for its whole life: when its state changes the row
-- is updated, so it is only ever counted once, in its latest state.
CREATE TABLE c4_contribution_evidence (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    uuid         NOT NULL,
    -- Null when the activity could not be matched to a student of the project.
    student_id    uuid,
    source        varchar(30)  NOT NULL,
    evidence_type varchar(30)  NOT NULL,
    external_id   varchar(200) NOT NULL,
    source_url    varchar(500),
    -- Pull requests only, and required for them: all three states are kept as evidence.
    state         varchar(20),
    occurred_at   timestamptz  NOT NULL,
    metadata      jsonb,
    sync_run_id   uuid,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_contribution_evidence_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c4_contribution_evidence_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_contribution_evidence_sync_run FOREIGN KEY (sync_run_id) REFERENCES c4_evidence_sync_run (id),
    CONSTRAINT uq_c4_contribution_evidence UNIQUE (project_id, source, evidence_type, external_id),
    CONSTRAINT ck_c4_contribution_evidence_source CHECK (source IN ('GITHUB', 'TASKS')),
    CONSTRAINT ck_c4_contribution_evidence_type CHECK (
        evidence_type IN ('COMMIT', 'PULL_REQUEST', 'ISSUE_COMMENT', 'PULL_REQUEST_REVIEW', 'COMPLETED_TASK')),
    -- "state IS NOT NULL" is needed: without it a pull request with no state would
    -- make the comparison unknown, and a check constraint lets an unknown result through.
    CONSTRAINT ck_c4_contribution_evidence_state CHECK (
        (evidence_type = 'PULL_REQUEST' AND state IS NOT NULL AND state IN ('OPEN', 'MERGED', 'CLOSED_UNMERGED'))
        OR (evidence_type <> 'PULL_REQUEST' AND state IS NULL))
);

CREATE INDEX idx_c4_contribution_evidence_student ON c4_contribution_evidence (project_id, student_id, occurred_at);

-- A calculated Contribution Indicator for one student over one period. It is
-- supporting evidence only: no assessment record is ever created from it.
CREATE TABLE c4_contribution_snapshot (
    id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid         NOT NULL,
    student_id          uuid         NOT NULL,
    period_start        date         NOT NULL,
    period_end          date         NOT NULL,
    scoring_config_id   uuid         NOT NULL,
    -- Per metric: its state (VALUE, VERIFIED_ZERO or UNAVAILABLE), raw count and normalised score.
    metrics             jsonb        NOT NULL,
    -- A category score is null only when every source it needs was unavailable.
    development_score   numeric(5,2),
    task_score          numeric(5,2),
    collaboration_score numeric(5,2),
    -- Null only when no evidence source at all was available.
    indicator           numeric(5,2),
    -- Which sources were available, and which were not, when this was calculated.
    coverage            jsonb        NOT NULL,
    partial             boolean      NOT NULL,
    computed_at         timestamptz  NOT NULL,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_contribution_snapshot_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c4_contribution_snapshot_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_contribution_snapshot_config FOREIGN KEY (scoring_config_id) REFERENCES c4_scoring_config (id),
    CONSTRAINT uq_c4_contribution_snapshot UNIQUE (project_id, student_id, period_start, period_end, scoring_config_id),
    CONSTRAINT ck_c4_contribution_snapshot_period CHECK (period_end >= period_start),
    CONSTRAINT ck_c4_contribution_snapshot_ranges CHECK (
        (development_score IS NULL OR development_score BETWEEN 0 AND 100)
        AND (task_score IS NULL OR task_score BETWEEN 0 AND 100)
        AND (collaboration_score IS NULL OR collaboration_score BETWEEN 0 AND 100)
        AND (indicator IS NULL OR indicator BETWEEN 0 AND 100))
);

CREATE INDEX idx_c4_contribution_snapshot_project ON c4_contribution_snapshot (project_id, period_end);
