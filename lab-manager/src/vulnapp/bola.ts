// Tier-2 BOLA target (OWASP API1:2023 — Broken Object Level Authorization). A JSON
// API exposes orders by id and neither the read (GET) nor the write (cancel) checks
// that the order belongs to the caller's persona. Demonstrates BOLA on both read
// AND write. Tenancy contained by owner_id.
import { query, pool } from '../db.js';
import { emit } from '../telemetry/pipeline.js';

const SESSION_PERSONA = 'you';

const DEFAULT_ORDERS = [
  { order_id: 5001, belongs_to: 'you', item: 'USB-C cable', status: 'shipped', secret: 'your own order' },
  { order_id: 5002, belongs_to: 'priya', item: 'Gold ring', status: 'shipped', secret: "Priya's address: 12 MG Road, Pune" },
  { order_id: 5003, belongs_to: 'admin', item: 'Rack server', status: 'processing', secret: 'flag{bola_broken_object_level_authz}' },
];

export async function resetBola(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bola:${userId}`]);
    await client.query(`DELETE FROM lab_bola_orders WHERE owner_id = $1`, [userId]);
    for (const o of DEFAULT_ORDERS) {
      await client.query(
        `INSERT INTO lab_bola_orders (owner_id, order_id, belongs_to, item, status, secret)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, o.order_id, o.belongs_to, o.item, o.status, o.secret],
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

export interface Order { orderId: number; belongsTo: string; item: string; status: string; secret: string | null; }
export interface BolaResult { found: boolean; order?: Order; bola: boolean; }

async function fetchRow(userId: string, id: number) {
  const r = await query<{ order_id: number; belongs_to: string; item: string; status: string; secret: string | null }>(
    `SELECT order_id, belongs_to, item, status, secret FROM lab_bola_orders WHERE owner_id = $1 AND order_id = $2`,
    [userId, id],
  );
  return r.rows[0];
}

// ⚠️ VULNERABLE (read): no check that the order belongs to the caller.
export async function getOrder(userId: string, id: number): Promise<BolaResult> {
  await emit({ userId, labId: 'bola', type: 'exploit_attempt', payload: { id, op: 'read' }, outcome: 'neutral' });
  const row = await fetchRow(userId, id);
  if (!row) return { found: false, bola: false };
  const bola = row.belongs_to !== SESSION_PERSONA;
  if (bola) await emit({ userId, labId: 'bola', type: 'exploit_success', payload: { id, op: 'read', belongsTo: row.belongs_to }, outcome: 'success' });
  return { found: true, bola, order: { orderId: row.order_id, belongsTo: row.belongs_to, item: row.item, status: row.status, secret: row.secret } };
}

// ⚠️ VULNERABLE (write): cancel ANY order id, no ownership check.
export async function cancelOrder(userId: string, id: number): Promise<BolaResult> {
  await emit({ userId, labId: 'bola', type: 'exploit_attempt', payload: { id, op: 'cancel' }, outcome: 'neutral' });
  const row = await fetchRow(userId, id);
  if (!row) return { found: false, bola: false };
  await query(`UPDATE lab_bola_orders SET status = 'cancelled' WHERE owner_id = $1 AND order_id = $2`, [userId, id]);
  const bola = row.belongs_to !== SESSION_PERSONA;
  if (bola) await emit({ userId, labId: 'bola', type: 'exploit_success', payload: { id, op: 'cancel', belongsTo: row.belongs_to }, outcome: 'success' });
  return { found: true, bola, order: { orderId: row.order_id, belongsTo: row.belongs_to, item: row.item, status: 'cancelled', secret: row.secret } };
}
