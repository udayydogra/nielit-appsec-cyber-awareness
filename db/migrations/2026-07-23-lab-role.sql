-- ─────────────────────────────────────────────────────────────────────────────
-- Security review fix #1 — a locked-down role for the deliberately-injectable SQLi
-- lab target. It has NO privileges on any application table, so an injection that
-- tries `UNION SELECT ... FROM users` (or stacked write/DDL) fails with permission
-- denied. It can only CONNECT and create session TEMP tables, which is all the lab
-- needs (rows are seeded into a temp table by the app on the privileged connection).
--
-- Idempotent. The password is a DEPLOYMENT SECRET: set it to a strong random value
-- and keep it in sync with PGPASSWORD_LAB. Run as the DB owner/superuser:
--     ALTER ROLE nielit_lab PASSWORD '<from PGPASSWORD_LAB>';
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nielit_lab') THEN
    CREATE ROLE nielit_lab LOGIN PASSWORD 'change-me-set-PGPASSWORD_LAB';
  END IF;
END $$;

-- Strip everything, then grant only connect + temp-table creation.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM nielit_lab;
REVOKE ALL ON SCHEMA public FROM nielit_lab;
GRANT CONNECT   ON DATABASE nielit TO nielit_lab;
GRANT TEMPORARY ON DATABASE nielit TO nielit_lab;
