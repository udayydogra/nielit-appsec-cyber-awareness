# Security Review — Issues To Fix

**Scope:** Adversarial self-review of the NIELIT AppSec + Cyber-Awareness platform (backend, DB, containers, frontend, config).
**Date:** 2026-07-23. **Reviewer stance:** attacker with an ordinary student account, plus repo read access.
**Legend:** 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low. Items marked **PROVEN** were demonstrated live against the running stack.

| # | Sev | Issue | Status |
|---|-----|-------|--------|
| 1 | 🔴 | SQLi lab escapes its sandbox → reads the real `users`, `quiz_keys`, `certificates` tables; likely write/DDL too | ✅ **FIXED & verified** |
| 2 | 🔴 | Default signing secrets (`dev-only-change-me`) shipped in `.env` → forge any session + any certificate | ✅ **FIXED** |
| 3 | 🟠 | Deactivated accounts keep full access until their 12 h token expires | ✅ **FIXED & verified** |
| 4 | 🟠 | No rate-limit / lockout on `/auth/login` → real login is brute-forceable | ✅ **FIXED & verified** |
| 5 | 🟡 | Production CORS reflects **any** origin with credentials | ✅ **FIXED** |
| 6 | 🟡 | lab-manager holds the host Docker socket → any RCE in it = full host takeover | ⏳ open (deployment) |
| 7 | 🟡 | Authored Tier-3 modules run `nielit/<id>:latest` — review who can author | ✅ **FIXED** |
| 8 | ⚪ | Login user-enumeration: deactivated account returns 403, unknown returns 401 | ⏳ open (UX trade-off) |
| 9 | ⚪ | 12 h JWT with no revocation / refresh (compounds #3) | ◑ mitigated by #3 |
| 10 | ⚪ | Password policy is length-only (≥ 8) | ⏳ open (low) |

## Resolution log (2026-07-23)

- **#1** — The injectable query now runs on a new **locked-down `nielit_lab` Postgres role** (`db.ts` `labPool`) that has *no* privileges on any application table; the lab's rows are seeded into a session `TEMP TABLE` on that connection. Verified: `UNION SELECT … FROM users`/`quiz_keys` now returns **"permission denied"** (0 rows), while the intended auth-bypass tautology and `UNION SELECT … FROM accounts` still work (flag intact). Migration `db/migrations/2026-07-23-lab-role.sql`; role wired via `PGUSER_LAB`/`PGPASSWORD_LAB`.
- **#2** — `JWT_SECRET` and `CERT_SIGNING_SECRET` rotated to 32-byte random values in `.env` (git-ignored); `config.ts` now **refuses to boot in production** if either is default/short or `PGPASSWORD_LAB` is unset.
- **#3** — `session.ts` now selects and checks `status` on **every** request; a deactivated account's live token is rejected (verified: `/auth/me` → 200 before, 401 immediately after deactivation).
- **#4** — `/auth/login` now passes through the Redis rate-limiter (`RATE_LOGIN_PER_MIN`, default 10/min per IP); verified 429 after the limit.
- **#5** — CORS uses an explicit `FRONTEND_ORIGIN` allowlist in production instead of reflecting any origin.
- **#7** — Authoring or editing a Tier-3 (container-backed) module now requires the admin-level `user:manage` permission, not just `module:edit`.
- **Still open:** #6 (front the Docker socket with a restricting proxy — deployment task), #8 (return generic 401 for deactivated login — UX trade-off), #9 (token-version revocation / shorter expiry — largely mitigated by #3's per-request status check), #10 (breach/complexity password policy).

> **Operational note:** rotating `JWT_SECRET` invalidated all existing sessions — everyone (including any open browser tab) must log in again. On a fresh install, apply `db/migrations/2026-07-23-lab-role.sql` and set `PGPASSWORD_LAB` before starting the lab-manager.

---

### Original findings (retained for reference)

---

## 🔴 1. The SQL-injection lab is a real injection against the production database

**Where:** `lab-manager/src/vulnapp/sqli.ts` — `sqliLogin()`. The endpoint is `POST /labs/sqli/login`, gated only by `lab:access`, which **every student has**.

**What's wrong.** The lab builds its query by concatenating the learner's input and then executes it with `client.query(injected)` — **no parameters**, which makes node-postgres use the *simple query protocol*. The query runs on the **same full-privilege `nielit` role** the whole app uses (`db.ts` shared pool). The code tries to contain the blast radius with a session-local `CREATE TEMP TABLE accounts` — but that only shadows `FROM accounts`. Nothing stops the injected query from selecting `FROM users`, `FROM quiz_keys`, `FROM certificates`, `FROM lab_sqli_accounts` (every owner's rows), etc. Because it's the simple protocol on a privileged role, **stacked statements** (`'; UPDATE …; --`, `'; DROP TABLE …; --`) are almost certainly executable too.

**Proven exploit (read-only, as an ordinary student):**
```
POST /labs/sqli/login
{"username":"x' UNION SELECT email,'pwned',password_hash FROM users -- ","password":"x"}
→ leaked admin@nielit.test / instructor@ / student@ with their bcrypt hashes

{"username":"x' UNION SELECT lab_id,question_id,correct::text FROM quiz_keys LIMIT 5 -- ","password":"x"}
→ leaked the server-side quiz ANSWER KEYS
```

**Impact.** Full read of every user's credentials hash and PII, the "never-shipped" quiz answer keys, and every certificate; plausibly full write/DDL (data destruction, privilege escalation by rewriting `user_roles`, forging certificates). This single lab defeats nearly every other control in the platform.

**Fix (do all three):**
1. **Least-privilege DB role for lab targets.** Run the injectable query on a dedicated Postgres role that can see *only* a per-session temp schema and nothing else — no `users`, `quiz_keys`, `role_permissions`, other labs' tables. Best: a separate connection/pool with a role `GRANT`ed only what the lab needs, or a throwaway per-session schema, or a separate database for lab targets.
2. **Forbid stacked statements** even on that role (single-statement execution; e.g. wrap in a read-only transaction and/or use a driver path that disallows multiple commands).
3. **Keep the injection real but sealed:** seed the lab's data into that isolated role/schema so the learner's `UNION`/tautology still works against the lab data but cannot reach anything else.

---

## 🔴 2. Default signing secrets are shipped in `.env`

**Where:** `lab-manager/src/config.ts` — `jwtSecret` and `certSigningSecret` both default to `'dev-only-change-me'`; **`.env` sets both to exactly that default.**

**What's wrong.** The session JWT and the certificate HMAC are signed with a secret that is (a) the well-known source default and (b) committed in `.env`. Anyone with the repo can:
- **Forge a session** for any user id → instant login as admin (full user/role/module control) — no password needed.
- **Forge valid certificates** that pass `/verify/:certId`.

**Impact.** Complete authentication bypass and certificate forgery. This is game-over on its own.

**Fix.**
1. Generate high-entropy random values for `JWT_SECRET` and `CERT_SIGNING_SECRET` (e.g. 32+ bytes) per deployment; **never commit them**.
2. Make startup **refuse to boot in production** if either secret equals the default (or is unset). A three-line guard in `config.ts`.
3. Ensure `.env` is git-ignored and rotate the secrets, since the current value is effectively public. Invalidate existing sessions/certs after rotation.

---

## 🟠 3. Deactivated accounts keep working until token expiry

**Where:** `lab-manager/src/auth/session.ts` — `sessionMiddleware` loads the user with `SELECT id, email, display_name, locale … WHERE id = $1` and **never checks `status`.**

**What's wrong.** Deactivation is only enforced at `/auth/login`. A user who is deactivated (or the first step of a delete) while holding a valid session cookie retains **full access for up to 12 hours**, because every request re-derives the user without consulting `status`.

**Impact.** "Suspend this account now" doesn't actually cut off an active session — a disgruntled or compromised account stays live.

**Fix.** Add `status` to the session `SELECT` and reject (`return next()` without setting `req.user`, i.e. treat as unauthenticated) when `status = 'deactivated'`. Optionally add a token `version`/`iat` check so deactivation is instant.

---

## 🟠 4. No rate-limiting or lockout on `/auth/login`

**Where:** `lab-manager/src/routes/auth.ts` — the login handler has **no** `rateLimit(...)`. The rate limiter (`middleware/rateLimit.ts`) is only applied to `/mentor/ask` and `/labs/:id/start`.

**What's wrong.** The real authentication endpoint has no throttling and no lockout, so credentials can be brute-forced offline-speed. (Notably, the platform's own *broken-authentication lab* teaches "no lockout" as the vulnerability.)

**Impact.** Password guessing against real accounts, including admin.

**Fix.** Apply the existing rate limiter to `/auth/login` keyed by IP **and** by target email, with a short window and a lockout/backoff after N failures. Add `rateLimits.loginPerMin` to config.

---

## 🟡 5. Production CORS reflects any origin with credentials

**Where:** `lab-manager/src/index.ts` — `cors({ origin: config.env === 'production' ? true : [...], credentials: true })`.

**What's wrong.** In production `origin: true` echoes back whatever `Origin` the caller sends and pairs it with `credentials: true`, i.e. *any* website is a permitted cross-origin caller. Today this is **partly** mitigated because the session cookie is `SameSite=lax` (the browser won't attach it to cross-site `fetch`), but it's a misconfiguration and a defense-in-depth failure — the day the cookie policy changes to `SameSite=none`, it becomes cross-origin account-data theft.

**Fix.** Use an explicit allowlist of the deployed front-end origin(s) in production too, not `true`.

---

## 🟡 6. lab-manager has the host Docker socket

**Where:** `docker-compose.yml` — the lab-manager container bind-mounts `/var/run/docker.sock`.

**What's wrong.** This is by design (it spawns Tier-3 targets), but it means **any** remote-code-execution or SSRF-to-socket in lab-manager equals full root on the host. lab-manager is a high-value target precisely because it orchestrates attacker-influenced containers, and finding #1 shows the app surface is not flawless.

**Fix (defense-in-depth).** Front the socket with a restricting proxy (e.g. a docker-socket-proxy) that permits only the container-create/kill/exec API subset the platform needs; or use a rootless/remote Docker endpoint; deny the raw socket. Keep the existing per-target hardening (`--network none`, read-only, cap-drop, pids/memory limits, gVisor in prod).

---

## 🟡 7. Authored Tier-3 modules choose their container image

**Where:** `lab-manager/src/routes/labs.ts` — Tier-3 start uses `image = \`nielit/${m.id}:latest\``, and modules can be authored via `POST /admin/modules` (permission `module:edit`).

**What's wrong.** The image is derived from the (validated, kebab-case) module id, so it's constrained to the `nielit/` namespace rather than an arbitrary registry pull — good. But whoever holds `module:edit` (instructor and admin per the seed) can point a live lab at any `nielit/*` image present on the host. Review whether instructors should be able to define container-backed labs at all.

**Fix.** Restrict Tier-3 authoring to admins; and/or maintain an allowlist of approved Tier-3 target images rather than deriving the name from the module id.

---

## ⚪ 8. Login user-enumeration via distinct responses

**Where:** `lab-manager/src/routes/auth.ts` — unknown/incorrect returns `401 invalid credentials`, but a deactivated account returns `403 this account has been deactivated`.

**What's wrong.** The 403 confirms that an email is a real, deactivated account, partially undoing the otherwise-good constant-response design.

**Fix.** Return the generic `401` for deactivated accounts too (still audit the deactivated-login attempt server-side); surface the "deactivated" reason only through an out-of-band channel if needed.

---

## ⚪ 9. Long-lived JWT with no revocation

**Where:** `lab-manager/src/auth/session.ts` — 12 h expiry, no refresh, no server-side revocation list.

**What's wrong.** Compounds #3 (a leaked or should-be-revoked token stays valid for 12 h).

**Fix.** Shorten the access-token lifetime with a refresh flow, or add a per-user token version bumped on deactivate/password-change so old tokens fail validation immediately.

---

## ⚪ 10. Password policy is length-only

**Where:** `admin.ts` (`createUser`) and `me.ts` (`changePassword`) enforce only length ≥ 8.

**Fix.** Add a common-password/breach blocklist and/or a minimal complexity or zxcvbn-style entropy check; keep length ≥ 12 for privileged roles.

---

## Verified OK (checked and found sound)

These were reviewed adversarially and are **not** vulnerable, worth recording so the audit is complete:

- **Other Tier-2 labs (IDOR, BOLA, API-security, broken-auth, CSRF, race, business-logic, file-upload)** — they use **parameterised** queries and filter by `owner_id`, so the intended exploit reaches only the learner's own seeded personas and cannot pivot to other tables or other tenants. SQLi is the lone outlier because it alone concatenates into SQL.
- **Stored-XSS lab** — rendered inside `<iframe sandbox="allow-scripts">` (opaque origin, no `allow-same-origin`), so the payload executes contained and cannot touch the parent SPA, cookies, or session.
- **Identity is never client-supplied** — every request derives the user from the signed cookie; no user id in `/me/*` URLs; admin/self operations are permission- and scope-gated through a single middleware and audited.
- **Quiz keys / authored-module answers** are stripped server-side and never shipped (the *only* way to reach them is via bug #1).
- **Tier-3 container hardening** — `--network none`, read-only FS, `--cap-drop=ALL`, pids/memory limits, auto-reap; the terminal WS is cookie-authenticated and ownership-scoped.
- **Mentor provider URLs** come from config/env, not user input — no SSRF from learners.

---

## Suggested fix order

1. **#2 secrets** (trivial, total-compromise) — rotate + boot-guard first.
2. **#1 SQLi isolation** (the marquee bug) — dedicated low-privilege role/schema for lab targets, single-statement execution.
3. **#3 + #4 + #9** (session status check, login rate-limit/lockout, token revocation) — small, high-value auth hardening.
4. **#5 CORS allowlist**, **#7 Tier-3 authoring restriction**.
5. **#6 socket proxy**, **#8 enumeration**, **#10 password policy** — hardening pass.

---

## New capability (2026-07-24): `apt` in Tier-3 lab boxes — security posture

Students can now `apt install` tools in every Tier-3 container. Implemented safely, but two residual hardening items apply for a real multi-user deployment:

- **Root-in-container needs gVisor + userns-remap in prod.** The terminal execs as root so apt works; host priv-esc is blocked by `--cap-drop=ALL` (only CHOWN/DAC_OVERRIDE/FOWNER/FSETID/SETUID/SETGID/NET_RAW added), `--security-opt=no-new-privileges`, and the reaper. In THIS dev env `CONTAINER_RUNTIME=runc` (no gVisor) and the daemon has no userns-remap, so container-root ≈ host-uid-0 if a kernel/runtime escape existed. **Prod:** set `CONTAINER_RUNTIME=runsc` (gVisor) and `"userns-remap": "default"` in the daemon.
- **Cross-tenant reachability on `nielit-labnet`.** Lab containers moved from `--network none` to a shared internal bridge (so they can reach the apt proxy). Peers on that bridge can reach each other. Low impact — T3 boxes are identical, disposable, hold no per-user secrets, and the net is `internal` (no internet pivot) — but a student could port-scan/DoS a peer's box. **Harden later:** per-tenant network policy, or an egress firewall that permits only the proxy:3142.

Verified: apt-install works via the proxy on all 5 T3 labs; direct internet is unreachable; each lab's exploit + flag still work; installs are wiped on exit / 30-min reap. Set `CONTAINER_NETWORK=none` to revert to full isolation (disables apt).
