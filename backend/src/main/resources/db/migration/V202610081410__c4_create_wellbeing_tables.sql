-- Component 4: reflection-based wellbeing.
--
-- PRIVACY. Every table whose name starts with c4_wb_ holds one student's own
-- data. Only that student may read it, with one exception: c4_wb_summary,
-- whose three values (status, score, trend) may be shown to the active students
-- of the same project group, and only while the owner has opted in through
-- c4_wb_sharing_preference. Supervisors, co-supervisors, evaluators and
-- administrators must never be shown anything from these tables, and nothing
-- here may feed a Contribution Indicator, a mark or an evaluation.

-- Configuration, not student data: how a predicted emotion maps to a 1-5 value.
-- Created empty; no mapping exists until one has been reviewed and approved.
CREATE TABLE c4_emotion_score_mapping (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    mapping_version integer      NOT NULL,
    label_scheme    varchar(30)  NOT NULL,
    emotion_label   varchar(50)  NOT NULL,
    score           integer      NOT NULL,
    rationale       varchar(500) NOT NULL,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_c4_emotion_score_mapping UNIQUE (mapping_version, label_scheme, emotion_label),
    CONSTRAINT ck_c4_emotion_score_mapping_score CHECK (score BETWEEN 1 AND 5)
);

-- Configuration, not student data: status bands, trend thresholds and how much
-- history a summary needs. Created empty for the same reason.
CREATE TABLE c4_wb_settings (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    version                 integer     NOT NULL,
    status_bands            jsonb       NOT NULL,
    trend_params            jsonb       NOT NULL,
    summary_window_weeks    integer     NOT NULL,
    summary_min_reflections integer     NOT NULL,
    active                  boolean     NOT NULL DEFAULT false,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_c4_wb_settings_version UNIQUE (version),
    CONSTRAINT ck_c4_wb_settings_window CHECK (
        summary_window_weeks >= 1 AND summary_min_reflections BETWEEN 1 AND summary_window_weeks)
);

CREATE UNIQUE INDEX uq_c4_wb_settings_one_active ON c4_wb_settings (active) WHERE active;

-- OWNER ONLY. The four weekly answers.
CREATE TABLE c4_wb_reflection (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        uuid        NOT NULL,
    project_id        uuid        NOT NULL,
    iso_year          integer     NOT NULL,
    iso_week          integer     NOT NULL,
    work_done         text        NOT NULL,
    challenges        text        NOT NULL,
    next_steps        text        NOT NULL,
    progress_feeling  text        NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_wb_reflection_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_wb_reflection_project FOREIGN KEY (project_id) REFERENCES projects (id),
    -- One reflection per student, project and week.
    CONSTRAINT uq_c4_wb_reflection_week UNIQUE (student_id, project_id, iso_year, iso_week),
    CONSTRAINT ck_c4_wb_reflection_week CHECK (iso_week BETWEEN 1 AND 53)
);

-- OWNER ONLY. What the model said about one reflection. Removed with it.
CREATE TABLE c4_wb_emotion_prediction (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    reflection_id   uuid         NOT NULL,
    model_version   varchar(50)  NOT NULL,
    label_scheme    varchar(30)  NOT NULL,
    status          varchar(20)  NOT NULL,
    predicted_label varchar(50),
    decision_scores jsonb,
    -- Gap between the two highest decision scores. Not a probability.
    margin          numeric(8,4),
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_wb_emotion_prediction_reflection
        FOREIGN KEY (reflection_id) REFERENCES c4_wb_reflection (id) ON DELETE CASCADE,
    CONSTRAINT uq_c4_wb_emotion_prediction UNIQUE (reflection_id, model_version),
    CONSTRAINT ck_c4_wb_emotion_prediction_status CHECK (status IN ('PENDING', 'DONE', 'FAILED')),
    CONSTRAINT ck_c4_wb_emotion_prediction_done CHECK (status <> 'DONE' OR predicted_label IS NOT NULL)
);

-- OWNER ONLY. The weekly 1-5 value from one prediction under one mapping version.
CREATE TABLE c4_wb_score (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    reflection_id   uuid         NOT NULL,
    prediction_id   uuid         NOT NULL,
    mapping_version integer      NOT NULL,
    score           numeric(3,2) NOT NULL,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_wb_score_reflection FOREIGN KEY (reflection_id) REFERENCES c4_wb_reflection (id) ON DELETE CASCADE,
    CONSTRAINT fk_c4_wb_score_prediction
        FOREIGN KEY (prediction_id) REFERENCES c4_wb_emotion_prediction (id) ON DELETE CASCADE,
    CONSTRAINT uq_c4_wb_score UNIQUE (reflection_id, prediction_id, mapping_version),
    CONSTRAINT ck_c4_wb_score_range CHECK (score BETWEEN 1 AND 5)
);

-- OWNER ONLY.
CREATE TABLE c4_wb_recommendation (
    id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid          NOT NULL,
    project_id uuid          NOT NULL,
    iso_year   integer       NOT NULL,
    iso_week   integer       NOT NULL,
    rule_code  varchar(50)   NOT NULL,
    message    varchar(1000) NOT NULL,
    -- Why the rule fired, so the suggestion can be explained.
    inputs     jsonb,
    created_at timestamptz   NOT NULL DEFAULT now(),
    updated_at timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_wb_recommendation_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_wb_recommendation_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT ck_c4_wb_recommendation_week CHECK (iso_week BETWEEN 1 AND 53)
);

CREATE INDEX idx_c4_wb_recommendation_owner ON c4_wb_recommendation (student_id, project_id, iso_year, iso_week);

-- OWNER ONLY. Shown to the student and to nobody else; there is no staff alert.
CREATE TABLE c4_wb_warning (
    id         uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid          NOT NULL,
    project_id uuid          NOT NULL,
    rule_code  varchar(50)   NOT NULL,
    message    varchar(1000) NOT NULL,
    reason     jsonb,
    raised_at  timestamptz   NOT NULL,
    read_at    timestamptz,
    created_at timestamptz   NOT NULL DEFAULT now(),
    updated_at timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_wb_warning_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_wb_warning_project FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE INDEX idx_c4_wb_warning_owner ON c4_wb_warning (student_id, project_id);

-- OWNER ONLY. Whether the student has chosen to show their summary to their
-- group. No row, or shared = false, both mean "not shared": private is the default.
CREATE TABLE c4_wb_sharing_preference (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      uuid        NOT NULL,
    project_id      uuid        NOT NULL,
    shared          boolean     NOT NULL DEFAULT false,
    -- Which wording of the sharing notice the student agreed to, and when.
    notice_version  varchar(20),
    acknowledged_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_wb_sharing_preference_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_wb_sharing_preference_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT uq_c4_wb_sharing_preference UNIQUE (student_id, project_id),
    -- Sharing can never be switched on without a recorded acknowledgement.
    CONSTRAINT ck_c4_wb_sharing_preference_consent CHECK (
        NOT shared OR (acknowledged_at IS NOT NULL AND notice_version IS NOT NULL))
);

-- GROUP-VISIBLE WHEN OPTED IN. A rolling summary: exactly three values and
-- nothing that reveals when, or how often, the student reflected. This is the
-- only wellbeing table the group view reads.
CREATE TABLE c4_wb_summary (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  uuid         NOT NULL,
    project_id  uuid         NOT NULL,
    status      varchar(20)  NOT NULL,
    score       numeric(3,2) NOT NULL,
    trend       varchar(20)  NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    updated_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c4_wb_summary_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c4_wb_summary_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT uq_c4_wb_summary UNIQUE (student_id, project_id),
    CONSTRAINT ck_c4_wb_summary_status CHECK (status IN ('DOING_WELL', 'DOING_OKAY', 'COULD_BE_BETTER')),
    CONSTRAINT ck_c4_wb_summary_score CHECK (score BETWEEN 1 AND 5),
    CONSTRAINT ck_c4_wb_summary_trend CHECK (trend IN ('IMPROVING', 'STABLE', 'DECLINING'))
);

CREATE INDEX idx_c4_wb_summary_project ON c4_wb_summary (project_id);
