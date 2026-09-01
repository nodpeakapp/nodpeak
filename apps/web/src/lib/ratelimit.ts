/**
 * Fixed-window limiter held in process memory.
 *
 * Correct for the single-container deployment this repo ships. If you scale
 * to more than one app replica, each replica keeps its own counters and the
 * effective limit multiplies by the replica count — swap this for Redis at
 * that point. Called out rather than hidden, because a limiter that silently
 * stops limiting is worse than no limiter.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Bound the map so a flood of unique keys cannot grow it without limit.
const MAX_KEYS = 50_000;

export type RateResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs = 60 * 60 * 1000): RateResult {
  const now = Date.now();

  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    if (buckets.size > MAX_KEYS) buckets.clear();
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

export const LIMITS = {
  feedback: Number(process.env.FEEDBACK_RATE_LIMIT_PER_HOUR ?? 20),
  audit: Number(process.env.AUDIT_RATE_LIMIT_PER_HOUR ?? 10),
  auth: 10,
  lead: Number(process.env.LEAD_RATE_LIMIT_PER_HOUR ?? 20),
  subscribe: Number(process.env.SUBSCRIBE_RATE_LIMIT_PER_HOUR ?? 20),
  linkCheck: 6,
  graderLead: Number(process.env.GRADER_LEAD_RATE_LIMIT_PER_HOUR ?? 10),
};
