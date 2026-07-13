-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: roles, the permission catalogue, role→permission grants, dev users,
-- quiz keys, and per-user Tier-2 SQLi data. Dev passwords are bcrypt('password123').
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO roles (name) VALUES
  ('student'), ('trainee'), ('instructor'), ('admin')
ON CONFLICT (name) DO NOTHING;

-- Permission catalogue (§10 abridged matrix)
INSERT INTO permissions (name) VALUES
  ('lab:access'), ('mentor:chat'), ('quiz:submit'), ('score:self'),
  ('cert:self'), ('progress:self'),
  ('cohort:assign'), ('cohort:monitor'), ('cohort:review'), ('cohort:report'),
  ('module:edit'), ('scam-sim:create'), ('dataset:upload'), ('localization:manage'),
  ('prompt:tune'), ('user:manage'), ('role:assign'), ('provider:switch'),
  ('cert:issue'), ('audit:view')
ON CONFLICT (name) DO NOTHING;

-- student: all :self-scoped learner grants
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'student'
  AND p.name IN ('lab:access','mentor:chat','quiz:submit','score:self','cert:self','progress:self')
ON CONFLICT DO NOTHING;

-- trainee: teaching only (cohort-scoped monitoring), inherits student learner grants
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'trainee'
  AND p.name IN ('lab:access','mentor:chat','quiz:submit','score:self','cert:self','progress:self',
                 'cohort:assign','cohort:monitor','cohort:review','cohort:report')
ON CONFLICT DO NOTHING;

-- instructor: teaching + authoring
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'instructor'
  AND p.name IN ('lab:access','mentor:chat','quiz:submit','score:self','cert:self','progress:self',
                 'cohort:assign','cohort:monitor','cohort:review','cohort:report',
                 'module:edit','scam-sim:create','dataset:upload','localization:manage')
ON CONFLICT DO NOTHING;

-- admin: everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- ── Dev users ── password123 (bcrypt, cost 10) ────────────────────────────────
INSERT INTO users (id, email, password_hash, display_name, locale) VALUES
  ('11111111-1111-1111-1111-111111111111', 'student@nielit.test',
     '$2a$10$nIzNMWIhUbzPPK7gmd6yX.4DEgm0KoMpK3ajm8GMp12tud7HMdLo6', 'Asha Student', 'hi'),
  ('22222222-2222-2222-2222-222222222222', 'instructor@nielit.test',
     '$2a$10$nIzNMWIhUbzPPK7gmd6yX.4DEgm0KoMpK3ajm8GMp12tud7HMdLo6', 'Ravi Instructor', 'en'),
  ('33333333-3333-3333-3333-333333333333', 'admin@nielit.test',
     '$2a$10$nIzNMWIhUbzPPK7gmd6yX.4DEgm0KoMpK3ajm8GMp12tud7HMdLo6', 'Meera Admin', 'en')
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'student'
WHERE u.email = 'student@nielit.test' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'instructor'
WHERE u.email = 'instructor@nielit.test' ON CONFLICT DO NOTHING;
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'admin'
WHERE u.email = 'admin@nielit.test' ON CONFLICT DO NOTHING;

-- ── Cohort (NIELIT batch) ── student learner, instructor assigned ─────────────
INSERT INTO cohorts (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NIELIT Batch 2026-A')
ON CONFLICT DO NOTHING;
INSERT INTO cohort_members (cohort_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'learner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'instructor')
ON CONFLICT DO NOTHING;

-- ── Quiz keys ── held server-side (never sent to client) ──────────────────────
INSERT INTO quiz_keys (lab_id, question_id, correct, points) VALUES
  ('sqli',           'q1', '"c"', 10),
  ('sqli',           'q2', '"b"', 10),
  ('sqli',           'q3', '"d"', 10),
  ('digital-arrest', 'q1', '"b"', 10),
  ('digital-arrest', 'q2', '"c"', 10),
  ('digital-arrest', 'q3', '"a"', 10),
  ('secure-code-review', 'q1', '"b"', 10),
  ('secure-code-review', 'q2', '"a"', 10),
  ('secure-code-review', 'q3', '"c"', 10),
  ('upi-fraud',       'q1', '"b"', 10),
  ('upi-fraud',       'q2', '"c"', 10),
  ('upi-fraud',       'q3', '"a"', 10),
  ('idor',            'q1', '"c"', 10),
  ('idor',            'q2', '"b"', 10),
  ('idor',            'q3', '"d"', 10),
  ('qr-scam',            'q1', '"b"', 10), ('qr-scam',            'q2', '"a"', 10), ('qr-scam',            'q3', '"c"', 10),
  ('kyc-scam',           'q1', '"b"', 10), ('kyc-scam',           'q2', '"c"', 10), ('kyc-scam',           'q3', '"a"', 10),
  ('banking-fraud',      'q1', '"a"', 10), ('banking-fraud',      'q2', '"b"', 10), ('banking-fraud',      'q3', '"c"', 10),
  ('fake-customer-care', 'q1', '"c"', 10), ('fake-customer-care', 'q2', '"a"', 10), ('fake-customer-care', 'q3', '"b"', 10),
  ('fake-job-offer',     'q1', '"b"', 10), ('fake-job-offer',     'q2', '"a"', 10), ('fake-job-offer',     'q3', '"c"', 10),
  ('courier-customs',    'q1', '"a"', 10), ('courier-customs',    'q2', '"c"', 10), ('courier-customs',    'q3', '"b"', 10),
  ('otp-sim-swap',       'q1', '"b"', 10), ('otp-sim-swap',       'q2', '"a"', 10), ('otp-sim-swap',       'q3', '"d"', 10),
  ('phishing',           'q1', '"c"', 10), ('phishing',           'q2', '"b"', 10), ('phishing',           'q3', '"a"', 10),
  ('password-security',  'q1', '"b"', 10), ('password-security',  'q2', '"c"', 10), ('password-security',  'q3', '"a"', 10),
  ('mobile-security',    'q1', '"a"', 10), ('mobile-security',    'q2', '"b"', 10), ('mobile-security',    'q3', '"c"', 10),
  ('social-media-safety','q1', '"b"', 10), ('social-media-safety','q2', '"a"', 10), ('social-media-safety','q3', '"c"', 10),
  ('digital-privacy',    'q1', '"c"', 10), ('digital-privacy',    'q2', '"a"', 10), ('digital-privacy',    'q3', '"b"', 10),
  ('deepfake-ai-scams',  'q1', '"a"', 10), ('deepfake-ai-scams',  'q2', '"b"', 10), ('deepfake-ai-scams',  'q3', '"c"', 10),
  ('cyber-hygiene',      'q1', '"b"', 10), ('cyber-hygiene',      'q2', '"a"', 10), ('cyber-hygiene',      'q3', '"d"', 10),
  ('threat-modeling',    'q1', '"b"', 10), ('threat-modeling',    'q2', '"c"', 10), ('threat-modeling',    'q3', '"a"', 10),
  ('incident-response',  'q1', '"a"', 10), ('incident-response',  'q2', '"b"', 10), ('incident-response',  'q3', '"c"', 10),
  ('recon',              'q1', '"c"', 10), ('recon',              'q2', '"a"', 10), ('recon',              'q3', '"b"', 10),
  ('xss',                'q1', '"b"', 10), ('xss',                'q2', '"a"', 10), ('xss',                'q3', '"c"', 10),
  ('csrf',               'q1', '"b"', 10), ('csrf',               'q2', '"a"', 10), ('csrf',               'q3', '"c"', 10),
  ('auth',               'q1', '"b"', 10), ('auth',               'q2', '"b"', 10), ('auth',               'q3', '"a"', 10),
  ('session',            'q1', '"b"', 10), ('session',            'q2', '"a"', 10), ('session',            'q3', '"c"', 10),
  ('bola',               'q1', '"a"', 10), ('bola',               'q2', '"b"', 10), ('bola',               'q3', '"c"', 10),
  ('business-logic',     'q1', '"b"', 10), ('business-logic',     'q2', '"c"', 10), ('business-logic',     'q3', '"a"', 10),
  ('race-condition',     'q1', '"a"', 10), ('race-condition',     'q2', '"b"', 10), ('race-condition',     'q3', '"c"', 10),
  ('api-security',       'q1', '"b"', 10), ('api-security',       'q2', '"a"', 10), ('api-security',       'q3', '"c"', 10),
  ('llm-security',       'q1', '"b"', 10), ('llm-security',       'q2', '"c"', 10), ('llm-security',       'q3', '"a"', 10),
  ('file-upload',        'q1', '"a"', 10), ('file-upload',        'q2', '"a"', 10), ('file-upload',        'q3', '"b"', 10),
  ('command-injection',  'q1', '"a"', 10), ('command-injection',  'q2', '"b"', 10), ('command-injection',  'q3', '"c"', 10),
  ('ssrf',               'q1', '"a"', 10), ('ssrf',               'q2', '"b"', 10), ('ssrf',               'q3', '"c"', 10),
  ('xxe',                'q1', '"a"', 10), ('xxe',                'q2', '"b"', 10), ('xxe',                'q3', '"c"', 10),
  ('deserialization',    'q1', '"a"', 10), ('deserialization',    'q2', '"b"', 10), ('deserialization',    'q3', '"c"', 10),
  ('path-traversal',     'q1', '"a"', 10), ('path-traversal',     'q2', '"b"', 10), ('path-traversal',     'q3', '"b"', 10),
  ('cloud-security',     'q1', '"a"', 10), ('cloud-security',     'q2', '"b"', 10), ('cloud-security',     'q3', '"c"', 10)
ON CONFLICT (lab_id, question_id) DO UPDATE
  SET correct = EXCLUDED.correct, points = EXCLUDED.points;

-- ── Tier-2 SQLi per-user data ── each dev user gets their own accounts ─────────
INSERT INTO lab_sqli_accounts (owner_id, username, password, role, secret_note) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin',  'S3cr3t_Adm1n_pw', 'admin', 'flag{sqli_union_exfil}'),
  ('11111111-1111-1111-1111-111111111111', 'asha',   'asha123',          'user',  'my bank otp is 4821'),
  ('11111111-1111-1111-1111-111111111111', 'rahul',  'rahul@2024',       'user',  'nothing here'),
  ('22222222-2222-2222-2222-222222222222', 'admin',  'S3cr3t_Adm1n_pw', 'admin', 'flag{sqli_union_exfil}'),
  ('22222222-2222-2222-2222-222222222222', 'ravi',   'ravi123',          'user',  'demo note'),
  ('33333333-3333-3333-3333-333333333333', 'admin',  'S3cr3t_Adm1n_pw', 'admin', 'flag{sqli_union_exfil}'),
  ('33333333-3333-3333-3333-333333333333', 'meera',  'meera123',         'user',  'demo note')
ON CONFLICT (owner_id, username) DO NOTHING;
