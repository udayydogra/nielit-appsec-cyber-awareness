// Redis client + the atomic global container cap (Lua) + container records.
// The 13th concurrent user is QUEUED, never OOMs the host (§3 guard 1).
import { Redis } from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.redisUrl, { lazyConnect: false, maxRetriesPerRequest: null });

const SLOT_SET = 'containers:active'; // set of active container ids
const SLOT_KEY = (id: string) => `container:${id}`;

// Atomic slot claim: only succeeds if active count < cap. Returns 1 on claim, 0 if full.
const CLAIM_LUA = `
local setKey = KEYS[1]
local recKey = KEYS[2]
local cap    = tonumber(ARGV[1])
local id     = ARGV[2]
local ttl    = tonumber(ARGV[3])
local now    = ARGV[4]
if redis.call('SISMEMBER', setKey, id) == 1 then
  redis.call('EXPIRE', recKey, ttl)
  return 1
end
if redis.call('SCARD', setKey) >= cap then
  return 0
end
redis.call('SADD', setKey, id)
redis.call('HSET', recKey, 'startedAt', now, 'lastSeen', now)
redis.call('EXPIRE', recKey, ttl)
return 1
`;

export async function claimSlot(id: string): Promise<boolean> {
  const res = (await redis.eval(
    CLAIM_LUA,
    2,
    SLOT_SET,
    SLOT_KEY(id),
    String(config.containers.maxConcurrent),
    id,
    String(config.containers.idleTimeoutSec),
    String(Date.now()),
  )) as number;
  return res === 1;
}

export async function releaseSlot(id: string): Promise<void> {
  await redis.srem(SLOT_SET, id);
  await redis.del(SLOT_KEY(id));
}

export async function heartbeatSlot(id: string): Promise<void> {
  await redis.hset(SLOT_KEY(id), 'lastSeen', String(Date.now()));
  await redis.expire(SLOT_KEY(id), config.containers.idleTimeoutSec);
}

export async function activeSlotCount(): Promise<number> {
  return redis.scard(SLOT_SET);
}

export async function listActiveSlots(): Promise<string[]> {
  return redis.smembers(SLOT_SET);
}

export async function getSlotRecord(id: string): Promise<Record<string, string>> {
  return redis.hgetall(SLOT_KEY(id));
}
