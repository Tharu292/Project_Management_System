-- Component 4: academic assessment.
--
-- Supervisor-side and evaluator-side marks live in two separate tables and are
-- read through separate services. A supervisor or co-supervisor must never be
-- shown an evaluator's record, and an evaluator must never be shown a
-- supervisor-side record. Each record belongs to the one assessor who wrote it.
--
-- No marking structure is defined here. Stages, components, percentages,
-- release rules and any final-grade formula are entered later, as configuration,
-- once the official structure has been approved. Nothing in this schema
-- calculates a mark or a grade, and no mark is ever created from a
-- Contribution Indicator.

-- One row per version of the marking structure. Created empty.
CREATE TABLE c4_assessment_config (
    id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    version    integer      NOT NULL,
    active     boolean      NOT NULL DEFAULT false,
    note       varchar(500),
    created_by uuid,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_c4_assessment_config_version UNIQUE (version),
    CONSTRAINT fk_c4_assessment_config_created_by FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE UNIQUE INDEX uq_c4_assessment_config_one_active ON c4_assessment_config (active) WHERE active;

-- One assessed item of a structure (for example a stage or a component), and
-- which side marks it. The weight stays empty until the official value is known.
CREATE TABLE c4_assessment_config_entry (
    id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id      uuid         NOT NULL,
    code           varchar(50)  NOT NULL,
    name           varchar(150) NOT NULL,
    side           varchar(20)  NOT NULL,
    weight_percent numeric(5,2),
    display_order  integer      NOT NULL DEFAULT 0,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    updated_at     timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_assessment_config_entry_config FOREIGN KEY (config_id) REFERENCES c4_assessment_config (id),
    CONSTRAINT uq_c4_assessment_config_entry_code UNIQUE (config_id, code),
    -- Lets each mark table insist that it only refers to entries of its own side.
    CONSTRAINT uq_c4_assessment_config_entry_side UNIQUE (id, side),
    CONSTRAINT ck_c4_assessment_config_entry_side CHECK (side IN ('SUPERVISOR', 'EVALUATOR')),
    CONSTRAINT ck_c4_assessment_config_entry_weight CHECK (weight_percent IS NULL OR weight_percent BETWEEN 0 AND 100)
);

-- SUPERVISOR SIDE. Written by a supervisor or co-supervisor of the project.
CREATE TABLE c4_assessment_supervisor_mark (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid         NOT NULL,
    student_id      uuid         NOT NULL,
    config_entry_id uuid         NOT NULL,
    -- Always 'SUPERVISOR'; with the foreign key below it stops an evaluator-side entry being used here.
    side            varchar(20)  NOT NULL DEFAULT 'SUPERVISOR',
    assessor_id     uuid         NOT NULL,
    -- A percentage of this entry. Empty while the assessor is still drafting.
    mark_percent    numeric(5,2),
    feedback        text,
    status          varchar(20)  NOT NULL DEFAULT 'DRAFT',
    submitted_at    timestamptz,
    released_at     timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_assessment_supervisor_mark_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c4_assessment_supervisor_mark_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_assessment_supervisor_mark_assessor FOREIGN KEY (assessor_id) REFERENCES users (id),
    CONSTRAINT fk_c4_assessment_supervisor_mark_entry
        FOREIGN KEY (config_entry_id, side) REFERENCES c4_assessment_config_entry (id, side),
    -- One record per assessor, student and entry.
    CONSTRAINT uq_c4_assessment_supervisor_mark UNIQUE (project_id, student_id, config_entry_id, assessor_id),
    CONSTRAINT ck_c4_assessment_supervisor_mark_side CHECK (side = 'SUPERVISOR'),
    CONSTRAINT ck_c4_assessment_supervisor_mark_status CHECK (status IN ('DRAFT', 'SUBMITTED')),
    CONSTRAINT ck_c4_assessment_supervisor_mark_percent CHECK (mark_percent IS NULL OR mark_percent BETWEEN 0 AND 100),
    CONSTRAINT ck_c4_assessment_supervisor_mark_submitted CHECK (
        status = 'DRAFT' OR (mark_percent IS NOT NULL AND submitted_at IS NOT NULL)),
    -- Only a submitted mark can be released to the student.
    CONSTRAINT ck_c4_assessment_supervisor_mark_released CHECK (released_at IS NULL OR status = 'SUBMITTED')
);

CREATE INDEX idx_c4_assessment_supervisor_mark_assessor ON c4_assessment_supervisor_mark (project_id, assessor_id);
CREATE INDEX idx_c4_assessment_supervisor_mark_student ON c4_assessment_supervisor_mark (project_id, student_id);

-- EVALUATOR SIDE. Written by an evaluator assigned to the project.
CREATE TABLE c4_assessment_evaluator_mark (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid         NOT NULL,
    student_id      uuid         NOT NULL,
    config_entry_id uuid         NOT NULL,
    -- Always 'EVALUATOR'; with the foreign key below it stops a supervisor-side entry being used here.
    side            varchar(20)  NOT NULL DEFAULT 'EVALUATOR',
    assessor_id     uuid         NOT NULL,
    mark_percent    numeric(5,2),
    feedback        text,
    status          varchar(20)  NOT NULL DEFAULT 'DRAFT',
    submitted_at    timestamptz,
    released_at     timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_assessment_evaluator_mark_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c4_assessment_evaluator_mark_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_assessment_evaluator_mark_assessor FOREIGN KEY (assessor_id) REFERENCES users (id),
    CONSTRAINT fk_c4_assessment_evaluator_mark_entry
        FOREIGN KEY (config_entry_id, side) REFERENCES c4_assessment_config_entry (id, side),
    CONSTRAINT uq_c4_assessment_evaluator_mark UNIQUE (project_id, student_id, config_entry_id, assessor_id),
    CONSTRAINT ck_c4_assessment_evaluator_mark_side CHECK (side = 'EVALUATOR'),
    CONSTRAINT ck_c4_assessment_evaluator_mark_status CHECK (status IN ('DRAFT', 'SUBMITTED')),
    CONSTRAINT ck_c4_assessment_evaluator_mark_percent CHECK (mark_percent IS NULL OR mark_percent BETWEEN 0 AND 100),
    CONSTRAINT ck_c4_assessment_evaluator_mark_submitted CHECK (
        status = 'DRAFT' OR (mark_percent IS NOT NULL AND submitted_at IS NOT NULL)),
    CONSTRAINT ck_c4_assessment_evaluator_mark_released CHECK (released_at IS NULL OR status = 'SUBMITTED')
);

CREATE INDEX idx_c4_assessment_evaluator_mark_assessor ON c4_assessment_evaluator_mark (project_id, assessor_id);
CREATE INDEX idx_c4_assessment_evaluator_mark_student ON c4_assessment_evaluator_mark (project_id, student_id);

-- A generated summary of one student's contribution evidence for assessors.
-- It is built from contribution data only and never contains wellbeing data or marks.
CREATE TABLE c4_assessment_portfolio (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      uuid        NOT NULL,
    student_id      uuid        NOT NULL,
    config_entry_id uuid,
    snapshot_id     uuid,
    content         jsonb       NOT NULL,
    -- Links from each summarised item back to where it came from.
    source_refs     jsonb       NOT NULL,
    generated_by    uuid        NOT NULL,
    generated_at    timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_assessment_portfolio_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c4_assessment_portfolio_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_assessment_portfolio_entry FOREIGN KEY (config_entry_id) REFERENCES c4_assessment_config_entry (id),
    CONSTRAINT fk_c4_assessment_portfolio_snapshot FOREIGN KEY (snapshot_id) REFERENCES c4_contribution_snapshot (id),
    CONSTRAINT fk_c4_assessment_portfolio_generated_by FOREIGN KEY (generated_by) REFERENCES users (id)
);

CREATE INDEX idx_c4_assessment_portfolio_student ON c4_assessment_portfolio (project_id, student_id, generated_at);
