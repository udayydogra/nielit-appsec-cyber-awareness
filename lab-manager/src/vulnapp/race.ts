// Tier-2 Race-Condition target. A wallet withdrawal does check-then-act NON-
// atomically: it reads the balance, checks it, waits (a widened TOCTOU window),
// then decrements. Fire N concurrent withdrawals and they all pass the check
// against the same stale balance → double-spend → negative balance. Tenancy is
// contained by owner_id.
import { query, pool } from '../db.js';
import { emit } from '../telemetry/pipeline.js';

const START_BALANCE = 100;
export const WITHDRAW_AMOUNT = 100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function resetRace(userId: string): Promise<void> {
  await query(
    `INSERT INTO lab_race_wallet (owner_id, balance) VALUES ($1, $2)
     ON CONFLICT (owner_id) DO UPDATE SET balance = EXCLUDED.balance`,
    [userId, START_BALANCE],
  );
}

export async function getBalance(userId: string): Promise<number> {
  const r = await query<{ balance: number }>(`SELECT balance FROM lab_race_wallet WHERE owner_id = $1`, [userId]);
  return r.rows[0]?.balance ?? START_BALANCE;
}

export interface WithdrawResult { success: boolean; balance: number; }

// ⚠️ VULNERABLE: read → check → (window) → write, not atomic. Concurrent calls
// interleave inside the window and all decrement from the same stale read.
export async function withdraw(userId: string, amount = WITHDRAW_AMOUNT): Promise<WithdrawResult> {
  await emit({ userId, labId: 'race-condition', type: 'exploit_attempt', payload: { amount }, outcome: 'neutral' });
  const cur = await getBalance(userId);
  if (cur < amount) return { success: false, balance: cur };

  await sleep(60); // TOCTOU window — real code's "gap" between check and act
  const r = await query<{ balance: number }>(
    `UPDATE lab_race_wallet SET balance = balance - $2 WHERE owner_id = $1 RETURNING balance`,
    [userId, amount],
  );
  const balance = r.rows[0]?.balance ?? cur - amount;
  if (balance < 0) {
    await emit({ userId, labId: 'race-condition', type: 'exploit_success', payload: { balance }, outcome: 'success' });
  }
  return { success: true, balance };
}
