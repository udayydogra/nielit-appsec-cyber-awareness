// Tier-2 shared multi-tenant vulnerable app: ONE hardened process, per-user data =
// DB rows in lab_sqli_accounts scoped by owner_id, with a reset route. The LOGIN
// query is DELIBERATELY injectable — that is the lab. Multi-tenancy is enforced by
// pinning owner_id to the session user, so one student's exploit only reaches their
// own seeded rows (the exploit is real; the blast radius is contained).
import { query, pool, labPool } from '../db.js';
import { emit } from '../telemetry/pipeline.js';

const DEFAULT_ACCOUNTS = [
  { username: 'admin', password: 'S3cr3t_Adm1n_pw', role: 'admin', secret_note: 'flag{sqli_union_exfil}' },
  { username: 'you', password: 'user123', role: 'user', secret_note: 'my bank otp is 4821' },
  { username: 'friend', password: 'friend@2024', role: 'user', secret_note: 'nothing here' },
];

// Re-seed this user's rows to a known state (the reset route restores the lab).
// Concurrency-safe: a per-user advisory lock serializes concurrent resets (e.g. the
// double lab-start React fires in dev), so DELETE+INSERT can't interleave into a
// duplicate-key. Runs in one transaction; the lock releases at COMMIT.
export async function resetSqli(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`sqli:${userId}`]);
    await client.query(`DELETE FROM lab_sqli_accounts WHERE owner_id = $1`, [userId]);
    for (const a of DEFAULT_ACCOUNTS) {
      await client.query(
        `INSERT INTO lab_sqli_accounts (owner_id, username, password, role, secret_note)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, a.username, a.password, a.role, a.secret_note],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export interface SqliResult {
  ok: boolean;
  rows: Array<{ username: string; role: string; secret_note: string | null }>;
  query: string;   // echoed back so the student SEES the injection they built
  error?: string;
  exploit?: 'auth-bypass' | 'union' | null;
}

// The vulnerable endpoint. The injectable query runs against a SESSION-LOCAL temp
// table `accounts` that holds ONLY this user's rows. This is the tenancy boundary:
// even `' OR '1'='1` or `UNION SELECT ... FROM accounts` only ever reaches the
// caller's own data (a tautology's OR would otherwise defeat a WHERE owner_id=$1
// prefix, since AND binds tighter than OR). The injection is fully real; the blast
// radius is contained to the tenant. It also makes the manifest's `FROM accounts`
// hint literally correct.
export async function sqliLogin(
  userId: string,
  username: string,
  password: string,
): Promise<SqliResult> {
  // ⚠️ INTENTIONALLY VULNERABLE: username/password concatenated unescaped into the
  // query against the per-user `accounts` temp table.
  const injected = `SELECT username, role, secret_note FROM accounts ` +
    `WHERE username = '${username}' AND password = '${password}'`;

  await emit({
    userId, labId: 'sqli', type: 'exploit_attempt',
    payload: { username, password }, outcome: 'neutral',
  });

  // Read THIS user's seeded rows on the PRIVILEGED pool — parameterised, safe.
  const seed = await query<{ username: string; password: string; role: string; secret_note: string | null }>(
    `SELECT username, password, role, secret_note FROM lab_sqli_accounts WHERE owner_id = $1`,
    [userId],
  );

  // Run the DELIBERATELY-INJECTABLE query on the LOCKED-DOWN `nielit_lab` role, which
  // has NO privileges on any application table. The auth-bypass tautology and
  // `UNION SELECT ... FROM accounts` still work against the temp table (the lesson),
  // but `UNION SELECT ... FROM users` / `quiz_keys` and any stacked write/DDL fail
  // with "permission denied" — the injection is real, but sealed to this session's
  // temp table. (Regression fix for the sandbox-escape found in the security review.)
  const client = await labPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `CREATE TEMP TABLE accounts (username text, password text, role text, secret_note text) ON COMMIT DROP`,
    );
    for (const a of seed.rows) {
      await client.query(
        `INSERT INTO accounts (username, password, role, secret_note) VALUES ($1, $2, $3, $4)`,
        [a.username, a.password, a.role, a.secret_note],
      );
    }
    const r = await client.query<{ username: string; role: string; secret_note: string | null }>(injected);
    await client.query('COMMIT');

    const rows = r.rows;
    // Classify the exploit for telemetry + client feedback.
    let exploit: SqliResult['exploit'] = null;
    const lc = `${username} ${password}`.toLowerCase();
    const legit = username === 'admin' && password === 'S3cr3t_Adm1n_pw';
    if (rows.length > 0 && !legit) {
      exploit = lc.includes('union') ? 'union' : 'auth-bypass';
      await emit({
        userId, labId: 'sqli', type: 'exploit_success',
        payload: { kind: exploit }, outcome: 'success',
      });
    }
    return { ok: rows.length > 0, rows, query: injected, exploit };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Error-based SQLi: leaking the DB error is part of the lesson.
    return { ok: false, rows: [], query: injected, error: (err as Error).message, exploit: null };
  } finally {
    client.release();
  }
}
