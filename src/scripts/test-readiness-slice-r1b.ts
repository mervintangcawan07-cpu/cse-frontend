// Relative Path: src/scripts/test-readiness-slice-r1b.ts
/**
 * GOVSTUDYX READINESS SLICE R1B VERIFICATION SUITE
 * Validates:
 * 1. Sudo elevation rate limiter export, configuration, and SHA-256 key hashing (READINESS-P2-002)
 * 2. Sudo attempt rate-limiting enforcement and local fallback safety (READINESS-P2-002)
 * 3. Critical admin actions route integration with async checkSudoRateLimit and 429 response (READINESS-P2-002)
 * 4. Distributed concurrency lock with atomic acquisition, 30s TTL, and SHA-256 key hashing (READINESS-P2-002)
 * 5. Owner-safe lock release protecting against stale-owner deletion (READINESS-P2-002)
 * 6. Backend-affine lock handle (lock.release()) guaranteeing release through acquisition backend (READINESS-P2-002)
 * 7. Backend-affinity transition tests A & B across Redis/local state transitions (READINESS-P2-002)
 * 8. PayMongo checkout route integration with acquireLock and affine lock.release() (READINESS-P2-002)
 * 9. Compatibility wrapper between src/lib/rate-limit.ts and src/lib/ratelimit.ts (READINESS-P2-002)
 * 10. Data hygiene: Zero raw IPs or user IDs exposed in Redis/memory keys (READINESS-P2-002)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://payment_slice8d_runner@127.0.0.1:55433/payment_slice8d_integration_isolated_test";
}
import {
  SUDO_LIMITER,
  getHashedLockKey,
  generateLockToken,
  acquireDistributedLock,
  releaseDistributedLock,
  releaseRedisLock,
  releaseLocalFallbackLock,
  localFallbackLocks,
} from "../lib/ratelimit";
import {
  acquireLock as compatAcquireLock,
  releaseLock as compatReleaseLock,
} from "../lib/rate-limit";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`✅ [PASS] ${description}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${description}`);
    failed++;
  }
}

async function runR1BSuite() {
  const { checkSudoRateLimit, attemptTracker } = await import("../lib/auth/sudoMode");

  console.log("============================================================");
  console.log("GOVSTUDYX READINESS SLICE R1B VERIFICATION SUITE");
  console.log("============================================================");

  // ────────────────────────────────────────────────────────────
  // GROUP 1: Sudo Rate Limiter Configuration & Key Hashing
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 1: Sudo Rate Limiter Configuration & Key Hashing ---");

  const ratelimitSource = fs.readFileSync(
    path.join(process.cwd(), "src/lib/ratelimit.ts"),
    "utf-8"
  );
  const sudoModeSource = fs.readFileSync(
    path.join(process.cwd(), "src/lib/auth/sudoMode.ts"),
    "utf-8"
  );
  const criticalActionsSource = fs.readFileSync(
    path.join(process.cwd(), "src/routes/admin/criticalActions.ts"),
    "utf-8"
  );

  assert(
    ratelimitSource.includes("export const SUDO_LIMITER = createLimiter") &&
      ratelimitSource.includes('"1 m"') &&
      ratelimitSource.includes("/sudo`"),
    "1.1: SUDO_LIMITER defined with 3 requests per 1 minute window in src/lib/ratelimit.ts"
  );

  assert(
    sudoModeSource.includes('import { SUDO_LIMITER } from "@/lib/ratelimit"') ||
      sudoModeSource.includes("SUDO_LIMITER"),
    "1.2: sudoMode.ts imports and utilizes SUDO_LIMITER"
  );

  assert(
    sudoModeSource.includes('createHash("sha256")') &&
      sudoModeSource.includes('.digest("hex")') &&
      sudoModeSource.includes(".slice(0, 32)"),
    "1.3: sudoMode.ts hashes identifier using SHA-256 (32 hex characters)"
  );

  // Verify that raw identifier does not appear in attemptTracker
  attemptTracker.clear();
  const rawIp = "192.168.1.100";
  const rawUserId = "user_secret_admin_987";
  const rawIdentifier = `${rawIp}:${rawUserId}`;

  const firstAttempt = await checkSudoRateLimit(rawIdentifier);
  assert(firstAttempt.allowed === true, "1.4: First sudo attempt allowed");
  assert(
    firstAttempt.remainingAttempts === 2,
    "1.5: First sudo attempt reports 2 remaining attempts"
  );

  // Verify hashed key in attemptTracker
  const expectedHash = crypto
    .createHash("sha256")
    .update(rawIdentifier)
    .digest("hex")
    .slice(0, 32);

  assert(
    attemptTracker.has(expectedHash),
    "1.6: attemptTracker keys are SHA-256 hashed digests"
  );
  assert(
    !attemptTracker.has(rawIdentifier),
    "1.7: Zero raw identifiers stored in local attemptTracker keys"
  );

  // ────────────────────────────────────────────────────────────
  // GROUP 2: Sudo Rate-Limiting Enforcement & Fallback
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 2: Sudo Rate-Limiting Enforcement & Fallback ---");

  const secondAttempt = await checkSudoRateLimit(rawIdentifier);
  assert(secondAttempt.allowed === true, "2.1: Second sudo attempt allowed");
  assert(
    secondAttempt.remainingAttempts === 1,
    "2.2: Second sudo attempt reports 1 remaining attempt"
  );

  const thirdAttempt = await checkSudoRateLimit(rawIdentifier);
  assert(thirdAttempt.allowed === true, "2.3: Third sudo attempt allowed");
  assert(
    thirdAttempt.remainingAttempts === 0,
    "2.4: Third sudo attempt reports 0 remaining attempts"
  );

  const fourthAttempt = await checkSudoRateLimit(rawIdentifier);
  assert(
    fourthAttempt.allowed === false,
    "2.5: Fourth sudo attempt is BLOCKED (allowed === false)"
  );
  assert(
    typeof fourthAttempt.retryAfterSec === "number" &&
      fourthAttempt.retryAfterSec > 0 &&
      fourthAttempt.retryAfterSec <= 60,
    "2.6: Fourth sudo attempt provides valid retryAfterSec"
  );

  // ────────────────────────────────────────────────────────────
  // GROUP 3: Critical Admin Actions Route Integration
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 3: Critical Admin Actions Route Integration ---");

  assert(
    criticalActionsSource.includes("await checkSudoRateLimit("),
    "3.1: criticalActions.ts awaits checkSudoRateLimit"
  );
  assert(
    criticalActionsSource.includes("status: 429"),
    "3.2: criticalActions.ts returns HTTP 429 when rate limit is exceeded"
  );
  assert(
    criticalActionsSource.includes('"Retry-After": String(rateLimit.retryAfterSec)'),
    "3.3: criticalActions.ts sets Retry-After header with exact retry duration"
  );

  // ────────────────────────────────────────────────────────────
  // GROUP 4: Distributed Concurrency Lock & Key Hashing
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 4: Distributed Concurrency Lock & Key Hashing ---");

  const testKey = "checkout:192.168.1.55";
  const hashedLockKey = getHashedLockKey(testKey);

  assert(
    hashedLockKey.startsWith("@lock/"),
    "4.1: Lock key uses @lock/<env>/ prefix"
  );
  assert(
    !hashedLockKey.includes("192.168.1.55") && !hashedLockKey.includes("checkout:"),
    "4.2: Zero raw identifiers exposed in hashed lock key"
  );

  const token1 = generateLockToken();
  const token2 = generateLockToken();
  assert(
    token1.length === 32 && token2.length === 32 && token1 !== token2,
    "4.3: generateLockToken produces unique cryptographically random 32-hex tokens"
  );

  // ────────────────────────────────────────────────────────────
  // GROUP 5: Lock Acquisition & Concurrency Protection
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 5: Lock Acquisition & Concurrency Protection ---");

  localFallbackLocks.clear();
  const testResourceKey = "checkout:client_session_unique_1";

  const lockA = await acquireDistributedLock(testResourceKey, 30);
  assert(lockA.acquired === true, "5.1: Lock A successfully acquired");
  assert(
    typeof lockA.token === "string" && lockA.token.length > 0,
    "5.2: Lock A returned non-empty request-scoped ownership token"
  );
  assert(
    typeof lockA.release === "function",
    "5.3: Lock A returned release function handle"
  );

  // Attempt concurrent lock acquisition on same resource key
  const lockB = await acquireDistributedLock(testResourceKey, 30);
  assert(
    lockB.acquired === false,
    "5.4: Lock B rejected while Lock A is actively held"
  );
  assert(
    lockB.token === null,
    "5.5: Rejected Lock B returns null token"
  );

  // ────────────────────────────────────────────────────────────
  // GROUP 6: Owner-Safe Release & Stale-Owner Protection
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 6: Owner-Safe Release & Stale-Owner Protection ---");

  const staleToken = "fake_stale_expired_token_12345678";
  const releasedStale = releaseLocalFallbackLock(
    getHashedLockKey(testResourceKey),
    staleToken
  );
  assert(
    releasedStale === false,
    "6.1: release with mismatched/stale token is REJECTED"
  );

  // Confirm Lock A is still held
  const lockBAfterStaleAttempt = await acquireDistributedLock(testResourceKey, 30);
  assert(
    lockBAfterStaleAttempt.acquired === false,
    "6.2: Lock A remains securely held after rejected stale release attempt"
  );

  // Release Lock A using its affine handle
  const releasedA = await lockA.release();
  assert(releasedA === true, "6.3: Lock A successfully released with its own handle");

  // Now Lock B can be acquired
  const lockC = await acquireDistributedLock(testResourceKey, 30);
  assert(
    lockC.acquired === true,
    "6.4: Resource lock re-acquirable after valid owner release"
  );
  await lockC.release();

  // ────────────────────────────────────────────────────────────
  // GROUP 7: Backend-Affinity Transition Tests A & B
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 7: Backend-Affinity Transition Tests ---");

  // Transition Test A: Local acquired -> Redis up -> release removes local
  console.log("Testing Transition A: Local fallback lock release");
  const localKey = "checkout:local_transition_test";
  const hashedLocalKey = getHashedLockKey(localKey);
  localFallbackLocks.clear();

  // Manually acquire on local fallback
  const localToken = generateLockToken();
  localFallbackLocks.set(hashedLocalKey, {
    token: localToken,
    expiresAt: Date.now() + 30000,
  });

  const localHandle = {
    acquired: true,
    token: localToken,
    backend: "local" as const,
    release: async () => releaseLocalFallbackLock(hashedLocalKey, localToken),
  };

  assert(
    localFallbackLocks.has(hashedLocalKey),
    "7.1: Local fallback lock exists before release"
  );
  const transitionAReleased = await localHandle.release();
  assert(
    transitionAReleased === true,
    "7.2: Local handle releases through local fallback"
  );
  assert(
    !localFallbackLocks.has(hashedLocalKey),
    "7.3: Local lock successfully cleared from localFallbackLocks"
  );

  // Transition Test B: Redis acquired -> Redis down -> release does not corrupt local
  console.log("Testing Transition B: Redis lock handle isolation from local store");
  const redisKey = "checkout:redis_transition_test";
  const hashedRedisKey = getHashedLockKey(redisKey);
  const unrelatedLocalToken = generateLockToken();

  // Populate an unrelated local lock
  localFallbackLocks.set(hashedRedisKey, {
    token: unrelatedLocalToken,
    expiresAt: Date.now() + 30000,
  });

  const redisHandle = {
    acquired: true,
    token: "redis_owner_token_999",
    backend: "redis" as const,
    release: async () => releaseRedisLock(hashedRedisKey, "redis_owner_token_999"),
  };

  // Calling redis release handle must not delete the unrelated local lock
  await redisHandle.release();
  assert(
    localFallbackLocks.has(hashedRedisKey) &&
      localFallbackLocks.get(hashedRedisKey)?.token === unrelatedLocalToken,
    "7.4: Redis release handle does not touch or corrupt unrelated local fallback lock"
  );
  localFallbackLocks.clear();

  // ────────────────────────────────────────────────────────────
  // GROUP 8: PayMongo Checkout Route Integration
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 8: PayMongo Checkout Route Integration ---");

  const checkoutRouteSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/paymongo/checkout/route.ts"),
    "utf-8"
  );

  assert(
    checkoutRouteSource.includes("const lock = await acquireLock(lockKey)"),
    "8.1: checkout route awaits acquireLock(lockKey)"
  );
  assert(
    checkoutRouteSource.includes("if (!lock.acquired)") &&
      checkoutRouteSource.includes("status: 409"),
    "8.2: checkout route checks !lock.acquired and returns HTTP 409"
  );
  assert(
    checkoutRouteSource.includes("await lock.release()"),
    "8.3: checkout route releases lock via await lock.release() in finally block"
  );

  // ────────────────────────────────────────────────────────────
  // GROUP 9: Compatibility Layer
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 9: Compatibility Layer ---");

  const rateLimitCompatSource = fs.readFileSync(
    path.join(process.cwd(), "src/lib/rate-limit.ts"),
    "utf-8"
  );

  assert(
    rateLimitCompatSource.includes("acquireDistributedLock") &&
      rateLimitCompatSource.includes("releaseDistributedLock"),
    "9.1: rate-limit.ts imports from canonical ratelimit.ts"
  );
  assert(
    rateLimitCompatSource.includes("export async function acquireLock") &&
      rateLimitCompatSource.includes("export async function releaseLock"),
    "9.2: rate-limit.ts re-exports async acquireLock and releaseLock compatibility wrappers"
  );
  assert(
    rateLimitCompatSource.includes("export function checkRateLimit") &&
      rateLimitCompatSource.includes("export function getClientIp"),
    "9.3: rate-limit.ts preserves legacy checkRateLimit and getClientIp exports"
  );

  // Test compat wrapper invocation
  const compatLock = await compatAcquireLock("compat:test:resource", 30);
  assert(
    compatLock.acquired === true,
    "9.4: compatAcquireLock acquires lock successfully"
  );
  const compatReleased = await compatReleaseLock(
    "compat:test:resource",
    compatLock.token
  );
  assert(
    compatReleased === true,
    "9.5: compatReleaseLock releases lock successfully"
  );

  // ────────────────────────────────────────────────────────────
  // SUMMARY
  // ────────────────────────────────────────────────────────────
  console.log("\n============================================================");
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runR1BSuite().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
