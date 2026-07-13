// Tier-2 shared multi-tenant IDOR target. The student is logged in as persona
// SESSION_PERSONA and owns invoice 1001. The vulnerable endpoint fetches ANY
// invoice by id and never checks that it belongs to the caller's persona — that
// missing object-level authorization IS the vuln (this is exactly the bug the
// platform's own authz forbids). owner_id pins the tenant so the exploit only ever
// reaches the caller's own seeded personas, never another real student's rows.
import { query, pool } from '../db.js';
import { emit } from '../telemetry/pipeline.js';

// The persona the student is "logged in as" for this lab.
export const SESSION_PERSONA = 'you';

const DEFAULT_INVOICES = [
  { invoice_id: 1001, belongs_to: 'you',   amount: 1200, secret: 'your own invoice — nothing to see' },
  { invoice_id: 1002, belongs_to: 'priya', amount: 4999, secret: "Priya's card ending 4417" },
  { invoice_id: 1003, belongs_to: 'admin', amount: 90000, secret: 'flag{idor_broken_object_level_authz}' },
];

// Re-seed this user's sandbox to a known state. Concurrency-safe (advisory lock)
// so the double lab-start React fires in dev can't collide on the primary key.
export async function resetIdor(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`idor:${userId}`]);
    await client.query(`DELETE FROM lab_idor_invoices WHERE owner_id = $1`, [userId]);
    for (const inv of DEFAULT_INVOICES) {
      await client.query(
        `INSERT INTO lab_idor_invoices (owner_id, invoice_id, belongs_to, amount, secret)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, inv.invoice_id, inv.belongs_to, inv.amount, inv.secret],
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

export interface IdorResult {
  found: boolean;
  invoice?: { invoiceId: number; belongsTo: string; amount: number; secret: string | null };
  idor: boolean; // true when the returned invoice belongs to a DIFFERENT persona
}

// ⚠️ INTENTIONALLY VULNERABLE: no ownership check. The query IS parameterized (the
// platform never concatenates), and owner_id contains the blast radius — but the
// missing `AND belongs_to = SESSION_PERSONA` is the whole lesson.
export async function fetchInvoice(userId: string, invoiceId: number): Promise<IdorResult> {
  await emit({
    userId, labId: 'idor', type: 'exploit_attempt',
    payload: { invoiceId }, outcome: 'neutral',
  });

  const row = await query<{ invoice_id: number; belongs_to: string; amount: number; secret: string | null }>(
    `SELECT invoice_id, belongs_to, amount, secret
       FROM lab_idor_invoices WHERE owner_id = $1 AND invoice_id = $2`,
    [userId, invoiceId],
  );
  const inv = row.rows[0];
  if (!inv) return { found: false, idor: false };

  const idor = inv.belongs_to !== SESSION_PERSONA;
  if (idor) {
    await emit({
      userId, labId: 'idor', type: 'exploit_success',
      payload: { invoiceId, belongsTo: inv.belongs_to }, outcome: 'success',
    });
  }
  return {
    found: true,
    invoice: { invoiceId: inv.invoice_id, belongsTo: inv.belongs_to, amount: inv.amount, secret: inv.secret },
    idor,
  };
}
