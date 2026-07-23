-- ─────────────────────────────────────────────────────────────────────────────
-- NIELIT AppSec + Cyber-Awareness Platform — schema
-- Deny-by-default authz is enforced in code; this schema stores the grant DATA
-- (roles→permissions) so grants are data, not code (§10 rule 1).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ── Identity ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT NOT NULL UNIQUE,
  username             TEXT,                       -- login handle (bulk-import "unique id"); login accepts email OR username
  password_hash        TEXT NOT NULL,              -- bcrypt; NEVER plaintext
  display_name         TEXT NOT NULL,
  locale               TEXT NOT NULL DEFAULT 'en', -- 'en' | 'hi'
  status               TEXT NOT NULL DEFAULT 'active', -- active | deactivated
  deactivated_at       TIMESTAMPTZ,
  password_expires_at  TIMESTAMPTZ,                -- NULL = never; set for emailed temp passwords
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username)) WHERE username IS NOT NULL;

-- ── RBAC ── roles are additive; permissions live in a table so grants are data ─
CREATE TABLE IF NOT EXISTS roles (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE               -- student | trainee | instructor | admin
);

CREATE TABLE IF NOT EXISTS permissions (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE               -- e.g. lab:access, prompt:tune
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id  INT  NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ── Cohorts ── the NIELIT batch = the scope boundary object for instructors ────
CREATE TABLE IF NOT EXISTS cohorts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active', -- active | suspended (course complete)
  suspended_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Admin-authored modules ── built-ins stay as JSON files; these live in the DB
CREATE TABLE IF NOT EXISTS modules (
  id          TEXT PRIMARY KEY,
  module      TEXT NOT NULL,                 -- 'appsec' | 'awareness'
  manifest    JSONB NOT NULL,                -- the full unified manifest
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Visibility / ordering overlay for ANY module id (built-in or authored) ─────
CREATE TABLE IF NOT EXISTS module_settings (
  module_id   TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 100,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- learners belong to cohorts; instructors are assigned to cohorts they may scope over
CREATE TABLE IF NOT EXISTS cohort_members (
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'learner',      -- learner | instructor
  PRIMARY KEY (cohort_id, user_id)
);

-- ── Telemetry spine ── one envelope for BOTH modules (server-emitted only) ─────
CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id      TEXT NOT NULL,
  event_type  TEXT NOT NULL,   -- lab_started|exploit_attempt|exploit_success|decision_made|
                               -- quiz_answered|node_completed|lab_completed|hint_requested
  node_id     TEXT,
  outcome     TEXT,            -- positive | negative | neutral | success | fail
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_user_lab ON events(user_id, lab_id);

-- ── Scoring ── quiz keys are HELD server-side, never sent to the client ────────
CREATE TABLE IF NOT EXISTS quiz_keys (
  lab_id      TEXT NOT NULL,
  question_id TEXT NOT NULL,
  correct     JSONB NOT NULL,   -- string or array of correct choice ids
  points      INT  NOT NULL DEFAULT 10,
  PRIMARY KEY (lab_id, question_id)
);

CREATE TABLE IF NOT EXISTS scores (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id      TEXT NOT NULL,
  score       INT  NOT NULL DEFAULT 0,
  max_score   INT  NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lab_id)
);

-- ── Progress ── which nodes/steps a user has completed per lab ─────────────────
CREATE TABLE IF NOT EXISTS progress (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id       TEXT NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT false,
  state        JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {visitedNodes, currentNode, ...}
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lab_id)
);

-- ── Certificates ── system-issued, HMAC-signed, one per (user, lab), idempotent ─
CREATE TABLE IF NOT EXISTS certificates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab_id      TEXT NOT NULL,
  score       INT  NOT NULL,
  signature   TEXT NOT NULL,   -- HMAC over canonical payload
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lab_id)
);

-- ── Audit log ── every privileged write and cross-user read (§10) ─────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target      TEXT,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tier-2 SQLi lab data ── per-user rows in ONE shared table (multi-tenant) ───
-- The vulnerable query is deliberately injectable; tenancy is the reset boundary.
CREATE TABLE IF NOT EXISTS lab_sqli_accounts (
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  password    TEXT NOT NULL,     -- intentionally plaintext: it's the lab's "secret" to exfil
  role        TEXT NOT NULL DEFAULT 'user',
  secret_note TEXT,
  PRIMARY KEY (owner_id, username)
);

-- ── Tier-2 IDOR lab data ── per-user sandbox of personas' invoices ────────────
-- The vulnerable endpoint fetches by invoice_id WITHOUT checking belongs_to against
-- the session persona (the IDOR). owner_id pins the tenant so the exploit only ever
-- reaches the caller's own seeded personas, never another real student's data.
CREATE TABLE IF NOT EXISTS lab_idor_invoices (
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id  INT  NOT NULL,
  belongs_to  TEXT NOT NULL,     -- the fictional persona who owns this invoice
  amount      INT  NOT NULL,
  secret      TEXT,              -- the lab's "secret" to leak via IDOR
  PRIMARY KEY (owner_id, invoice_id)
);

-- ── Tier-2 Stored-XSS lab ── per-user guestbook; bodies stored RAW (the vuln is
-- rendering them unescaped on the client). Rendered inside a sandboxed iframe so
-- the payload executes contained, never against the real SPA.
CREATE TABLE IF NOT EXISTS lab_xss_comments (
  id         BIGSERIAL PRIMARY KEY,
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_xss_owner ON lab_xss_comments(owner_id);

-- ── Tier-2 CSRF lab ── a per-user profile whose email a state-changing endpoint
-- updates with NO anti-CSRF token (the vuln).
CREATE TABLE IF NOT EXISTS lab_csrf_profile (
  owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email    TEXT NOT NULL
);

-- ── Tier-2 Broken-Auth lab ── per-user sandbox with a weak-PIN victim account.
-- The login endpoint leaks which usernames exist and has no lockout (the vuln).
CREATE TABLE IF NOT EXISTS lab_auth_accounts (
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  pin      TEXT NOT NULL,
  secret   TEXT,
  PRIMARY KEY (owner_id, username)
);

-- ── Tier-2 BOLA lab ── per-user sandbox of personas' API orders. The order API
-- checks neither read nor write against the caller's persona (the vuln).
CREATE TABLE IF NOT EXISTS lab_bola_orders (
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id   INT  NOT NULL,
  belongs_to TEXT NOT NULL,
  item       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'processing',
  secret     TEXT,
  PRIMARY KEY (owner_id, order_id)
);

-- ── Tier-2 Race-Condition lab ── per-user wallet; non-atomic withdraw is the vuln.
CREATE TABLE IF NOT EXISTS lab_race_wallet (
  owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance  INT NOT NULL DEFAULT 100
);

-- ── Tier-2 API-Security lab ── per-user profile; GET over-exposes and PATCH
-- mass-assigns role/is_admin (the vulns).
CREATE TABLE IF NOT EXISTS lab_api_profile (
  owner_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL DEFAULT 'You',
  role          TEXT NOT NULL DEFAULT 'user',
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  password_hash TEXT NOT NULL DEFAULT '',
  internal_note TEXT NOT NULL DEFAULT ''
);
