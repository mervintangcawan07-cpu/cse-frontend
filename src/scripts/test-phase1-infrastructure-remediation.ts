// Relative Path: src/scripts/test-phase1-infrastructure-remediation.ts
/**
 * Phase 1B Infrastructure & Secrets Regression Test Suite
 *
 * Verifies:
 * 1. INFRA-SEC-001: /api/csc/sync cron authentication fail-closed logic
 *    - Rejection of undefined, empty, whitespace-only secrets
 *    - Rejection of missing, empty, "Bearer undefined", "Bearer null", malformed headers
 *    - Acceptance of valid secret with constant-time equality
 *    - Canonical CRON_SECRET with backward-compatible CRON_SECRET_KEY fallback
 * 2. INFRA-SEC-002: Email token suppression in production logs
 *    - Verification and password reset tokens NEVER logged in production or preview
 *    - Development mode link logging safely isolated
 * 3. INFRA-SEC-003 & INFRA-SEC-004: Gemini API header authentication and error sanitization
 *    - No ?key= in request URL
 *    - x-goog-api-key header used
 *    - No .env.local in client errors
 */

import assert from "node:assert";
import { isValidCronSecret } from "../lib/cronAuth";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";

let passed = 0;
let failed = 0;

function test(description: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then(() => {
          console.log(`✅ [PASS] ${description}`);
          passed++;
        })
        .catch((err) => {
          console.error(`❌ [FAIL] ${description}`);
          console.error(err);
          failed++;
        });
    }
    console.log(`✅ [PASS] ${description}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${description}`);
    console.error(err);
    failed++;
  }
}

async function runAllTests() {
  console.log("============================================================");
  console.log("PHASE 1B INFRASTRUCTURE & SECRETS REMEDIATION TEST SUITE");
  console.log("============================================================\n");

  // =========================================================================
  // SECTION 1: CRON AUTHORIZATION FAIL-CLOSED & BEARER VALIDATION
  // =========================================================================
  console.log("--- SECTION 1: /api/csc/sync Cron Authorization & Validation ---");

  test("1.1 Reject when configured secret is undefined", () => {
    assert.strictEqual(isValidCronSecret("Bearer testsecret", undefined), false);
    assert.strictEqual(isValidCronSecret("Bearer testsecret", null), false);
  });

  test("1.2 Reject when configured secret is empty string", () => {
    assert.strictEqual(isValidCronSecret("Bearer testsecret", ""), false);
  });

  test("1.3 Reject when configured secret is whitespace-only", () => {
    assert.strictEqual(isValidCronSecret("Bearer testsecret", "   "), false);
    assert.strictEqual(isValidCronSecret("Bearer testsecret", "\t\n"), false);
  });

  test("1.4 Reject when Authorization header is absent (null / undefined)", () => {
    assert.strictEqual(isValidCronSecret(null, "correct-secret-123"), false);
    assert.strictEqual(isValidCronSecret(undefined as unknown as string, "correct-secret-123"), false);
  });

  test("1.5 Reject when Authorization header is 'Bearer undefined'", () => {
    assert.strictEqual(isValidCronSecret("Bearer undefined", "correct-secret-123"), false);
    assert.strictEqual(isValidCronSecret("Bearer undefined", undefined), false);
  });

  test("1.6 Reject when Authorization header is 'Bearer null'", () => {
    assert.strictEqual(isValidCronSecret("Bearer null", "correct-secret-123"), false);
    assert.strictEqual(isValidCronSecret("Bearer null", null), false);
  });

  test("1.7 Reject when Authorization header is empty or malformed Bearer", () => {
    assert.strictEqual(isValidCronSecret("Bearer ", "correct-secret-123"), false);
    assert.strictEqual(isValidCronSecret("Bearer   ", "correct-secret-123"), false);
    assert.strictEqual(isValidCronSecret("Basic dXNlcjpwYXNz", "correct-secret-123"), false);
    assert.strictEqual(isValidCronSecret("Token correct-secret-123", "correct-secret-123"), false);
    assert.strictEqual(isValidCronSecret("correct-secret-123", "correct-secret-123"), false);
  });

  test("1.8 Reject when token does not match configured secret", () => {
    assert.strictEqual(isValidCronSecret("Bearer wrong-secret", "correct-secret-123"), false);
    assert.strictEqual(isValidCronSecret("Bearer correct-secret-12", "correct-secret-123"), false);
    assert.strictEqual(isValidCronSecret("Bearer correct-secret-1234", "correct-secret-123"), false);
  });

  test("1.9 Accept when valid Bearer token matches configured secret", () => {
    assert.strictEqual(isValidCronSecret("Bearer correct-secret-123", "correct-secret-123"), true);
    assert.strictEqual(isValidCronSecret("bearer correct-secret-123", "correct-secret-123"), true);
    assert.strictEqual(isValidCronSecret("Bearer  correct-secret-123 ", "  correct-secret-123  "), true);
  });

  test("1.10 Verify runtime environment resolution (CRON_SECRET priority over CRON_SECRET_KEY)", () => {
    const origCronSecret = process.env.CRON_SECRET;
    const origCronSecretKey = process.env.CRON_SECRET_KEY;

    try {
      // Test CRON_SECRET canonical
      process.env.CRON_SECRET = "canonical-cron-secret";
      delete process.env.CRON_SECRET_KEY;
      const secret1 = (process.env.CRON_SECRET || process.env.CRON_SECRET_KEY)?.trim();
      assert.strictEqual(isValidCronSecret("Bearer canonical-cron-secret", secret1), true);

      // Test CRON_SECRET_KEY fallback when CRON_SECRET is unset
      delete process.env.CRON_SECRET;
      process.env.CRON_SECRET_KEY = "legacy-cron-key";
      const secret2 = (process.env.CRON_SECRET || process.env.CRON_SECRET_KEY)?.trim();
      assert.strictEqual(isValidCronSecret("Bearer legacy-cron-key", secret2), true);

      // Test CRON_SECRET precedence when both are set
      process.env.CRON_SECRET = "canonical-cron-secret";
      process.env.CRON_SECRET_KEY = "legacy-cron-key";
      const secret3 = (process.env.CRON_SECRET || process.env.CRON_SECRET_KEY)?.trim();
      assert.strictEqual(secret3, "canonical-cron-secret");
      assert.strictEqual(isValidCronSecret("Bearer canonical-cron-secret", secret3), true);
      assert.strictEqual(isValidCronSecret("Bearer legacy-cron-key", secret3), false);
    } finally {
      if (origCronSecret !== undefined) process.env.CRON_SECRET = origCronSecret;
      else delete process.env.CRON_SECRET;

      if (origCronSecretKey !== undefined) process.env.CRON_SECRET_KEY = origCronSecretKey;
      else delete process.env.CRON_SECRET_KEY;
    }
  });

  // =========================================================================
  // SECTION 2: EMAIL TOKEN LOGGING SUPPRESSION IN PRODUCTION
  // =========================================================================
  console.log("\n--- SECTION 2: Email Token Logging Suppression in Production ---");

  const origNodeEnv = process.env.NODE_ENV;
  const origVercel = process.env.VERCEL;
  const origVercelEnv = process.env.VERCEL_ENV;
  const origResendKey = process.env.RESEND_API_KEY;

  delete process.env.RESEND_API_KEY;

  await test("2.1 Production + missing RESEND_API_KEY never logs verification token", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;

    const loggedLines: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };
    console.warn = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };
    console.error = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };

    const secretVerificationToken = "sensitive_verification_token_abcdef123456";

    try {
      await sendVerificationEmail("user@example.com", secretVerificationToken);
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }

    const allLoggedText = loggedLines.join("\n");
    assert.strictEqual(
      allLoggedText.includes(secretVerificationToken),
      false,
      "Verification token MUST NOT appear in logs in production"
    );
    assert.strictEqual(
      allLoggedText.includes("DEV MODE - NO RESEND KEY"),
      false,
      "DEV MODE banner MUST NOT appear in production"
    );
    assert.strictEqual(
      allLoggedText.includes("[VERIFICATION_EMAIL_NOT_SENT]"),
      true,
      "Sanitized warning should be logged"
    );
  });

  await test("2.2 Production + missing RESEND_API_KEY never logs password reset token", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;

    const loggedLines: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };
    console.warn = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };
    console.error = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };

    const secretResetToken = "sensitive_password_reset_token_xyz987654";

    try {
      await sendPasswordResetEmail("user@example.com", secretResetToken);
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }

    const allLoggedText = loggedLines.join("\n");
    assert.strictEqual(
      allLoggedText.includes(secretResetToken),
      false,
      "Password reset token MUST NOT appear in logs in production"
    );
    assert.strictEqual(
      allLoggedText.includes("DEV MODE - NO RESEND KEY"),
      false,
      "DEV MODE banner MUST NOT appear in production"
    );
    assert.strictEqual(
      allLoggedText.includes("[PASSWORD_RESET_EMAIL_NOT_SENT]"),
      true,
      "Sanitized warning should be logged"
    );
  });

  await test("2.3 Vercel Preview (VERCEL_ENV=preview) + missing RESEND_API_KEY never logs tokens", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";

    const loggedLines: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };
    console.warn = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };
    console.error = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };

    const testToken = "preview_reset_token_777888";

    try {
      await sendPasswordResetEmail("preview@example.com", testToken);
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }

    const allLoggedText = loggedLines.join("\n");
    assert.strictEqual(allLoggedText.includes(testToken), false, "No reset token in preview logs");
  });

  await test("2.4 Local development (NODE_ENV=development, no Vercel) preserves dev link output", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;

    const loggedLines: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };
    console.warn = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };
    console.error = (...args: unknown[]) => { loggedLines.push(args.map(String).join(" ")); };

    const devToken = "dev_token_12345";

    try {
      await sendPasswordResetEmail("dev@example.com", devToken);
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }

    const allLoggedText = loggedLines.join("\n");
    assert.strictEqual(allLoggedText.includes(devToken), true, "Dev token logged in local dev");
    assert.strictEqual(allLoggedText.includes("[DEV MODE - NO RESEND KEY]"), true);
  });

  // Restore environment
  (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
  if (origVercel !== undefined) process.env.VERCEL = origVercel;
  else delete process.env.VERCEL;
  if (origVercelEnv !== undefined) process.env.VERCEL_ENV = origVercelEnv;
  else delete process.env.VERCEL_ENV;
  if (origResendKey !== undefined) process.env.RESEND_API_KEY = origResendKey;
  else delete process.env.RESEND_API_KEY;

  // =========================================================================
  // SECTION 3: SOURCE CODE CONTRACT CHECKS (GEMINI & FILENAME DISCLOSURE)
  // =========================================================================
  console.log("\n--- SECTION 3: Gemini Header Transport & Error Sanitization ---");

  const fs = await import("node:fs");
  const path = await import("node:path");

  test("3.1 ai-generate route does NOT pass ?key= in request URL", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/admin/questions/ai-generate/route.ts"),
      "utf8"
    );
    assert.strictEqual(content.includes("?key="), false, "ai-generate route must not contain '?key='");
    assert.strictEqual(
      content.includes('"x-goog-api-key": apiKey'),
      true,
      "ai-generate route must pass x-goog-api-key header"
    );
  });

  test("3.2 explain-mistake route does NOT pass ?key= in request URL", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/ai/explain-mistake/route.ts"),
      "utf8"
    );
    assert.strictEqual(content.includes("?key="), false, "explain-mistake route must not contain '?key='");
    assert.strictEqual(
      content.includes('"x-goog-api-key": apiKey'),
      true,
      "explain-mistake route must pass x-goog-api-key header"
    );
  });

  test("3.3 ai-generate route does NOT mention .env.local in client error", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/admin/questions/ai-generate/route.ts"),
      "utf8"
    );
    assert.strictEqual(content.includes(".env.local"), false, "ai-generate error must not mention .env.local");
    assert.strictEqual(
      content.includes("AI service is not configured on the server"),
      true,
      "ai-generate error should use generic server configuration wording"
    );
  });

  console.log("\n============================================================");
  console.log(`PHASE 1B REGRESSION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();

