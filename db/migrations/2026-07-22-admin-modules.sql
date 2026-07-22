-- ─────────────────────────────────────────────────────────────────────────────
-- Admin console + module authoring (2026-07-22)
-- Idempotent (IF NOT EXISTS) so it's safe to re-run against an existing DB.
-- Also folded into db/schema.sql for fresh installs.
-- ─────────────────────────────────────────────────────────────────────────────

-- Account lifecycle: deactivate (reversible) → optionally hard-delete.
ALTER TABLE users   ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'active'; -- active | deactivated
ALTER TABLE users   ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Batch (cohort) lifecycle: suspend once the course is complete.
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'active';   -- active | suspended
ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Admin-authored modules. Built-in modules stay as JSON files under labs/manifests;
-- these are created in-app and stored as the same unified manifest shape.
CREATE TABLE IF NOT EXISTS modules (
  id          TEXT PRIMARY KEY,
  module      TEXT NOT NULL,                 -- 'appsec' | 'awareness'
  manifest    JSONB NOT NULL,                -- the full LabManifest
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visibility / ordering overlay keyed by module id — applies to ANY module,
-- built-in or authored, so admins can enable/disable/reorder without editing files.
CREATE TABLE IF NOT EXISTS module_settings (
  module_id   TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 100,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
