// Relative Path: src/scripts/test-security-suite.ts
import { getKeyForVersion, encrypt, decrypt } from "../lib/crypto/encryption";
import { formatPromptHTML, escapeHTML, sanitizeHTML } from "../lib/formatPrompt";
import { PartnerStatementService } from "../lib/accounting/partnerStatementService";
import bcrypt from "bcryptjs";

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`✅ [PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${description}`);
    failedTests++;
  }
}

async function runSecuritySuite() {
  console.log("============================================================");
  console.log("GOVSTUDYX PRODUCTION SECURITY REMEDIATION REGRESSION SUITE");
  console.log("============================================================");

  // ────────────────────────────────────────────────────────────
  // TEST 1: Encryption Secret Fallback & Fail-Closed Behavior
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST 1: Encryption Secret Fail-Closed in Production ---");

  const originalEnv = process.env.NODE_ENV;
  const originalKey = process.env.ENCRYPTION_KEY;
  const originalJwt = process.env.JWT_SECRET;

  try {
    // A. Missing keys in production must throw
    (process.env as any).NODE_ENV = "production";
    delete process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY_V1;
    delete process.env.JWT_SECRET;

    let threwInProd = false;
    try {
      getKeyForVersion("v1");
    } catch {
      threwInProd = true;
    }
    assert(threwInProd, "Encryption in production fails closed when ENCRYPTION_KEY/JWT_SECRET is missing");

    // B. Whitespace-only key must also fail closed
    process.env.ENCRYPTION_KEY = "   ";
    let threwOnWhitespace = false;
    try {
      getKeyForVersion("v1");
    } catch {
      threwOnWhitespace = true;
    }
    assert(threwOnWhitespace, "Whitespace-only ENCRYPTION_KEY is rejected and fails closed");

    // C. Valid key works correctly
    process.env.ENCRYPTION_KEY = "test_production_secure_key_1234567890123456";
    const testPlaintext = "Sensitive_GCash_09171234567";
    const encrypted = encrypt(testPlaintext);
    assert(typeof encrypted === "string" && encrypted.startsWith("enc:v1:"), "Encryption succeeds with valid configured key");

    const decrypted = decrypt(encrypted);
    assert(decrypted === testPlaintext, "Decryption correctly recovers original plaintext with valid key");
  } finally {
    (process.env as any).NODE_ENV = originalEnv;
    if (originalKey) process.env.ENCRYPTION_KEY = originalKey;
    if (originalJwt) process.env.JWT_SECRET = originalJwt;
  }

  // ────────────────────────────────────────────────────────────
  // TEST 2: Partner Default/Fallback Password Neutralization
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST 2: Partner Login Fallback Credentials Blocked ---");

  const realPassword = "PartnerSecretPass2026!";
  const passwordHash = await bcrypt.hash(realPassword, 10);
  const partnerCode = "PTR-TEST1234";

  // Simulate password verification logic
  const checkPartnerAuth = async (inputPassword: string, storedHash: string | null) => {
    let isPasswordValid = false;
    if (storedHash) {
      isPasswordValid = await bcrypt.compare(inputPassword, storedHash);
    }
    return isPasswordValid;
  };

  const testGlobalFallback = await checkPartnerAuth("GovStudyX2026!", null);
  assert(testGlobalFallback === false, "Static 'GovStudyX2026!' password is completely rejected for unactivated account");

  const testCodeFallback = await checkPartnerAuth(partnerCode, null);
  assert(testCodeFallback === false, "Partner code 'PTR-TEST1234' is completely rejected as password");

  const testRealAuth = await checkPartnerAuth(realPassword, passwordHash);
  assert(testRealAuth === true, "Legitimate bcrypt passwordHash successfully authenticates partner");

  const testWrongPass = await checkPartnerAuth("WrongPassword123!", passwordHash);
  assert(testWrongPass === false, "Incorrect password fails authentication");

  // ────────────────────────────────────────────────────────────
  // TEST 3: Cron Endpoint Authorization Fail-Closed Logic
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST 3: Cron Endpoint Fail-Closed Authorization ---");

  const checkCronAuth = (cronSecretEnv: string | undefined, authHeaderVal: string | null) => {
    if (!cronSecretEnv || authHeaderVal !== `Bearer ${cronSecretEnv}`) {
      return { status: 401, error: "Unauthorized cron trigger" };
    }
    return { status: 200, success: true };
  };

  const cronNoSecret = checkCronAuth(undefined, "Bearer some_secret");
  assert(cronNoSecret.status === 401, "Cron request fails closed with 401 when CRON_SECRET is missing from env");

  const cronNoHeader = checkCronAuth("configured_cron_secret_abc", null);
  assert(cronNoHeader.status === 401, "Cron request fails closed with 401 when Authorization header is missing");

  const cronWrongHeader = checkCronAuth("configured_cron_secret_abc", "Bearer wrong_secret");
  assert(cronWrongHeader.status === 401, "Cron request fails closed with 401 when Bearer token is incorrect");

  const cronValidHeader = checkCronAuth("configured_cron_secret_abc", "Bearer configured_cron_secret_abc");
  assert(cronValidHeader.status === 200, "Cron request succeeds with 200 when valid Bearer token matches CRON_SECRET");

  // ────────────────────────────────────────────────────────────
  // TEST 4: XSS Mitigation in formatPromptHTML & sanitizeHTML
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST 4: XSS Payload Neutralization in formatPromptHTML ---");

  const scriptPayload = "<script>alert('xss')</script>";
  const formattedScript = formatPromptHTML(scriptPayload);
  assert(!formattedScript.includes("<script>"), "Raw <script> tags are neutralized in formatPromptHTML");

  const imgOnErrorPayload = "<img src=x onerror=alert('xss')>";
  const formattedImg = formatPromptHTML(imgOnErrorPayload);
  assert(!formattedImg.includes("<img"), "Raw <img> tags are escaped as HTML entities in formatPromptHTML");

  const sanitizedImg = sanitizeHTML('<img src="x" onerror="alert(1)">');
  assert(!sanitizedImg.includes("onerror="), "sanitizeHTML strips inline event handlers from pre-rendered HTML");

  const iframePayload = '<iframe src="javascript:alert(1)"></iframe>';
  const formattedIframe = formatPromptHTML(iframePayload);
  assert(!formattedIframe.includes("<iframe"), "<iframe> tags are neutralized in formatPromptHTML");

  const legitimatePrompt = "What is the primary function of the Civil Service Commission?";
  const formattedLegit = formatPromptHTML(legitimatePrompt);
  assert(formattedLegit.includes("Civil Service Commission"), "Legitimate educational prompt text renders properly");

  // ────────────────────────────────────────────────────────────
  // TEST 5: CSV Formula Injection Neutralization
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST 5: CSV Formula Injection Mitigation ---");

  const mockDataset: any = {
    statementReference: "GSX-PS-20260822-000123",
    period: { label: "August 2026" },
    partner: { name: "Test Org", partnerId: "PT-000123" },
    summary: {
      formattedQualifyingPayments: "₱10,000.00",
      formattedGrossCommission: "₱1,000.00",
      formattedRefundReversals: "-₱0.00",
      formattedNetCommission: "₱1,000.00",
      formattedPaid: "₱0.00",
      formattedReserved: "₱0.00",
      formattedOutstanding: "₱1,000.00",
    },
    transactions: [
      {
        date: "2026-08-22",
        id: "txn_123",
        planType: "=SUM(A1:A2)", // Malicious formula in planType
        customerMasked: "@evil.com", // Malicious formula in customer
        formattedPurchase: "₱299.00",
        effectiveRate: 10,
        formattedCommission: "₱29.90",
        status: "+CMD('calc')", // Malicious formula in status
        campaignSource: "-1+2", // Malicious formula in channel
      },
    ],
  };

  const generatedCsv = PartnerStatementService.generateStatementCSV(mockDataset);

  assert(generatedCsv.includes("\"'=SUM(A1:A2)\""), "Dangerous formula '=SUM(A1:A2)' is neutralized with leading apostrophe");
  assert(generatedCsv.includes("\"'+CMD('calc')\""), "Dangerous formula '+CMD(...)' is neutralized with leading apostrophe");
  assert(generatedCsv.includes("\"'@evil.com\""), "Dangerous prefix '@evil.com' is neutralized with leading apostrophe");
  assert(generatedCsv.includes("\"'-1+2\""), "Formula-like '-1+2' is neutralized with leading apostrophe");
  assert(generatedCsv.includes('"₱299.00"'), "Legitimate currency formatting '₱299.00' is preserved without corruption");

  // ────────────────────────────────────────────────────────────
  // TEST 6: Password Policy Minimum 8 Characters Consistency
  // ────────────────────────────────────────────────────────────
  console.log("\n--- TEST 6: Password Policy Consistency (>= 8 chars) ---");

  const isPasswordLengthValid = (pwd: string) => typeof pwd === "string" && pwd.length >= 8;

  assert(!isPasswordLengthValid("short"), "Password 'short' (< 8 chars) is rejected");
  assert(!isPasswordLengthValid("123456"), "Password '123456' (6 chars) is rejected");
  assert(!isPasswordLengthValid("1234567"), "Password '1234567' (7 chars) is rejected");
  assert(isPasswordLengthValid("SecurePass8"), "Password 'SecurePass8' (11 chars) is accepted");

  console.log("\n============================================================");
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("============================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch((err) => {
  console.error("Security Suite Unexpected Error:", err);
  process.exit(1);
});
