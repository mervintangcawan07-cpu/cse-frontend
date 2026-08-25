// Relative Path: src/lib/payment/refundExecutionRateLimit.ts

import type {
  RefundExecutionRateLimitDecision,
} from "@/lib/payment/refundExecutionSecurityContract";

export const REFUND_EXECUTION_RATE_LIMIT_MAX_ATTEMPTS = 3;
export const REFUND_EXECUTION_RATE_LIMIT_WINDOW = "1 m";

export interface RefundExecutionDistributedLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface RefundExecutionDistributedLimiter {
  limit(
    identifier: string
  ): Promise<RefundExecutionDistributedLimitResult>;
}

export interface CheckRefundExecutionRateLimitInput {
  limiter:
    | RefundExecutionDistributedLimiter
    | null
    | undefined;

  identifier: string;

  nowMs?: number;
}

function normalizeIdentifier(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isValidFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}

function validateLimiterResult(
  result: unknown
): result is RefundExecutionDistributedLimitResult {
  if (
    !result ||
    typeof result !== "object"
  ) {
    return false;
  }

  const value =
    result as Record<string, unknown>;

  return (
    typeof value.success === "boolean" &&
    isValidFiniteNumber(value.limit) &&
    isValidFiniteNumber(value.remaining) &&
    isValidFiniteNumber(value.reset) &&
    value.limit >= 0 &&
    value.remaining >= 0 &&
    value.reset >= 0
  );
}

function calculateRetryAfterSeconds(
  reset: number,
  nowMs: number
): number {
  if (
    !Number.isFinite(reset) ||
    !Number.isFinite(nowMs)
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.ceil(
      (reset - nowMs) / 1000
    )
  );
}

/**
 * Fail-closed adapter around a distributed rate limiter.
 *
 * Important:
 * - no Redis construction here
 * - no environment reads
 * - no global limiter
 * - no fallback to an in-memory limiter
 *
 * A missing limiter, thrown limiter call, or malformed result is
 * UNAVAILABLE and therefore rejected by the refund security contract.
 */
export async function checkRefundExecutionRateLimit(
  input: CheckRefundExecutionRateLimitInput
): Promise<RefundExecutionRateLimitDecision> {
  const identifier =
    normalizeIdentifier(
      input?.identifier
    );

  if (!identifier) {
    return {
      status: "UNAVAILABLE",
      reason:
        "INVALID_RATE_LIMIT_IDENTIFIER",
    };
  }

  if (
    !input?.limiter ||
    typeof input.limiter.limit !==
      "function"
  ) {
    return {
      status: "UNAVAILABLE",
      reason:
        "DISTRIBUTED_LIMITER_UNAVAILABLE",
    };
  }

  const nowMs =
    input.nowMs ??
    Date.now();

  if (
    !Number.isFinite(nowMs) ||
    nowMs < 0
  ) {
    return {
      status: "UNAVAILABLE",
      reason:
        "INVALID_RATE_LIMIT_CLOCK",
    };
  }

  let result:
    RefundExecutionDistributedLimitResult;

  try {
    result =
      await input.limiter.limit(
        identifier
      );
  } catch {
    return {
      status: "UNAVAILABLE",
      reason:
        "DISTRIBUTED_LIMITER_ERROR",
    };
  }

  if (
    !validateLimiterResult(
      result
    )
  ) {
    return {
      status: "UNAVAILABLE",
      reason:
        "DISTRIBUTED_LIMITER_RESULT_INVALID",
    };
  }

  if (!result.success) {
    return {
      status: "DENIED",
      retryAfterSeconds:
        calculateRetryAfterSeconds(
          result.reset,
          nowMs
        ),
    };
  }

  return {
    status: "ALLOWED",
  };
}
