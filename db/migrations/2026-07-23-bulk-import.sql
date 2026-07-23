-- ─────────────────────────────────────────────────────────────────────────────
-- Bulk user import (CSV/Excel) + emailed temporary credentials (2026-07-23)
-- Idempotent. Also folded into db/schema.sql for fresh installs.
-- ─────────────────────────────────────────────────────────────────────────────

-- A login handle (the "unique id" column of the import file). Login accepts either
-- the email or this username. UNIQUE with multiple NULLs allowed (existing users).
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username)) WHERE username IS NOT NULL;

-- Temporary-password lifecycle. A bulk-imported user gets a temp password that is
-- valid only until this instant; NULL means the password never expires (normal
-- accounts). On first login the user is prompted to set a permanent password.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
