// Relative Path: src/lib/payment/refundExecutionRateLimitConfig.ts

import type {
  RefundExecutionRateLimitProviderConfig,
} from "@/lib/payment/refundExecutionRateLimitProvider";

export interface RefundExecutionEnvironment {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
}

function normalizeString(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function resolveNamespace(
  environment: RefundExecutionEnvironment
): string | null {
  const vercelEnvironment =
    normalizeString(
      environment?.VERCEL_ENV
    ).toLowerCase();

  if (vercelEnvironment) {
    if (
      vercelEnvironment === "production" ||
      vercelEnvironment === "preview" ||
      vercelEnvironment === "development"
    ) {
      return vercelEnvironment;
    }

    return null;
  }

  const nodeEnvironment =
    normalizeString(
      environment?.NODE_ENV
    ).toLowerCase();

  if (
    nodeEnvironment === "production" ||
    nodeEnvironment === "development" ||
    nodeEnvironment === "test"
  ) {
    return nodeEnvironment;
  }

  return null;
}

/**
 * Resolves refund-execution rate-limit configuration from an
 * explicitly supplied environment object.
 *
 * This module does not access the global runtime environment.
 *
 * Missing or ambiguous configuration returns null so callers can
 * fail closed rather than silently disabling refund rate limiting.
 */
export function resolveRefundExecutionRateLimitConfig(
  environment:
    RefundExecutionEnvironment
): RefundExecutionRateLimitProviderConfig | null {
  if (
    !environment ||
    typeof environment !== "object"
  ) {
    return null;
  }

  const url =
    normalizeString(
      environment.UPSTASH_REDIS_REST_URL
    );

  const token =
    normalizeString(
      environment.UPSTASH_REDIS_REST_TOKEN
    );

  const namespace =
    resolveNamespace(
      environment
    );

  if (
    !url ||
    !token ||
    !namespace
  ) {
    return null;
  }

  return {
    url,
    token,
    namespace,
  };
}
