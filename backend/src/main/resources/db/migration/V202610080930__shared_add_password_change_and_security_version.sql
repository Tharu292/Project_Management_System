-- First-login password change and token invalidation for shared accounts.
-- Existing rows keep working: nobody is forced to change a password they chose
-- themselves, and tokens issued before this migration lack the version claim
-- and are refused, so every user simply logs in again.

ALTER TABLE users
    -- True while the password was chosen by someone else (an administrator or
    -- the bootstrap configuration) and has not yet been replaced by its owner.
    ADD COLUMN must_change_password boolean NOT NULL DEFAULT false,
    -- Copied into every access token. Raised whenever existing tokens must stop
    -- working (password change, account disabled); it never goes down.
    ADD COLUMN security_version integer NOT NULL DEFAULT 0,
    ADD CONSTRAINT ck_users_security_version_not_negative CHECK (security_version >= 0);
