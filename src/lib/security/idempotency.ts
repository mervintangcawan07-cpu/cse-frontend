// Relative Path: src/lib/security/idempotency.ts
import crypto from "crypto";
import { Redis } from "@upstash/redis";

const hasRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export interface IdempotencyRecord {
  status: "PENDING" | "RESOLVED";
  statusCode?: number;
  responseBody?: unknown;
}

const localFallbackStore = new Map<
  string,
  { record: IdempotencyRecord; expiresAt: number }
>();

function buildScopedKey(rawKey: string, userId?: string): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${userId || "anon"}:${rawKey}`)
    .digest("hex")
    .slice(0, 32);
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
  return `@idempotency/${env}/${digest}`;
}

export async function acquireIdempotency(
  key: string,
  userId?: string,
  ttlSeconds: number = 60
): Promise<{ status: "ACQUIRED" | "PENDING" | "RESOLVED"; record?: IdempotencyRecord }> {
  const scopedKey = buildScopedKey(key, userId);

  if (redis) {
    try {
      const initialRecord: IdempotencyRecord = { status: "PENDING" };
      const setSuccess = await redis.set(scopedKey, JSON.stringify(initialRecord), {
        nx: true,
        ex: ttlSeconds,
      });

      if (setSuccess === "OK") {
        return { status: "ACQUIRED" };
      }

      const existing = await redis.get<string | IdempotencyRecord>(scopedKey);
      if (!existing) return { status: "ACQUIRED" };

      const parsed: IdempotencyRecord =
        typeof existing === "string" ? JSON.parse(existing) : existing;

      return { status: parsed.status, record: parsed };
    } catch (err) {
      console.warn("[IDEMPOTENCY_REDIS_FALLBACK] Falling back to memory lock:", err);
    }
  }

  // Serverless in-memory fallback
  const now = Date.now();
  const cached = localFallbackStore.get(scopedKey);

  if (cached && cached.expiresAt > now) {
    return { status: cached.record.status, record: cached.record };
  }

  localFallbackStore.set(scopedKey, {
    record: { status: "PENDING" },
    expiresAt: now + ttlSeconds * 1000,
  });

  return { status: "ACQUIRED" };
}

export async function resolveIdempotency(
  key: string,
  statusCode: number,
  responseBody: unknown,
  userId?: string,
  ttlSeconds: number = 300
): Promise<void> {
  const scopedKey = buildScopedKey(key, userId);
  const record: IdempotencyRecord = {
    status: "RESOLVED",
    statusCode,
    responseBody,
  };

  if (redis) {
    try {
      await redis.set(scopedKey, JSON.stringify(record), { ex: ttlSeconds });
      return;
    } catch {
      // Fall through to memory
    }
  }

  localFallbackStore.set(scopedKey, {
    record,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function releaseIdempotency(key: string, userId?: string): Promise<void> {
  const scopedKey = buildScopedKey(key, userId);

  if (redis) {
    try {
      await redis.del(scopedKey);
    } catch {
      // Ignore cleanup error
    }
  }

  localFallbackStore.delete(scopedKey);
}