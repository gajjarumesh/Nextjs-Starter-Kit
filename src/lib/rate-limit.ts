import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, features } from "@/lib/env";
import { AppError } from "@/lib/errors";

export type RateLimitResult = { success: boolean; limit: number; remaining: number; reset: number };
type Options = { limit: number; windowSec: number };

// In-memory fixed window: fine for development and single-container deployments.
const memory = new Map<string, { count: number; reset: number }>();

export function memoryLimit(
  key: string,
  { limit, windowSec }: Options,
  now = Date.now(),
): RateLimitResult {
  const entry = memory.get(key);
  if (!entry || entry.reset <= now) {
    const reset = now + windowSec * 1000;
    memory.set(key, { count: 1, reset });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.reset <= now) memory.delete(k);
    }
    return { success: true, limit, remaining: limit - 1, reset };
  }
  entry.count += 1;
  return {
    success: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    reset: entry.reset,
  };
}

const upstash = new Map<string, Ratelimit>();
function upstashLimiter({ limit, windowSec }: Options) {
  const id = `${limit}:${windowSec}`;
  let rl = upstash.get(id);
  if (!rl) {
    rl = new Ratelimit({
      redis: new Redis({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN! }),
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      prefix: "launchkit",
    });
    upstash.set(id, rl);
  }
  return rl;
}

export async function checkRateLimit(key: string, opts: Options): Promise<RateLimitResult> {
  if (features.upstash) {
    const r = await upstashLimiter(opts).limit(key);
    return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
  }
  return memoryLimit(key, opts);
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.reset / 1000)),
  };
}

/** Throws RATE_LIMITED (429) with Retry-After when the window is exhausted. */
export async function rateLimit(key: string, opts: Options): Promise<RateLimitResult> {
  const r = await checkRateLimit(key, opts);
  if (!r.success) {
    const retryAfter = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
    throw new AppError("RATE_LIMITED", 429, undefined, {
      headers: { ...rateLimitHeaders(r), "Retry-After": String(retryAfter) },
    });
  }
  return r;
}
