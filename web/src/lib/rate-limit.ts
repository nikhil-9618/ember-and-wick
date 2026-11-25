import type { Store } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiting backed by MongoDB. A single pipeline update
 * increments the counter when the window matches and resets it otherwise, so
 * the upsert stays atomic with respect to concurrent requests.
 */
export async function checkRateLimit(
  db: Store,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const resetAt = windowStart + windowSeconds;

  const row = (await db.rate_limits.findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          window_start: windowStart,
          count: {
            $cond: [
              { $eq: ["$window_start", windowStart] },
              { $add: ["$count", 1] },
              1,
            ],
          },
        },
      },
    ] as any,
    { upsert: true },
  )) as unknown as { count: number; window_start: number } | null;

  const count = row?.count ?? 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, resetAt - now),
  };
}

export async function pruneRateLimits(db: Store): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  await db.rate_limits.deleteMany({ window_start: { $lt: cutoff } } as any);
}
