/**
 * Rate limiting module.
 *
 * Uses Upstash Redis (sliding window) when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are configured — recommended for production.
 *
 * Falls back to an in-memory sliding window when those env vars are absent.
 * The in-memory fallback works per-serverless-instance; it is not shared
 * across Vercel deployment instances but is still useful for catching burst
 * attacks on a single warm instance.
 *
 * To upgrade: create a free Upstash Redis database at upstash.com and set
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars.
 */

import type { Ratelimit as UpstashRatelimit } from "@upstash/ratelimit";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix ms
};

export type RateLimitConfig = {
  /** Unique identifier — e.g. "login" or "booking" */
  prefix: string;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory sliding window (fallback)
// ─────────────────────────────────────────────────────────────────────────────

type WindowEntry = { timestamps: number[] };
const memoryStore = new Map<string, WindowEntry>();

// Clean up stale keys periodically so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (!entry.timestamps.length || now - entry.timestamps[entry.timestamps.length - 1]! > 3_600_000) {
      memoryStore.delete(key);
    }
  }
}, 60_000).unref?.();

function memoryCheck(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const cutoff = now - windowMs;

  let entry = memoryStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    memoryStore.set(key, entry);
  }

  // Evict timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.limit) {
    const oldest = entry.timestamps[0] ?? now;
    return { allowed: false, remaining: 0, resetAt: oldest + windowMs };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Upstash Redis sliding window (production)
// ─────────────────────────────────────────────────────────────────────────────

// Limiter instances are cached per config key to avoid re-instantiating on
// each request. Upstash recommends one Ratelimit instance per limit config.
const _limiterCache = new Map<string, UpstashRatelimit>();
let _upstashAvailable: boolean | null = null; // null = not yet checked

async function getUpstashLimiter(config: RateLimitConfig): Promise<UpstashRatelimit | null> {
  // One-time env check
  if (_upstashAvailable === null) {
    _upstashAvailable = !!(
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    );
  }
  if (!_upstashAvailable) return null;

  const cacheKey = `${config.prefix}:${config.limit}:${config.windowSeconds}`;
  if (_limiterCache.has(cacheKey)) return _limiterCache.get(cacheKey)!;

  try {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import("@upstash/ratelimit"),
      import("@upstash/redis"),
    ]);

    const url   = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

    const limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
      prefix: `rl:${config.prefix}`,
    });

    _limiterCache.set(cacheKey, limiter);
    logger.info("Rate limiter: Upstash Redis initialised", { prefix: config.prefix });
    return limiter;
  } catch (err) {
    logger.warn("Rate limiter: Upstash unavailable, using memory fallback", { error: String(err) });
    _upstashAvailable = false;
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check rate limit for a given identifier (typically an IP address).
 *
 * @example
 *   const { allowed } = await rateLimit(LIMITS.login, ip);
 *   if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */
export async function rateLimit(
  config: RateLimitConfig,
  identifier: string
): Promise<RateLimitResult> {
  const key = `${config.prefix}:${identifier}`;

  const limiter = await getUpstashLimiter(config);
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
      };
    } catch (err) {
      logger.warn("Upstash rate limit check failed, falling back to memory", {
        action: "rate-limit-fallback",
        error: String(err),
      });
    }
  }

  return memoryCheck(key, config);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-defined limits for common routes
// ─────────────────────────────────────────────────────────────────────────────

export const LIMITS = {
  /** Login attempts per IP: 5 per minute */
  login: { prefix: "login", limit: 5, windowSeconds: 60 } satisfies RateLimitConfig,

  /** Signup attempts per IP: 3 per 10 minutes */
  signup: { prefix: "signup", limit: 3, windowSeconds: 600 } satisfies RateLimitConfig,

  /** Password reset requests per IP: 3 per 15 minutes */
  passwordReset: { prefix: "pwd-reset", limit: 3, windowSeconds: 900 } satisfies RateLimitConfig,

  /** Public booking form submissions per IP: 10 per minute */
  booking: { prefix: "booking", limit: 10, windowSeconds: 60 } satisfies RateLimitConfig,

  /** Public form submissions per IP: 20 per minute */
  formSubmit: { prefix: "form-submit", limit: 20, windowSeconds: 60 } satisfies RateLimitConfig,

  /** Inbound Twilio webhook — Twilio is trusted but we still protect: 200/min */
  twilioWebhook: { prefix: "twilio", limit: 200, windowSeconds: 60 } satisfies RateLimitConfig,

  /** CSV import per authenticated user: 5 per minute */
  importContacts: { prefix: "import", limit: 5, windowSeconds: 60 } satisfies RateLimitConfig,

  /** General authenticated API: 300/min per user */
  api: { prefix: "api", limit: 300, windowSeconds: 60 } satisfies RateLimitConfig,
} as const;
