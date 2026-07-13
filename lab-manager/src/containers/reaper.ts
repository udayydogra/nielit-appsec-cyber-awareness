// Aggressive reaper — idle > idleTimeout OR alive > maxLifetime → killed, slot
// freed (§3 guard 2). Container = a Redis key with a TTL; when the TTL lapses the
// slot record vanishes and we kill any orphaned docker container by label. Re-spawn
// on return is ~2s (acceptable trade). Runs on an interval from index.ts.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { listActiveSlots, getSlotRecord, releaseSlot } from '../redis.js';

const exec = promisify(execFile);

export async function reapOnce(): Promise<number> {
  const now = Date.now();
  let reaped = 0;
  const slots = await listActiveSlots();
  for (const slot of slots) {
    const rec = await getSlotRecord(slot);
    // If the TTL already expired the hash is empty → free the set entry.
    if (!rec.startedAt) {
      await releaseSlot(slot);
      reaped++;
      continue;
    }
    const started = Number(rec.startedAt);
    const lastSeen = Number(rec.lastSeen ?? rec.startedAt);
    const idle = (now - lastSeen) / 1000;
    const alive = (now - started) / 1000;
    if (idle > config.containers.idleTimeoutSec || alive > config.containers.maxLifetimeSec) {
      if (rec.containerId && rec.containerId !== 'unavailable') {
        try { await exec('docker', ['kill', rec.containerId]); } catch { /* already gone */ }
      }
      await releaseSlot(slot);
      reaped++;
    }
  }
  return reaped;
}

export function startReaper(intervalMs = 30_000): NodeJS.Timeout {
  return setInterval(() => {
    reapOnce().catch((err) => console.error('[reaper] error', err));
  }, intervalMs);
}
