// Tier-2 Session-Management target. The lab "session token" is just base64 of
// `u:<persona>` — it carries identity with NO signature the server verifies, so a
// client can decode it, swap the persona, re-encode, and hijack another session.
// The data is static synthetic (identical for all users), so no per-user table.
import { emit } from '../telemetry/pipeline.js';

const PERSONAS: Record<string, { secret: string }> = {
  you: { secret: 'your own session — nothing secret here' },
  admin: { secret: 'flag{session_forgeable_token_no_signature}' },
};

// The token the app "issued" to the logged-in student.
export function issuedToken(): string {
  return Buffer.from('u:you').toString('base64');
}
export function decodeToken(token: string): string {
  try { return Buffer.from(token, 'base64').toString('utf8'); } catch { return ''; }
}

export interface SessionResult { valid: boolean; persona?: string; secret?: string; hijack: boolean; }

// ⚠️ VULNERABLE: trusts whatever identity the (unsigned) token claims.
export async function whoami(userId: string, token: string): Promise<SessionResult> {
  const decoded = decodeToken(token);
  const persona = /^u:(.+)$/.exec(decoded)?.[1];
  await emit({ userId, labId: 'session', type: 'exploit_attempt', payload: { token, decoded }, outcome: 'neutral' });
  if (!persona || !(persona in PERSONAS)) return { valid: false, hijack: false };
  const hijack = persona !== 'you';
  if (hijack) {
    await emit({ userId, labId: 'session', type: 'exploit_success', payload: { persona }, outcome: 'success' });
  }
  return { valid: true, persona, secret: PERSONAS[persona].secret, hijack };
}
