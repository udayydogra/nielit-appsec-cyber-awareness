// Spawn / reuse / reap Tier-3 per-user containers. Lazy spawn (on lab ENTER, not
// login); atomic global cap via Redis (queue overflow, never OOM); 128MB-capped,
// read-only, CapDrop ALL, optional gVisor (runsc). Concurrency drives RAM, not
// signups. NOTE: spawning shells out to `docker`; when Docker is unavailable the
// manager reports "unavailable" instead of throwing — the rest of the platform
// (Tier 0-2) runs regardless.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { claimSlot, releaseSlot, heartbeatSlot, getSlotRecord, redis } from '../redis.js';

const exec = promisify(execFile);

export type StartResult =
  | { status: 'started' | 'reused'; containerId: string; slot: string }
  | { status: 'queued' };

// slot id is deterministic per (user, lab) so re-entry reuses the same container.
function slotId(userId: string, labId: string): string {
  return `${labId}:${userId}`;
}
function ownerKey(slot: string): string { return `container:owner:${slot}`; }

async function dockerAvailable(): Promise<boolean> {
  try { await exec('docker', ['version', '--format', '{{.Server.Version}}']); return true; }
  catch { return false; }
}

export async function startContainer(
  userId: string,
  labId: string,
  image: string,
): Promise<StartResult> {
  const slot = slotId(userId, labId);

  // Atomic cap: the (maxConcurrent+1)-th user is QUEUED, never OOMs the host.
  const claimed = await claimSlot(slot);
  if (!claimed) return { status: 'queued' };

  await redis.set(ownerKey(slot), userId, 'EX', config.containers.maxLifetimeSec);

  // If a container for this slot already runs, reuse it (idempotent re-entry).
  const existing = await getSlotRecord(slot);
  if (existing.containerId) {
    await heartbeatSlot(slot);
    return { status: 'reused', containerId: existing.containerId, slot };
  }

  if (!(await dockerAvailable())) {
    // Keep the slot record so the reaper can clean it; report gracefully.
    await redis.hset(`container:${slot}`, 'containerId', 'unavailable');
    return { status: 'started', containerId: 'unavailable', slot };
  }

  const args = [
    'run', '-d', '--rm',
    `--memory=${config.containers.memoryMb}m`,
    `--memory-swap=${config.containers.memoryMb}m`,
    `--cpus=${config.containers.cpus}`,
    '--read-only',
    '--cap-drop=ALL',
    '--pids-limit=64',
    '--tmpfs', '/tmp:rw,size=16m,noexec',
    '--network', 'none',                         // egress locked down by default
    `--runtime=${config.containers.runtime}`,    // runsc (gVisor) for escape labs
    '--label', `nielit.slot=${slot}`,
    '--label', `nielit.owner=${userId}`,
    image,
  ];

  const { stdout } = await exec('docker', args);
  const containerId = stdout.trim().slice(0, 12);
  await redis.hset(`container:${slot}`, 'containerId', containerId);
  await heartbeatSlot(slot);
  return { status: 'started', containerId, slot };
}

export async function heartbeat(userId: string, labId: string): Promise<void> {
  await heartbeatSlot(slotId(userId, labId));
}

// Ownership-scoped stop: the caller must own the slot (containerOwnerScope).
export async function stopContainer(slot: string): Promise<void> {
  const rec = await getSlotRecord(slot);
  if (rec.containerId && rec.containerId !== 'unavailable') {
    try { await exec('docker', ['kill', rec.containerId]); } catch { /* already gone */ }
  }
  await releaseSlot(slot);
  await redis.del(ownerKey(slot));
}

export async function slotOwner(slot: string): Promise<string | undefined> {
  return (await redis.get(ownerKey(slot))) ?? undefined;
}

export { slotId };
