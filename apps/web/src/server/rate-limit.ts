import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/env";
import { ApiError } from "./http";

// Protects the OpenRouteService quota (docs/PLAN.md: 30 routes/min, 300/day per user).
// Upstash when configured, so limits hold across server instances; in memory otherwise.

export interface Limit {
  name: string;
  max: number;
  windowSec: number;
}

export const ROUTING_LIMITS: Limit[] = [
  { name: "routing-minute", max: 30, windowSec: 60 },
  { name: "routing-day", max: 300, windowSec: 86_400 },
];

interface Limiter {
  check(limit: Limit, key: string): Promise<{ ok: boolean; resetMs: number }>;
}

/** Sliding log per key; fine for one instance and for tests. */
export class MemoryLimiter implements Limiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  async check(limit: Limit, key: string) {
    const id = `${limit.name}:${key}`;
    const now = this.now();
    const since = now - limit.windowSec * 1000;
    const recent = (this.hits.get(id) ?? []).filter((t) => t > since);
    if (recent.length >= limit.max) {
      this.hits.set(id, recent);
      return { ok: false, resetMs: (recent[0] ?? now) + limit.windowSec * 1000 - now };
    }
    recent.push(now);
    this.hits.set(id, recent);
    return { ok: true, resetMs: 0 };
  }
}

class UpstashLimiter implements Limiter {
  private readonly limiters = new Map<string, Ratelimit>();

  constructor(private readonly redis: Redis) {}

  async check(limit: Limit, key: string) {
    let limiter = this.limiters.get(limit.name);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: this.redis,
        limiter: Ratelimit.slidingWindow(limit.max, `${limit.windowSec} s`),
        prefix: `elacharger:${limit.name}`,
      });
      this.limiters.set(limit.name, limiter);
    }
    const result = await limiter.limit(key);
    return { ok: result.success, resetMs: Math.max(0, result.reset - Date.now()) };
  }
}

let limiter: Limiter | undefined;

function getLimiter(): Limiter {
  if (!limiter) {
    const env = getServerEnv();
    limiter =
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
        ? new UpstashLimiter(
            new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }),
          )
        : new MemoryLimiter();
  }
  return limiter;
}

/** Throws 429 with Retry-After when the user exceeds any of the limits. */
export async function enforceRateLimit(
  userId: string,
  limits: Limit[] = ROUTING_LIMITS,
  using = getLimiter(),
) {
  for (const limit of limits) {
    const { ok, resetMs } = await using.check(limit, userId);
    if (!ok) {
      throw new ApiError(429, "Too Many Requests", {
        detail: "Too many routing requests. Try again shortly.",
        headers: { "Retry-After": String(Math.max(1, Math.ceil(resetMs / 1000))) },
      });
    }
  }
}
