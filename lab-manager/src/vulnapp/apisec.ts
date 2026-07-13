// Tier-2 API-Security target. Two OWASP API risks in one profile endpoint:
//   • Excessive Data Exposure (API3) — GET returns internal fields (password hash,
//     internal note, role flags) the client should never see.
//   • Mass Assignment (API6/API3) — PATCH blindly assigns whatever fields the
//     client sends, including role/is_admin, so you can escalate yourself to admin.
// Tenancy is contained by owner_id.
import { query } from '../db.js';
import { emit } from '../telemetry/pipeline.js';

export interface ApiProfile {
  display_name: string; role: string; is_admin: boolean;
  password_hash: string; internal_note: string;
}

export async function resetApi(userId: string): Promise<void> {
  await query(
    `INSERT INTO lab_api_profile (owner_id, display_name, role, is_admin, password_hash, internal_note)
     VALUES ($1, 'You', 'user', false, '$2b$10$k9…REDACTED…hash', 'internal: standard tier-2 account')
     ON CONFLICT (owner_id) DO UPDATE
       SET display_name = 'You', role = 'user', is_admin = false,
           password_hash = '$2b$10$k9…REDACTED…hash', internal_note = 'internal: standard tier-2 account'`,
    [userId],
  );
}

// ⚠️ Excessive Data Exposure: returns the whole row, internal fields included.
export async function getProfile(userId: string): Promise<ApiProfile> {
  const r = await query<ApiProfile>(
    `SELECT display_name, role, is_admin, password_hash, internal_note FROM lab_api_profile WHERE owner_id = $1`,
    [userId],
  );
  return r.rows[0];
}

// Columns the client is allowed to REACH via PATCH. role/is_admin should be
// server-controlled — including them here is the mass-assignment vuln.
const SETTABLE: Record<string, string> = {
  display_name: 'display_name', role: 'role', is_admin: 'is_admin', internal_note: 'internal_note',
};

export interface PatchResult { profile: ApiProfile; escalated: boolean; changed: string[]; }

// ⚠️ Mass Assignment: assigns any provided known key, no allow-list of *safe* keys.
export async function patchProfile(userId: string, patch: Record<string, unknown>): Promise<PatchResult> {
  await emit({ userId, labId: 'api-security', type: 'exploit_attempt', payload: { keys: Object.keys(patch) }, outcome: 'neutral' });
  const sets: string[] = [];
  const vals: unknown[] = [userId];
  const changed: string[] = [];
  for (const [key, col] of Object.entries(SETTABLE)) {
    if (key in patch) { sets.push(`${col} = $${vals.length + 1}`); vals.push(patch[key]); changed.push(key); }
  }
  if (sets.length) {
    await query(`UPDATE lab_api_profile SET ${sets.join(', ')} WHERE owner_id = $1`, vals);
  }
  const profile = await getProfile(userId);
  const escalated = profile.is_admin === true || profile.role === 'admin';
  if (escalated) {
    await emit({ userId, labId: 'api-security', type: 'exploit_success', payload: { role: profile.role, is_admin: profile.is_admin }, outcome: 'success' });
  }
  return { profile, escalated, changed };
}
