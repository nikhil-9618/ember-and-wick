import type { D1Database } from "./types-d1";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiting backed by D1, so it works identically on Workers
 * and local dev without an extra service. A single atomic upsert does the work.
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const resetAt = windowStart + windowSeconds;

  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = excluded.window_start
                      THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count, window_start`,
    )
    .bind(key, windowStart)
    .first<{ count: number; window_start: number }>();

  const count = row?.count ?? 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, resetAt - now),
  };
}

/** Removes expired counters; called opportunistically, never on a hot path. */
export async function pruneRateLimits(db: D1Database): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  await db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(cutoff).run();
}
