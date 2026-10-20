-- Component 3: Research Intelligence & Collaboration Ecosystem.
--
-- Supervisor-student conversations, meetings, the project knowledge repository
-- and the evidence portfolio. Every row belongs to one project and refers to the
-- shared projects and users tables. Access is decided in the services through
-- ProjectAccessService (active project_members rows), never by these tables.
--
-- The evidence portfolio holds evidence and its verification only. It contains
-- no marks, grades or rubrics: academic assessment belongs to Component 4.

-- Module 1: a progress update or question started by a student, and its replies.
CREATE TABLE c3_conversation (
    id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid         NOT NULL,
    author_id  uuid         NOT NULL,
    kind       varchar(20)  NOT NULL,
    subject    varchar(200) NOT NULL,
    body       text         NOT NULL,
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c3_conversation_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c3_conversation_author FOREIGN KEY (author_id) REFERENCES users (id),
    CONSTRAINT ck_c3_conversation_kind CHECK (kind IN ('PROGRESS_UPDATE', 'QUESTION')),
    CONSTRAINT ck_c3_conversation_body_length CHECK (char_length(body) <= 5000)
);

CREATE INDEX idx_c3_conversation_project ON c3_conversation (project_id, created_at);

CREATE TABLE c3_conversation_reply (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid        NOT NULL,
    author_id       uuid        NOT NULL,
    body            text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_c3_conversation_reply_conversation FOREIGN KEY (conversation_id) REFERENCES c3_conversation (id),
    CONSTRAINT fk_c3_conversation_reply_author FOREIGN KEY (author_id) REFERENCES users (id),
    CONSTRAINT ck_c3_conversation_reply_body_length CHECK (char_length(body) <= 5000)
);

CREATE INDEX idx_c3_conversation_reply_conversation ON c3_conversation_reply (conversation_id, created_at);

-- Module 2: a supervision meeting and, once held, its minutes.
CREATE TABLE c3_meeting (
    id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          uuid         NOT NULL,
    title               varchar(200) NOT NULL,
    scheduled_at        timestamptz  NOT NULL,
    duration_minutes    integer,
    location            varchar(500),
    agenda              text,
    created_by          uuid         NOT NULL,
    minutes             text,
    minutes_recorded_by uuid,
    minutes_recorded_at timestamptz,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c3_meeting_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c3_meeting_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_c3_meeting_minutes_recorded_by FOREIGN KEY (minutes_recorded_by) REFERENCES users (id),
    CONSTRAINT ck_c3_meeting_duration CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440),
    -- Minutes, their author and their time are recorded together or not at all.
    CONSTRAINT ck_c3_meeting_minutes_recorded CHECK (
        (minutes IS NULL AND minutes_recorded_by IS NULL AND minutes_recorded_at IS NULL)
        OR (minutes IS NOT NULL AND minutes_recorded_by IS NOT NULL AND minutes_recorded_at IS NOT NULL)),
    CONSTRAINT ck_c3_meeting_agenda_length CHECK (agenda IS NULL OR char_length(agenda) <= 5000),
    CONSTRAINT ck_c3_meeting_minutes_length CHECK (minutes IS NULL OR char_length(minutes) <= 10000)
);

CREATE INDEX idx_c3_meeting_project ON c3_meeting (project_id, scheduled_at);

-- Module 3: a research resource in the project's knowledge repository.
CREATE TABLE c3_resource (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    uuid          NOT NULL,
    resource_type varchar(20)   NOT NULL,
    title         varchar(300)  NOT NULL,
    url           varchar(2000),
    description   text,
    added_by      uuid          NOT NULL,
    created_at    timestamptz   NOT NULL DEFAULT now(),
    updated_at    timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT fk_c3_resource_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c3_resource_added_by FOREIGN KEY (added_by) REFERENCES users (id),
    CONSTRAINT ck_c3_resource_type CHECK (resource_type IN ('PAPER', 'LINK', 'NOTE', 'DATASET', 'DOCUMENT')),
    CONSTRAINT ck_c3_resource_content CHECK (url IS NOT NULL OR description IS NOT NULL),
    CONSTRAINT ck_c3_resource_description_length CHECK (description IS NULL OR char_length(description) <= 5000)
);

CREATE INDEX idx_c3_resource_project ON c3_resource (project_id, created_at);

-- Module 4: one piece of evidence of a student's work, optionally linked to a
-- meeting, conversation or resource of the same project, and its verification
-- by a supervisor. activity_id has no foreign key because it may point to one of
-- three tables; the service checks that it exists in the same project.
CREATE TABLE c3_evidence (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    uuid         NOT NULL,
    student_id    uuid         NOT NULL,
    title         varchar(200) NOT NULL,
    description   text,
    occurred_on   date         NOT NULL,
    activity_type varchar(20)  NOT NULL DEFAULT 'OTHER',
    activity_id   uuid,
    verified_by   uuid,
    verified_at   timestamptz,
    created_at    timestamptz  NOT NULL DEFAULT now(),
    updated_at    timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT fk_c3_evidence_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_c3_evidence_student FOREIGN KEY (student_id) REFERENCES users (id),
    CONSTRAINT fk_c3_evidence_verified_by FOREIGN KEY (verified_by) REFERENCES users (id),
    CONSTRAINT ck_c3_evidence_activity_type CHECK (activity_type IN ('MEETING', 'CONVERSATION', 'RESOURCE', 'OTHER')),
    CONSTRAINT ck_c3_evidence_activity_link CHECK ((activity_type = 'OTHER') = (activity_id IS NULL)),
    CONSTRAINT ck_c3_evidence_verified CHECK ((verified_by IS NULL) = (verified_at IS NULL)),
    CONSTRAINT ck_c3_evidence_description_length CHECK (description IS NULL OR char_length(description) <= 5000)
);

CREATE INDEX idx_c3_evidence_project ON c3_evidence (project_id, occurred_on);
