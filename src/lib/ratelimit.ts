// Relative Path: src/lib/ratelimit.ts
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

// 🔒 1. Auth Limiter: 5 requests per 10 seconds (Login / Register / Signup)
export const AUTH_LIMITER = createLimiter(5, "10 s", "@ratelimit/auth");

// 🔒 2. Exam Submit Limiter: 10 requests per 1 minute (Exam / Mock submissions)
export const EXAM_SUBMIT_LIMITER = createLimiter(10, "1 m", "@ratelimit/exam_submit");

// 🔒 3. Messaging Limiter: 20 requests per 1 minute (Social / Chat messages)
export const MESSAGING_LIMITER = createLimiter(20, "1 m", "@ratelimit/messaging");

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
