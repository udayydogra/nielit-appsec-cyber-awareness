// Tier-2 Stored-XSS target. A per-user guestbook stores comment bodies RAW; the
// client renders them without escaping (the vuln). Tenancy is contained by owner_id.
// The frontend renders each comment inside a sandboxed <iframe srcdoc> so a payload
// executes ONLY inside that sandbox, never against the real SPA (the platform must
// not commit the bug it teaches — see spec §13 "sanitize on write, fence on render").
import { query, pool } from '../db.js';
import { emit } from '../telemetry/pipeline.js';

// Heuristic to classify a body as an XSS attempt (for telemetry + feedback only).
const XSS_RE = /<script|on\w+\s*=|<svg|<img|<iframe|javascript:/i;

export async function resetXss(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`xss:${userId}`]);
    await client.query(`DELETE FROM lab_xss_comments WHERE owner_id = $1`, [userId]);
    await client.query(
      `INSERT INTO lab_xss_comments (owner_id, author, body) VALUES ($1, $2, $3)`,
      [userId, 'priya', 'Nice product, fast delivery! 👍'],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export interface XssComment { id: number; author: string; body: string; }

export async function addComment(userId: string, author: string, body: string): Promise<{ xss: boolean }> {
  await emit({ userId, labId: 'xss', type: 'exploit_attempt', payload: { author }, outcome: 'neutral' });
  // ⚠️ Stored RAW and unescaped. Length-capped only to keep the row sane.
  await query(
    `INSERT INTO lab_xss_comments (owner_id, author, body) VALUES ($1, $2, $3)`,
    [userId, author.slice(0, 60) || 'anon', body.slice(0, 2000)],
  );
  const xss = XSS_RE.test(body);
  if (xss) {
    await emit({ userId, labId: 'xss', type: 'exploit_success', payload: { kind: 'stored-xss' }, outcome: 'success' });
  }
  return { xss };
}

export async function listComments(userId: string): Promise<XssComment[]> {
  const r = await query<{ id: number; author: string; body: string }>(
    `SELECT id, author, body FROM lab_xss_comments WHERE owner_id = $1 ORDER BY id`,
    [userId],
  );
  return r.rows;
}
