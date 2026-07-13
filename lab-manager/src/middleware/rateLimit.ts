// Per-user fixed-window rate limiting (DoS guards): lab-start (slot-pool DoS) and
// mentor (budget/RAM burn). Backed by Redis so it holds across process restarts.
import type { Request, Response, NextFunction } from 'express';
import { redis } from '../redis.js';

export function rateLimit(bucket: string, maxPerMin: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const id = req.user?.id ?? req.ip ?? 'anon';
    const windowKey = `rl:${bucket}:${id}:${Math.floor(Date.now() / 60000)}`;
    const count = await redis.incr(windowKey);
    if (count === 1) await redis.expire(windowKey, 60);
    if (count > maxPerMin) {
      return res.status(429).json({ error: 'rate_limited', bucket, retryAfterSec: 60 });
    }
    next();
  };
}
