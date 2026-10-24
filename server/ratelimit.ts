/**
 * Tiny in-memory sliding-window rate limiter (per client IP).
 * Enough for a single Render/Node instance; swap for Redis when scaling out.
 */
import type { Request, Response, NextFunction } from 'express';

interface Bucket { hits: number[] }

export function rateLimit(opts: { windowMs: number; max: number; name: string }) {
  const buckets = new Map<string, Bucket>();
  let lastSweep = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now - lastSweep > opts.windowMs) {
      for (const [k, b] of buckets) {
        b.hits = b.hits.filter((t) => now - t < opts.windowMs);
        if (!b.hits.length) buckets.delete(k);
      }
      lastSweep = now;
    }
    const key = `${opts.name}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const bucket = buckets.get(key) || { hits: [] };
    bucket.hits = bucket.hits.filter((t) => now - t < opts.windowMs);
    if (bucket.hits.length >= opts.max) {
      const retryAfter = Math.ceil((opts.windowMs - (now - bucket.hits[0])) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.', retryAfterSeconds: retryAfter });
    }
    bucket.hits.push(now);
    buckets.set(key, bucket);
    next();
  };
}
