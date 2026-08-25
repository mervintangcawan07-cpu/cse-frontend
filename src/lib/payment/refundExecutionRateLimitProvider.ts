// Relative Path: src/lib/payment/refundExecutionRateLimitProvider.ts

import {
  Ratelimit,
} from "@upstash/ratelimit";

import {
  Redis,
} from "@upstash/redis";

import {
  REFUND_EXECUTION_RATE_LIMIT_MAX_ATTEMPTS,
  REFUND_EXECUTION_RATE_LIMIT_WINDOW,
  type RefundExecutionDistributedLimiter,
} from "@/lib/payment/refundExecutionRateLimit";

export interface RefundExecutionRateLimitProviderConfig {
  url: string;
  token: string;
  namespace: string;
}

export interface RefundExecutionRateLimitProviderDependencies {
  createRedis: (
    input: {
      url: string;
      token: string;
    }
  ) => unknown;

  createRatelimit: (
    input: {
      redis: unknown;
      prefix: string;
      maxAttempts: number;
      window: string;
    }
  ) => RefundExecutionDistributedLimiter;
}

function normalizeString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeRedisUrl(
  value: unknown
): string | null {
  const raw =
    normalizeString(value);

  if (!raw) {
    return null;
  }

  try {
    const parsed =
      new URL(raw);

    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname
    ) {
      return null;
    }

    return parsed
      .toString()
      .replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeNamespace(
  value: unknown
): string | null {
  const namespace =
    normalizeString(value);

  if (
    namespace.length < 1 ||
    namespace.length > 64 ||
    !/^[A-Za-z0-9._-]+$/.test(
      namespace
    )
  ) {
    return null;
  }

  return namespace;
}

export function buildRefundExecutionRateLimitPrefix(
  namespace: string
): string | null {
  const normalized =
    normalizeNamespace(namespace);

  if (!normalized) {
    return null;
  }

  return (
    `@ratelimit/${normalized}/` +
    "refund_execution"
  );
}

const DEFAULT_DEPENDENCIES:
  RefundExecutionRateLimitProviderDependencies = {
    createRedis:
      (input) =>
        new Redis({
          url:
            input.url,

          token:
            input.token,
        }),

    createRatelimit:
      (input) =>
        new Ratelimit({
          redis:
            input.redis as Redis,

          limiter:
            Ratelimit.slidingWindow(
              input.maxAttempts,
              input.window as
                Parameters<
                  typeof Ratelimit.slidingWindow
                >[1]
            ),

          analytics:
            false,

          prefix:
            input.prefix,
        }),
  };

/**
 * Builds the refund-execution distributed limiter.
 *
 * Security properties:
 *
 * - no process.env access
 * - configuration must be supplied explicitly by caller
 * - HTTPS Redis REST URL required
 * - no in-memory fallback
 * - no shared/global limiter mutation
 * - constructor/configuration errors fail closed to null
 *
 * Returning null is intentional: Phase 2B6D converts a missing
 * limiter into UNAVAILABLE and Phase 2B6C rejects execution.
 */
export function createRefundExecutionDistributedLimiter(
  config:
    RefundExecutionRateLimitProviderConfig,

  dependencies:
    RefundExecutionRateLimitProviderDependencies =
      DEFAULT_DEPENDENCIES
): RefundExecutionDistributedLimiter | null {
  const url =
    normalizeRedisUrl(
      config?.url
    );

  const token =
    normalizeString(
      config?.token
    );

  const prefix =
    buildRefundExecutionRateLimitPrefix(
      config?.namespace
    );

  if (
    !url ||
    !token ||
    !prefix
  ) {
    return null;
  }

  if (
    !dependencies ||
    typeof dependencies.createRedis !==
      "function" ||
    typeof dependencies.createRatelimit !==
      "function"
  ) {
    return null;
  }

  try {
    const redis =
      dependencies.createRedis({
        url,
        token,
      });

    if (!redis) {
      return null;
    }

    const limiter =
      dependencies.createRatelimit({
        redis,

        prefix,

        maxAttempts:
          REFUND_EXECUTION_RATE_LIMIT_MAX_ATTEMPTS,

        window:
          REFUND_EXECUTION_RATE_LIMIT_WINDOW,
      });

    if (
      !limiter ||
      typeof limiter.limit !==
        "function"
    ) {
      return null;
    }

    return limiter;
  } catch {
    return null;
  }
}
