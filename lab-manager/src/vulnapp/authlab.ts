// Tier-2 Broken-Authentication target. Two deliberate defects: (1) the login leaks
// which usernames exist via distinct responses (user enumeration), and (2) there is
// no lockout / rate limit on THIS lab endpoint and the victim PIN is weak, so a
// small dictionary cracks it (broken auth). Tenancy is contained by owner_id.
import { query, pool } from '../db.js';
import { emit } from '../telemetry/pipeline.js';

const DEFAULT_ACCOUNTS = [
  { username: 'admin', pin: '2468', secret: 'flag{broken_auth_weak_pin_no_lockout}' },
  { username: 'you', pin: '1379', secret: 'your own account' },
];

export async function resetAuth(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`authlab:${userId}`]);
    await client.query(`DELETE FROM lab_auth_accounts WHERE owner_id = $1`, [userId]);
    for (const a of DEFAULT_ACCOUNTS) {
      await client.query(
        `INSERT INTO lab_auth_accounts (owner_id, username, pin, secret) VALUES ($1, $2, $3, $4)`,
        [userId, a.username, a.pin, a.secret],
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

export type AuthStatus = 'ok' | 'wrong_pin' | 'no_user';
export interface AuthResult { status: AuthStatus; secret?: string; }

// ⚠️ VULNERABLE: distinct results for "no such user" vs "wrong pin" (enumeration),
// and no lockout (brute force). A hardened login would return one constant error
// and rate-limit/lock the account.
export async function labLogin(userId: string, username: string, pin: string): Promise<AuthResult> {
  const r = await query<{ pin: string; secret: string | null }>(
    `SELECT pin, secret FROM lab_auth_accounts WHERE owner_id = $1 AND username = $2`,
    [userId, username],
  );
  const row = r.rows[0];
  if (!row) {
    await emit({ userId, labId: 'auth', type: 'exploit_attempt', payload: { username, result: 'no_user' }, outcome: 'neutral' });
    return { status: 'no_user' };
  }
  if (row.pin !== pin) {
    await emit({ userId, labId: 'auth', type: 'exploit_attempt', payload: { username, result: 'wrong_pin' }, outcome: 'neutral' });
    return { status: 'wrong_pin' };
  }
  // A cracked victim account = success (unless it's the student's own 'you').
  if (username !== 'you') {
    await emit({ userId, labId: 'auth', type: 'exploit_success', payload: { username, kind: 'weak-pin' }, outcome: 'success' });
  }
  return { status: 'ok', secret: row.secret ?? undefined };
}
