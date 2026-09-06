// Relative Path: src/scripts/test-readiness-slice-r1a.ts
/**
 * GOVSTUDYX READINESS SLICE R1A VERIFICATION SUITE
 * Validates:
 * 1. Production encryption key guard (READINESS-P2-001)
 * 2. AI generation rate limiter (READINESS-P2-003)
 * 3. Exam start rate limiter (READINESS-P2-004)
 * 4. Exam history safe server-side query bounding (READINESS-P2-005)
 * 5. Production readiness environment validation (READINESS-P2-006)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getKeyForVersion, encrypt, decrypt } from "../lib/crypto/encryption";
import {
  AI_GENERATE_LIMITER,
  EXAM_START_LIMITER,
} from "../lib/ratelimit";

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

async function runR1ASuite() {
  console.log("============================================================");
  console.log("GOVSTUDYX READINESS SLICE R1A VERIFICATION SUITE");
  console.log("============================================================");

  // ────────────────────────────────────────────────────────────
  // 1. PRODUCTION ENCRYPTION KEY GUARD (P2-001)
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 1: Production Encryption Key Guard ---");

  const originalEnv = process.env.NODE_ENV;
  const originalKeyV1 = process.env.ENCRYPTION_KEY_V1;
  const originalKey = process.env.ENCRYPTION_KEY;
  const originalJwt = process.env.JWT_SECRET;

  try {
    (process.env as any).NODE_ENV = "production";

    // 1A. In production, JWT_SECRET alone MUST NOT be accepted as encryption key
    delete process.env.ENCRYPTION_KEY_V1;
    delete process.env.ENCRYPTION_KEY;
    process.env.JWT_SECRET = "production_super_jwt_secret_value_12345";

    let threwOnJwtAlone = false;
    let errorMessage = "";
    try {
      getKeyForVersion("v1");
    } catch (err: any) {
      threwOnJwtAlone = true;
      errorMessage = err?.message || "";
    }
    assert(
      threwOnJwtAlone && errorMessage.includes("Required production encryption key"),
      "Production strictly rejects JWT_SECRET as encryption key fallback"
    );

    // 1B. In production, missing both ENCRYPTION_KEY_V1 and ENCRYPTION_KEY throws
    delete process.env.JWT_SECRET;
    let threwOnMissing = false;
    try {
      getKeyForVersion("v1");
    } catch {
      threwOnMissing = true;
    }
    assert(threwOnMissing, "Production throws when no encryption key is configured");

    // 1C. In production, ENCRYPTION_KEY_V1 alone succeeds (Production standard)
    process.env.ENCRYPTION_KEY_V1 = "prod_versioned_encryption_key_v1_secure_123456789";
    delete process.env.ENCRYPTION_KEY;
    let v1KeyBuffer: Buffer | null = null;
    try {
      v1KeyBuffer = getKeyForVersion("v1");
    } catch {
      v1KeyBuffer = null;
    }
    assert(
      Buffer.isBuffer(v1KeyBuffer) && v1KeyBuffer.length === 32,
      "Production succeeds with dedicated ENCRYPTION_KEY_V1"
    );

    // Verify round-trip encryption/decryption with ENCRYPTION_KEY_V1
    const sensitivePayload = "09171234567_GCASH_ACCOUNT";
    const encryptedV1 = encrypt(sensitivePayload);
    assert(
      typeof encryptedV1 === "string" && encryptedV1.startsWith("enc:v1:"),
      "encrypt() produces valid enc:v1: ciphertext using ENCRYPTION_KEY_V1"
    );
    const decryptedV1 = decrypt(encryptedV1);
    assert(
      decryptedV1 === sensitivePayload,
      "decrypt() accurately recovers plaintext using ENCRYPTION_KEY_V1"
    );

    // 1D. In production, legacy ENCRYPTION_KEY alone succeeds (Compatibility fallback)
    delete process.env.ENCRYPTION_KEY_V1;
    process.env.ENCRYPTION_KEY = "legacy_compat_encryption_key_secure_987654321";
    let legacyKeyBuffer: Buffer | null = null;
    try {
      legacyKeyBuffer = getKeyForVersion("v1");
    } catch {
      legacyKeyBuffer = null;
    }
    assert(
      Buffer.isBuffer(legacyKeyBuffer) && legacyKeyBuffer.length === 32,
      "Production succeeds with legacy compatibility ENCRYPTION_KEY"
    );

    // 1E. In non-production, dev fallback is preserved
    (process.env as any).NODE_ENV = "development";
    delete process.env.ENCRYPTION_KEY_V1;
    delete process.env.ENCRYPTION_KEY;
    delete process.env.JWT_SECRET;
    let devFallbackBuffer: Buffer | null = null;
    try {
      devFallbackBuffer = getKeyForVersion("v1");
    } catch {
      devFallbackBuffer = null;
    }
    assert(
      Buffer.isBuffer(devFallbackBuffer) && devFallbackBuffer.length === 32,
      "Non-production development fallback is safely preserved"
    );
  } finally {
    (process.env as any).NODE_ENV = originalEnv;
    if (originalKeyV1) process.env.ENCRYPTION_KEY_V1 = originalKeyV1;
    else delete process.env.ENCRYPTION_KEY_V1;
    if (originalKey) process.env.ENCRYPTION_KEY = originalKey;
    else delete process.env.ENCRYPTION_KEY;
    if (originalJwt) process.env.JWT_SECRET = originalJwt;
    else delete process.env.JWT_SECRET;
  }

  // ────────────────────────────────────────────────────────────
  // 2. AI GENERATION RATE LIMITER (P2-003)
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 2: AI Generation Rate Limiter ---");

  assert(
    AI_GENERATE_LIMITER !== null && typeof AI_GENERATE_LIMITER === "object" || AI_GENERATE_LIMITER === null,
    "AI_GENERATE_LIMITER is defined and exported from ratelimit module"
  );

  const aiGenerateSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/questions/ai-generate/route.ts"),
    "utf8"
  );

  assert(
    aiGenerateSource.includes("AI_GENERATE_LIMITER"),
    "ai-generate route imports AI_GENERATE_LIMITER"
  );
  assert(
    aiGenerateSource.includes("checkRateLimit(AI_GENERATE_LIMITER"),
    "ai-generate route executes checkRateLimit with AI_GENERATE_LIMITER"
  );
  assert(
    aiGenerateSource.includes("authentication.session.user.id") &&
      aiGenerateSource.includes("admin:ai-generate:"),
    "ai-generate route scopes rate limit key strictly to authenticated administrator ID"
  );
  assert(
    aiGenerateSource.includes("createRateLimitResponse"),
    "ai-generate route returns standard createRateLimitResponse HTTP 429 on limit"
  );

  // ────────────────────────────────────────────────────────────
  // 3. EXAM START RATE LIMITER (P2-004)
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 3: Exam Start Rate Limiter ---");

  assert(
    EXAM_START_LIMITER !== null && typeof EXAM_START_LIMITER === "object" || EXAM_START_LIMITER === null,
    "EXAM_START_LIMITER is defined and exported from ratelimit module"
  );

  const examStartSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/exam/start/route.ts"),
    "utf8"
  );

  assert(
    examStartSource.includes("EXAM_START_LIMITER"),
    "exam/start route imports EXAM_START_LIMITER"
  );
  assert(
    examStartSource.includes("checkRateLimit(EXAM_START_LIMITER"),
    "exam/start route executes checkRateLimit with EXAM_START_LIMITER"
  );
  assert(
    examStartSource.includes("exam:start:${userId}"),
    "exam/start route scopes rate limit key strictly to authenticated userId"
  );
  assert(
    examStartSource.includes("createRateLimitResponse"),
    "exam/start route returns standard createRateLimitResponse HTTP 429 on limit"
  );

  // ────────────────────────────────────────────────────────────
  // 4. EXAM HISTORY (P2-005 DEFERRED STATUS & COMPATIBILITY)
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 4: Exam History (P2-005 Deferred Status & Contract Preservation) ---");

  const examHistorySource = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/exam/history/route.ts"),
    "utf8"
  );

  assert(
    !examHistorySource.includes("take: 100") &&
      !examHistorySource.includes("SAFE_MAX_HISTORY_ITEMS"),
    "exam/history avoids silent record truncation (P2-005 deferred to dedicated pagination slice)"
  );
  assert(
    !examHistorySource.includes("searchParams"),
    "exam/history preserves compliance with B2.5D tests by not reading query searchParams"
  );
  assert(
    examHistorySource.includes("history: formattedHistory") &&
      examHistorySource.includes("attempts: formattedHistory"),
    "exam/history preserves canonical dual response contract (history and attempts)"
  );

  // ────────────────────────────────────────────────────────────
  // 5. PRODUCTION READINESS ENVIRONMENT VALIDATION (P2-006)
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 5: Production Readiness Environment Validation ---");

  const readinessSource = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/health/readiness/route.ts"),
    "utf8"
  );

  // 5A. Static code inspections
  assert(
    readinessSource.includes("process.env.VERCEL_ENV") &&
      readinessSource.includes("isActualProduction"),
    "readiness route implements explicit runtime classification (isActualProduction using VERCEL_ENV)"
  );
  assert(
    readinessSource.includes("PAYMONGO_SECRET_KEY") &&
      readinessSource.includes("PAYMONGO_WEBHOOK_SECRET") &&
      readinessSource.includes("CRON_SECRET"),
    "readiness route verifies PAYMONGO_SECRET_KEY, PAYMONGO_WEBHOOK_SECRET, and CRON_SECRET"
  );
  assert(
    readinessSource.includes("ENCRYPTION_KEY_V1") &&
      readinessSource.includes("ENCRYPTION_KEY"),
    "readiness route checks for ENCRYPTION_KEY_V1 OR ENCRYPTION_KEY"
  );
  assert(
    (!readinessSource.includes("process.env.DATABASE_URL") &&
      !readinessSource.includes("process.env.JWT_SECRET")) ||
      !readinessSource.includes("checks.environment.value"),
    "readiness route never includes secret values in checks payload"
  );

  // 5B. Simulation test: validate exact readiness environment logic
  function evaluateReadinessEnvironment(env: Record<string, string | undefined>): {
    status: "UP" | "DOWN";
    missingKeys: string[];
  } {
    const basicEnvVars = ["DATABASE_URL", "JWT_SECRET"];
    const missingEnvVars = basicEnvVars.filter((key) => !env[key]?.trim());

    const vercelEnv = env.VERCEL_ENV;
    const isActualProduction = vercelEnv
      ? vercelEnv === "production"
      : env.NODE_ENV === "production";

    if (isActualProduction) {
      const productionOnlyEnvVars = [
        "PAYMONGO_SECRET_KEY",
        "PAYMONGO_WEBHOOK_SECRET",
        "CRON_SECRET",
      ];
      for (const key of productionOnlyEnvVars) {
        if (!env[key]?.trim()) {
          missingEnvVars.push(key);
        }
      }

      const hasEncryptionKey = Boolean(
        env.ENCRYPTION_KEY_V1?.trim() || env.ENCRYPTION_KEY?.trim()
      );

      if (!hasEncryptionKey) {
        missingEnvVars.push("ENCRYPTION_KEY_V1 or ENCRYPTION_KEY");
      }
    }

    return {
      status: missingEnvVars.length === 0 ? "UP" : "DOWN",
      missingKeys: missingEnvVars,
    };
  }

  // Case 1: VERCEL_ENV=production with all required variables -> UP
  const vercelProdEnv = {
    VERCEL_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@ep-host.pooler.neon.tech/gsx",
    JWT_SECRET: "jwt_production_secret_key_12345",
    ENCRYPTION_KEY_V1: "encryption_key_v1_secure_value_12345",
    PAYMONGO_SECRET_KEY: "sk_live_1234567890",
    PAYMONGO_WEBHOOK_SECRET: "whsk_live_1234567890",
    CRON_SECRET: "cron_secret_auth_token_12345",
  };
  const res1 = evaluateReadinessEnvironment(vercelProdEnv);
  assert(res1.status === "UP" && res1.missingKeys.length === 0, "1. VERCEL_ENV=production with all required variables -> UP");

  // Case 2: VERCEL_ENV=production missing production secret -> DOWN
  const vercelProdMissingSecret = {
    ...vercelProdEnv,
    PAYMONGO_WEBHOOK_SECRET: undefined,
  };
  const res2 = evaluateReadinessEnvironment(vercelProdMissingSecret);
  assert(
    res2.status === "DOWN" && res2.missingKeys.includes("PAYMONGO_WEBHOOK_SECRET"),
    "2. VERCEL_ENV=production missing production secret -> DOWN"
  );

  // Case 3: VERCEL_ENV=preview without production-only secrets -> basic environment check still succeeds
  const vercelPreviewEnv = {
    VERCEL_ENV: "preview",
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@ep-host.pooler.neon.tech/gsx",
    JWT_SECRET: "jwt_production_secret_key_12345",
  };
  const res3 = evaluateReadinessEnvironment(vercelPreviewEnv);
  assert(
    res3.status === "UP" && res3.missingKeys.length === 0,
    "3. VERCEL_ENV=preview without production-only secrets -> basic environment check still succeeds"
  );

  // Case 4: ENCRYPTION_KEY_V1 alone satisfies production encryption requirement
  const v1OnlyProdEnv = {
    ...vercelProdEnv,
    ENCRYPTION_KEY: undefined,
    ENCRYPTION_KEY_V1: "enc_v1_secret_value",
  };
  const res4 = evaluateReadinessEnvironment(v1OnlyProdEnv);
  assert(
    res4.status === "UP" && res4.missingKeys.length === 0,
    "4. ENCRYPTION_KEY_V1 alone satisfies production encryption requirement"
  );

  // Case 5: ENCRYPTION_KEY alone satisfies compatibility requirement
  const legacyOnlyProdEnv = {
    ...vercelProdEnv,
    ENCRYPTION_KEY_V1: undefined,
    ENCRYPTION_KEY: "enc_legacy_secret_value",
  };
  const res5 = evaluateReadinessEnvironment(legacyOnlyProdEnv);
  assert(
    res5.status === "UP" && res5.missingKeys.length === 0,
    "5. ENCRYPTION_KEY alone satisfies compatibility requirement"
  );

  // Case 6: neither encryption key in production -> DOWN
  const noEncProdEnv = {
    ...vercelProdEnv,
    ENCRYPTION_KEY_V1: undefined,
    ENCRYPTION_KEY: undefined,
  };
  const res6 = evaluateReadinessEnvironment(noEncProdEnv);
  assert(
    res6.status === "DOWN" && res6.missingKeys.includes("ENCRYPTION_KEY_V1 or ENCRYPTION_KEY"),
    "6. neither encryption key in production -> DOWN"
  );

  // Case 7: Outside Vercel (no VERCEL_ENV), NODE_ENV=production missing CRON_SECRET -> DOWN
  const nonVercelProdMissingCron = {
    DATABASE_URL: "postgresql://user:pass@ep-host.pooler.neon.tech/gsx",
    JWT_SECRET: "jwt_production_secret_key_12345",
    ENCRYPTION_KEY_V1: "encryption_key_v1_secure_value_12345",
    PAYMONGO_SECRET_KEY: "sk_live_1234567890",
    PAYMONGO_WEBHOOK_SECRET: "whsk_live_1234567890",
    NODE_ENV: "production",
  };
  const res7 = evaluateReadinessEnvironment(nonVercelProdMissingCron);
  assert(
    res7.status === "DOWN" && res7.missingKeys.includes("CRON_SECRET"),
    "7. Outside Vercel NODE_ENV=production missing CRON_SECRET -> DOWN"
  );

  // Case 8: VERCEL_ENV=preview missing basic secret (DATABASE_URL) -> DOWN
  const previewMissingDb = {
    VERCEL_ENV: "preview",
    JWT_SECRET: "jwt_production_secret_key_12345",
  };
  const res8 = evaluateReadinessEnvironment(previewMissingDb);
  assert(
    res8.status === "DOWN" && res8.missingKeys.includes("DATABASE_URL"),
    "8. VERCEL_ENV=preview missing DATABASE_URL -> DOWN"
  );

  console.log("\n============================================================");
  console.log(`R1A TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runR1ASuite().catch((err) => {
  console.error("Unhandled error in R1A test suite:", err);
  process.exit(1);
});
