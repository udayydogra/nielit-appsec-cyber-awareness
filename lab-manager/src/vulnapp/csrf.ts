// Tier-2 CSRF target. The vulnerable endpoint changes a per-user profile email
// authorised ONLY by the session (no anti-CSRF token, no custom-header check) — so
// a forged cross-site request would succeed. The secure endpoint requires a token
// issued by /csrf/token. The widget simulates the forged request to demonstrate the
// difference. Tenancy is contained by owner_id.
import { query } from '../db.js';
import { redis } from '../redis.js';
import { emit } from '../telemetry/pipeline.js';

const DEFAULT_EMAIL = 'you@nielit.test';
const tokenKey = (userId: string) => `lab:csrf:token:${userId}`;

export async function resetCsrf(userId: string): Promise<void> {
  await query(
    `INSERT INTO lab_csrf_profile (owner_id, email) VALUES ($1, $2)
     ON CONFLICT (owner_id) DO UPDATE SET email = EXCLUDED.email`,
    [userId, DEFAULT_EMAIL],
  );
}

export async function getProfile(userId: string): Promise<{ email: string }> {
  const r = await query<{ email: string }>(`SELECT email FROM lab_csrf_profile WHERE owner_id = $1`, [userId]);
  return { email: r.rows[0]?.email ?? DEFAULT_EMAIL };
}

// ⚠️ VULNERABLE: no token required. `forged` marks a request the widget sent as if
// from an attacker page — it succeeds all the same, which IS the lesson.
export async function changeEmail(userId: string, email: string, forged: boolean): Promise<{ email: string }> {
  await query(
    `INSERT INTO lab_csrf_profile (owner_id, email) VALUES ($1, $2)
     ON CONFLICT (owner_id) DO UPDATE SET email = EXCLUDED.email`,
    [userId, email.slice(0, 120)],
  );
  await emit({
    userId, labId: 'csrf', type: forged ? 'exploit_success' : 'exploit_attempt',
    payload: { email, forged }, outcome: forged ? 'success' : 'neutral',
  });
  return { email };
}

export async function issueCsrfToken(userId: string): Promise<string> {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await redis.set(tokenKey(userId), token, 'EX', 600);
  return token;
}

// Secure variant: rejects when the token is missing or wrong (a forged cross-site
// request cannot read/replay it). Returns true when accepted.
export async function changeEmailSecure(userId: string, email: string, token: string | undefined): Promise<boolean> {
  const expected = await redis.get(tokenKey(userId));
  if (!token || !expected || token !== expected) return false;
  await query(`UPDATE lab_csrf_profile SET email = $2 WHERE owner_id = $1`, [userId, email.slice(0, 120)]);
  return true;
}
