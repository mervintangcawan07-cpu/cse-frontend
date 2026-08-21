// Relative Path: src/scripts/test-resend-config.ts
import { getFromEmail, getReplyToEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/config/site";

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

async function runTests() {
  console.log("============================================================");
  console.log("RESEND CONFIGURATION & GOVSTUDYX SENDER VERIFICATION TEST");
  console.log("============================================================");

  try {
    // TEST 1: Default getFromEmail()
    console.log("\n--- TEST 1: getFromEmail() Resolution ---");
    const prevFrom = process.env.EMAIL_FROM;
    delete process.env.EMAIL_FROM;
    const defaultFrom = getFromEmail();
    console.log(`Default from: "${defaultFrom}"`);
    assert(
      defaultFrom === "GovStudyX <noreply@govstudyx.com>",
      "Default EMAIL_FROM is 'GovStudyX <noreply@govstudyx.com>'"
    );

    // With explicit EMAIL_FROM
    process.env.EMAIL_FROM = '"GovStudyX Official" <noreply@govstudyx.com>';
    const customFrom = getFromEmail();
    console.log(`Sanitized custom from: "${customFrom}"`);
    assert(
      customFrom === "GovStudyX Official <noreply@govstudyx.com>",
      "Quotes are safely stripped from EMAIL_FROM"
    );
    if (prevFrom) process.env.EMAIL_FROM = prevFrom;
    else delete process.env.EMAIL_FROM;

    // TEST 2: Default getReplyToEmail()
    console.log("\n--- TEST 2: getReplyToEmail() Resolution ---");
    const prevReplyTo = process.env.EMAIL_REPLY_TO;
    delete process.env.EMAIL_REPLY_TO;
    const defaultReplyTo = getReplyToEmail();
    console.log(`Default replyTo: "${defaultReplyTo}"`);
    assert(
      defaultReplyTo === "govstudyx@gmail.com",
      "Default EMAIL_REPLY_TO is 'govstudyx@gmail.com'"
    );

    // With explicit EMAIL_REPLY_TO
    process.env.EMAIL_REPLY_TO = '"support@govstudyx.com"';
    const customReplyTo = getReplyToEmail();
    console.log(`Sanitized custom replyTo: "${customReplyTo}"`);
    assert(
      customReplyTo === "support@govstudyx.com",
      "Quotes are safely stripped from EMAIL_REPLY_TO"
    );
    if (prevReplyTo) process.env.EMAIL_REPLY_TO = prevReplyTo;
    else delete process.env.EMAIL_REPLY_TO;

    // TEST 3: Email Link URLs in Production
    console.log("\n--- TEST 3: Email Link URL Production Resolution ---");
    const prevEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    const prodBaseUrl = getSiteUrl();
    console.log(`Production Base URL: "${prodBaseUrl}"`);
    assert(
      prodBaseUrl === "https://govstudyx.com",
      "Canonical URL resolves to 'https://govstudyx.com' in production"
    );

    const verifyLink = `${prodBaseUrl}/verify-email?token=testtoken123`;
    const resetLink = `${prodBaseUrl}/reset-password?token=testtoken123`;
    const setupLink = `${prodBaseUrl}/partner-portal/setup?token=testtoken123`;
    const partnerResetLink = `${prodBaseUrl}/partner-portal/reset-password?token=testtoken123`;

    assert(verifyLink.startsWith("https://govstudyx.com/verify-email"), "Verification link uses govstudyx.com");
    assert(resetLink.startsWith("https://govstudyx.com/reset-password"), "Password reset link uses govstudyx.com");
    assert(setupLink.startsWith("https://govstudyx.com/partner-portal/setup"), "Partner setup link uses govstudyx.com");
    assert(partnerResetLink.startsWith("https://govstudyx.com/partner-portal/reset-password"), "Partner reset link uses govstudyx.com");

    (process.env as any).NODE_ENV = prevEnv;

  } catch (err) {
    console.error("❌ Unexpected test error:", err);
    failed++;
  }

  console.log("\n============================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
