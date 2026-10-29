/**
 * Opt-in fail-closed policy for administrator sudo verification.
 *
 * When enabled, unavailable Redis must not silently fall back to per-instance
 * memory. Default behavior stays unchanged until the flag is configured.
 */

export interface SudoLimitDecision {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSec?: number;
}

export interface SudoLimitProvider {
  limit(identifier: string): Promise<{
    success: boolean;
    remaining: number;
    reset: number;
  }>;
}

const OUTAGE_RETRY_SECONDS = 15;

export function isStrictSudoRateLimitEnabled(): boolean {
  return process.env.SECURITY_SUDO_RATE_LIMIT_FAIL_CLOSED === "1";
}

export async function checkStrictSudoRateLimit(
  limiter: SudoLimitProvider | null,
  identifier: string,
  now: number = Date.now()
): Promise<SudoLimitDecision> {
  const unavailable: SudoLimitDecision = {
    allowed: false,
    remainingAttempts: 0,
    retryAfterSec: OUTAGE_RETRY_SECONDS,
  };

  if (!limiter) return unavailable;

  try {
    const result = await limiter.limit(identifier);
    if (
      typeof result.success !== "boolean" ||
      !Number.isFinite(result.remaining) ||
      !Number.isFinite(result.reset)
    ) {
      return unavailable;
    }

    if (result.success) {
      return {
        allowed: true,
        remainingAttempts: Math.max(0, Math.floor(result.remaining)),
      };
    }

    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSec: Math.max(1, Math.ceil((result.reset - now) / 1000)),
    };
  } catch {
    return unavailable;
  }
}
