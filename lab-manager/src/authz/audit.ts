// Audit-log every privileged write and cross-user read (§10).
import { query } from '../db.js';

export async function audit(
  actorId: string | null,
  action: string,
  target: string | null = null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (actor_id, action, target, detail) VALUES ($1, $2, $3, $4)`,
      [actorId, action, target, JSON.stringify(detail)],
    );
  } catch (err) {
    // never let audit failure break the request path, but make it loud
    console.error('[audit] failed to write', action, err);
  }
}
