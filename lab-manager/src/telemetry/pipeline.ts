// The telemetry spine. ONE envelope for both modules. CRITICAL: events are
// SERVER-EMITTED from verified actions — the client never POSTs an event, or it
// mints its own lab_completed → free cert. Client sends actions; server decides.
import { query } from '../db.js';
import type { EventType } from '../types.js';

export interface EventInput {
  userId: string;
  labId: string;
  type: EventType;
  nodeId?: string;
  outcome?: string;
  payload?: Record<string, unknown>;
}

export async function emit(ev: EventInput): Promise<void> {
  await query(
    `INSERT INTO events (user_id, lab_id, event_type, node_id, outcome, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ev.userId, ev.labId, ev.type, ev.nodeId ?? null, ev.outcome ?? null, JSON.stringify(ev.payload ?? {})],
  );
}

// The mentor reads the SAME envelope: current node + last action + outcome.
export async function lastActionContext(
  userId: string,
  labId: string,
): Promise<{ type: string; nodeId: string | null; outcome: string | null } | null> {
  const r = await query<{ event_type: string; node_id: string | null; outcome: string | null }>(
    `SELECT event_type, node_id, outcome FROM events
      WHERE user_id = $1 AND lab_id = $2
      ORDER BY id DESC LIMIT 1`,
    [userId, labId],
  );
  const row = r.rows[0];
  return row ? { type: row.event_type, nodeId: row.node_id, outcome: row.outcome } : null;
}
