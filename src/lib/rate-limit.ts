type RateLimitRecord = {
  count: number;
  resetTime: number;
};

// In-memory stores for rate limits and active concurrency locks
const rateLimitMap = new Map<string, RateLimitRecord>();
const activeRequestLocks = new Set<string>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
 * Enforces 1 active request at a time per key (for payments)
 */
export function acquireLock(key: string): boolean {
  if (activeRequestLocks.has(key)) {
    return false;
  }
  activeRequestLocks.add(key);
  return true;
}

export function releaseLock(key: string): void {
  activeRequestLocks.delete(key);
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
