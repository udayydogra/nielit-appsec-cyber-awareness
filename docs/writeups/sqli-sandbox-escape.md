# Write-up: SQL-injection lab sandbox escape (found & fixed)

**Class:** Broken Access Control / Injection → cross-tenant data disclosure
**Where:** the platform's own SQL-injection *training* lab
**Found by:** adversarial self-review ("red-team your own build")
**Status:** fixed — the injection is still fully exploitable *as a lesson*, but its blast
radius is now sealed to the attacker's own session.
**CWE:** CWE-89 (SQL Injection), CWE-863 (Incorrect Authorization) · **OWASP:** A03, A01

---

## 1. Context — a vulnerability built on purpose

The platform teaches SQL injection by letting a student *actually perform one*. The lab
endpoint runs a query that is **deliberately** built by string concatenation:

```ts
// vulnapp/sqli.ts — the query is INTENTIONALLY injectable; that is the lesson.
const injected =
  `SELECT username, role, secret_note FROM accounts ` +
  `WHERE username = '${input}'`;       // student controls `input`
```

A student submits `' OR '1'='1` or `UNION SELECT ...` and sees real rows come back. Great
pedagogy — but an injectable query is a door, and the question I forced myself to ask during
review was: **what else does that door open?**

## 2. The escape

Originally the injectable query executed on the application's **main database role** — the
same role the rest of the backend uses. That role can read every table. So the "teaching"
injection was a live path into production data:

**Leak real password hashes (`users` table):**
```sql
' UNION SELECT username, password_hash, NULL FROM users --
```
Returned actual **bcrypt hashes** for every real account.

**Leak the quiz answer keys (`quiz_keys` table):**
```sql
' UNION SELECT lab_id, question_id, answer FROM quiz_keys --
```
Returned the answer keys that are supposed to live server-side *precisely so the client
never sees them*.

I reproduced both live before touching the fix. Impact: **any student could dump every
user's credential hash and every quiz answer** — from the lab whose entire purpose is to
teach why that must never happen. A textbook "the test setup wasn't safe" incident.

## 3. Root cause

The vulnerability was real and intended; the **privilege** behind it was not. The injectable
query inherited the application's full-access DB role, so `UNION SELECT ... FROM users`
resolved against real tables. The teaching door had production keys on it.

## 4. The fix — contain the blast radius (least privilege)

I did **not** sanitize the input (that would delete the lesson) and did **not** add a query
blocklist (attackers out-creative blocklists). I changed *what the query can reach*:

1. **A dedicated, locked-down Postgres role — `nielit_lab`** — used by a separate connection
   pool (`labPool`) that runs *only* the injectable query. It was never granted access to
   `users`, `quiz_keys`, or any real table, and has no write/DDL rights.
2. **A session-local temp `accounts` table**, seeded per user, so a student's injection —
   including `UNION SELECT ... FROM accounts` — still works against *their own* data (the
   lesson is intact), but there is nothing cross-tenant to reach.

```ts
// The injectable query now runs on the restricted nielit_lab role (labPool):
//   ' OR '1'='1              → still works (lesson preserved)
//   UNION SELECT ... accounts → still works (own session temp table)
//   UNION SELECT ... users    → ERROR: permission denied for table users
//   ; DROP TABLE / stacked    → ERROR: permission denied
await labPool.query(injected);
```

The injection is exactly as real as before; it just can no longer touch anything that
matters. Blast radius: one student's own session.

## 5. Verification

- `' UNION SELECT username, password_hash, NULL FROM users --` → **`permission denied for
  table users`** (was: full hash dump).
- `' UNION SELECT ... FROM quiz_keys --` → **`permission denied`** (was: answer-key dump).
- `' OR '1'='1` and `UNION SELECT ... FROM accounts` → **still return the student's own lab
  rows** — the lesson is unchanged.
- A Semgrep rule (`nielit-interpolated-sql`) now flags any *new* interpolated SQL outside
  `vulnapp/`, so this class can't silently reappear elsewhere in the codebase.

## 6. Lessons

- **A vulnerability built for teaching is still a vulnerability** — it respects your
  intentions not at all, only your privileges.
- **Contain the blast radius; don't enumerate the attacks.** Least privilege (a scoped DB
  role + a session-local table) beat both input sanitisation and query blocklists here.
- **Red-teaming your own product finds the assumptions you didn't know you'd made.** This
  was surfaced by deliberately attacking the platform, not by a test that happened to fail.
