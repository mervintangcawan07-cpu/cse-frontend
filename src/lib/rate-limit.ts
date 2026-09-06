import {
  acquireDistributedLock,
  releaseDistributedLock,
  type LockResult,
} from "@/lib/ratelimit";

export type { LockResult };

type RateLimitRecord = {
  count: number;
  resetTime: number;
};

// In-memory store for legacy rate limits
const rateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup expired entries every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (typeof cleanupTimer.unref === "function") {
  cleanupTimer.unref();
}

/**
 * Checks sliding window rate limit (e.g. 3 attempts / min)
 */
export function checkRateLimit(
  key: string,
  maxRequests = 3,
  windowMs = 60000
): { allowed: boolean; resetSeconds: number } {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, resetSeconds: Math.ceil(windowMs / 1000) };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      resetSeconds: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    resetSeconds: Math.ceil((record.resetTime - now) / 1000),
  };
}

/**
 * Distributed concurrency lock (atomic Redis + owner-safe local fallback)
 */
export async function acquireLock(
  key: string,
  ttlSeconds = 30
): Promise<LockResult> {
  return acquireDistributedLock(key, ttlSeconds);
}

export async function releaseLock(
  key: string,
  token?: string | null
): Promise<boolean> {
  return releaseDistributedLock(key, token ?? null);
}

/**
 * Extracts client IP address from Next.js headers
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}
