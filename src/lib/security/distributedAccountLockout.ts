import crypto from "node:crypto";
import { Redis } from "@upstash/redis";

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const CHECK_SCRIPT = `
local count = tonumber(redis.call("GET", KEYS[1]) or "0")
local ttl = redis.call("PTTL", KEYS[1])
if count >= tonumber(ARGV[1]) and ttl > 0 then
  return {1, ttl}
end
return {0, 0}
`;

const RECORD_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
local threshold = tonumber(ARGV[1])
local duration = tonumber(ARGV[2])
if count == 1 or count == threshold then
  redis.call("PEXPIRE", KEYS[1], duration)
end
return {count, redis.call("PTTL", KEYS[1])}
`;

export interface LockoutStorage {
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>;
  del(key: string): Promise<number>;
}

export interface DistributedAccountLockout {
  check(email: string): Promise<{ isLocked: boolean; remainingSeconds: number }>;
  recordFailure(email: string): Promise<{
    isLocked: boolean;
    attemptsLeft: number;
    remainingSeconds: number;
  }>;
  reset(email: string): Promise<void>;
}

function parsePair(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error("Invalid distributed lockout response");
  }
  const first = Number(value[0]);
  const second = Number(value[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    throw new Error("Invalid distributed lockout response");
  }
  return [first, second];
}

/**
 * Isolates login counters by deployment environment and HMAC-hashed email.
 * No email address or account ID is stored in the Redis key.
 *
 * Count/TTL mutations use an atomic Redis Lua script. A full 15-minute
 * lockout begins on the fifth unsuccessful password attempt. When the
 * feature is enabled, storage errors must NOT fall back to process memory.
 */
export function createDistributedAccountLockout(
  storage: LockoutStorage,
  secret: string,
  environment: string
): DistributedAccountLockout {
  if (!secret || !secret.trim()) throw new Error("Login lockout secret is missing");
  if (!/^[a-zA-Z0-9_-]+$/.test(environment)) {
    throw new Error("Invalid login lockout environment");
  }
  const key = (email: string): string => {
    const digest = crypto
      .createHmac("sha256", secret)
      .update(email.trim().toLowerCase())
      .digest("hex");
    return `govstudyx:security:${environment}:login-lockout:${digest}`;
  };

  return {
    async check(email) {
      const [locked, ttl] = parsePair(
        await storage.eval(CHECK_SCRIPT, [key(email)], [MAX_FAILURES])
      );
      return {
        isLocked: locked === 1,
        remainingSeconds: locked === 1 ? Math.max(1, Math.ceil(ttl / 1000)) : 0,
      };
    },
    async recordFailure(email) {
      const [count, ttl] = parsePair(
        await storage.eval(RECORD_SCRIPT, [key(email)], [MAX_FAILURES, LOCKOUT_MS])
      );
      const isLocked = count >= MAX_FAILURES;
      return {
        isLocked,
        attemptsLeft: Math.max(0, MAX_FAILURES - count),
        remainingSeconds: isLocked ? Math.max(1, Math.ceil(ttl / 1000)) : 0,
      };
    },
    async reset(email) {
      await storage.del(key(email));
    },
  };
}

let liveService: DistributedAccountLockout | undefined;

/**
 * Explicit opt-in only. Not enabled on production by committing this file.
 * Deployment must have a healthy Upstash Redis and JWT_SECRET configured.
 */
export function isDistributedLoginLockoutEnabled(): boolean {
  return process.env.SECURITY_DISTRIBUTED_LOGIN_LOCKOUT === "1";
}

export function getDistributedLoginLockout(): DistributedAccountLockout {
  if (liveService) return liveService;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const secret = process.env.JWT_SECRET;
  if (!url || !token || !secret) {
    throw new Error("Distributed login lockout configuration is incomplete");
  }
  const environment = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
  const redis = new Redis({ url, token });
  liveService = createDistributedAccountLockout(redis, secret, environment);
  return liveService;
}
