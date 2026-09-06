// Relative Path: src/lib/ratelimit.ts
import crypto from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { CACHE_PROFILES } from "@/lib/cache";

const hasRedisCredentials = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const redis = hasRedisCredentials
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Helper to construct Ratelimit instance if Redis is configured
function createLimiter(
  limiterConfig: Parameters<typeof Ratelimit.slidingWindow>[0],
  window: Parameters<typeof Ratelimit.slidingWindow>[1],
  prefix: string
) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limiterConfig, window),
    analytics: true,
    prefix,
  });
}

const rateLimitEnvironment =
  process.env.VERCEL_ENV || process.env.NODE_ENV || "development";

// 🔒 1. Auth Limiter: 5 requests per 10 seconds (Login / Register / Signup)
export const AUTH_LIMITER = createLimiter(5, "10 s", "@ratelimit/auth");

// 🔒 2. Exam Submit Limiter: 10 requests per 1 minute (Exam / Mock submissions)
export const EXAM_SUBMIT_LIMITER = createLimiter(10, "1 m", "@ratelimit/exam_submit");

// 🔒 3. Messaging Limiter: 20 requests per 1 minute (Social / Chat messages)
export const MESSAGING_LIMITER = createLimiter(20, "1 m", "@ratelimit/messaging");

// 🔒 4. AI Explain Limiter: 15 requests per 1 minute (AI mistake analysis)
export const AI_EXPLAIN_LIMITER = createLimiter(15, "1 m", "@ratelimit/ai_explain");

// 🔒 5. PayMongo Checkout Limiter: 3 requests per 1 minute
export const PAYMONGO_CHECKOUT_LIMITER = createLimiter(
  3,
  "1 m",
  `@ratelimit/${rateLimitEnvironment}/paymongo_checkout`
);

// 🔒 6. PayMongo Verify Limiter: 20 requests per 1 minute
export const PAYMONGO_VERIFY_LIMITER = createLimiter(
  20,
  "1 m",
  `@ratelimit/${rateLimitEnvironment}/paymongo_verify`
);

// 🔒 7. Voice Token Limiter: 10 requests per 1 minute
export const VOICE_TOKEN_LIMITER = createLimiter(
  10,
  "1 m",
  `@ratelimit/${rateLimitEnvironment}/voice_token`
);

// 🔒 8. Support Ticket Limiter: 3 requests per 10 minutes
export const SUPPORT_TICKET_LIMITER = createLimiter(
  3,
  "10 m",
  `@ratelimit/${rateLimitEnvironment}/support_ticket`
);

// 🔒 9. AI Question Generation Limiter: 5 requests per 1 minute (Admin AI generation)
export const AI_GENERATE_LIMITER = createLimiter(
  5,
  "1 m",
  `@ratelimit/${rateLimitEnvironment}/ai_generate`
);

// 🔒 10. Exam Start Limiter: 10 requests per 1 minute (Mock / Custom quiz start)
export const EXAM_START_LIMITER = createLimiter(
  10,
  "1 m",
  `@ratelimit/${rateLimitEnvironment}/exam_start`
);

// 🔒 11. Sudo Elevation Limiter: 3 requests per 1 minute (Admin password elevation)
export const SUDO_LIMITER = createLimiter(
  3,
  "1 m",
  `@ratelimit/${rateLimitEnvironment}/sudo`
);

export interface RateLimitCheckResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Executes rate limit check with fail-open fallback.
 * If Redis is not configured or throws a network error, requests succeed without interruption.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitCheckResult> {
  if (!limiter) {
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.warn("[RATELIMIT_FAIL_OPEN_WARNING] Upstash Redis unreachable, allowing request:", error);
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
}

/**
 * Extracts client IP address from Next.js request headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

/**
 * Standardized HTTP 429 Too Many Requests response builder.
 */
export function createRateLimitResponse(
  rateLimitResult: RateLimitCheckResult,
  customMessage?: string
): NextResponse {
  const now = Date.now();
  const resetSeconds = Math.max(1, Math.ceil((rateLimitResult.reset - now) / 1000));
  const message =
    customMessage || `Too many requests. Please retry in ${resetSeconds} second${resetSeconds > 1 ? "s" : ""}.`;

  const headers = new Headers({
    ...CACHE_PROFILES.PRIVATE,
    "Retry-After": String(resetSeconds),
    "X-RateLimit-Limit": String(rateLimitResult.limit),
    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
    "X-RateLimit-Reset": String(rateLimitResult.reset),
  });

  return NextResponse.json(
    {
      error: message,
      retryAfterSeconds: resetSeconds,
    },
    {
      status: 429,
      headers,
    }
  );
}

// ============================================================================
// Distributed Concurrency Lock (Atomic Redis + Owner-Safe Local Fallback)
// ============================================================================

export interface LockResult {
  acquired: boolean;
  token: string | null;
  release: () => Promise<boolean>;
  backend?: "redis" | "local" | "none";
}

export function getHashedLockKey(rawKey: string): string {
  const digest = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex")
    .slice(0, 32);
  return `@lock/${rateLimitEnvironment}/${digest}`;
}

export function generateLockToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export interface FallbackLockEntry {
  token: string;
  expiresAt: number;
}

export const localFallbackLocks = new Map<string, FallbackLockEntry>();

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export async function releaseRedisLock(
  hashedKey: string,
  token: string
): Promise<boolean> {
  if (!redis || !token) return false;
  try {
    const result = await redis.eval<[string], number>(
      RELEASE_LOCK_LUA,
      [hashedKey],
      [token]
    );
    return Number(result) === 1;
  } catch (error) {
    console.warn("[LOCK_RELEASE_ERROR] Failed to release Redis lock:", error);
    return false;
  }
}

export function releaseLocalFallbackLock(
  hashedKey: string,
  token: string
): boolean {
  if (!token) return false;
  const existing = localFallbackLocks.get(hashedKey);
  if (!existing) {
    return false;
  }
  if (existing.token !== token) {
    // Stale owner or re-acquired lock; prevent unauthorized release
    return false;
  }
  localFallbackLocks.delete(hashedKey);
  return true;
}

export async function acquireDistributedLock(
  rawKey: string,
  ttlSeconds = 30
): Promise<LockResult> {
  const hashedKey = getHashedLockKey(rawKey);
  const token = generateLockToken();

  // 1. Attempt Redis distributed lock if configured
  if (redis) {
    try {
      const res = await redis.set(hashedKey, token, {
        nx: true,
        ex: ttlSeconds,
      });

      if (res === "OK") {
        return {
          acquired: true,
          token,
          backend: "redis",
          release: async () => releaseRedisLock(hashedKey, token),
        };
      } else {
        // Lock already held in Redis by another active request
        return {
          acquired: false,
          token: null,
          backend: "none",
          release: async () => false,
        };
      }
    } catch (error) {
      console.warn(
        "[LOCK_FAIL_FALLBACK_WARNING] Upstash Redis lock error, falling back to local lock:",
        error
      );
      // Fall through to local fallback
    }
  }

  // 2. Process-local fallback lock (owner-safe with TTL)
  const now = Date.now();
  const existing = localFallbackLocks.get(hashedKey);
  if (existing && existing.expiresAt > now) {
    return {
      acquired: false,
      token: null,
      backend: "none",
      release: async () => false,
    };
  }

  localFallbackLocks.set(hashedKey, {
    token,
    expiresAt: now + ttlSeconds * 1000,
  });

  return {
    acquired: true,
    token,
    backend: "local",
    release: async () => releaseLocalFallbackLock(hashedKey, token),
  };
}

export async function releaseDistributedLock(
  rawKey: string,
  token: string | null
): Promise<boolean> {
  if (!token) return false;
  const hashedKey = getHashedLockKey(rawKey);

  let released = false;
  if (redis) {
    try {
      released = await releaseRedisLock(hashedKey, token);
    } catch {
      // ignore
    }
  }

  const localReleased = releaseLocalFallbackLock(hashedKey, token);
  return released || localReleased;
}

export const acquireLock = acquireDistributedLock;
export const releaseLock = releaseDistributedLock;
