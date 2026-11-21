import type { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };

/**
 * Best-effort fixed-window limiter. State lives in the serverless instance's
 * memory, so it resets on cold starts and is not shared between instances.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  function live(key: string, now: number): Bucket | undefined {
    const bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= now) {
      buckets.delete(key);
      return undefined;
    }
    return bucket;
  }

  return {
    /** Seconds until the key may try again, or 0 when not blocked. */
    retryAfter(key: string, now = Date.now()): number {
      const bucket = live(key, now);
      return bucket && bucket.count >= limit ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
    },
    hit(key: string, now = Date.now()): void {
      const bucket = live(key, now);
      if (bucket) bucket.count += 1;
      else buckets.set(key, { count: 1, resetAt: now + windowMs });
    },
    reset(key: string): void {
      buckets.delete(key);
    },
  };
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
