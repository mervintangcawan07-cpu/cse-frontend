// Relative Path: src/scripts/test-entitlement-1e5a-lapse-resume.ts
import assert from "assert";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  signExamAttemptToken,
  verifyExamAttemptToken,
} from "../lib/examAttemptToken";
import {
  signGuidedReviewToken,
  verifyGuidedReviewToken,
} from "../lib/guidedReviewToken";

/**
 * Advisory Client-Side JWT Expiration Parser (Test Reference Implementation)
 * Mirrors verbatim the function in src/app/mock-exam/take/page.tsx
 */
function parseJwtAdvisoryExp(token: string): number | null {
  if (typeof token !== "string" || !token.trim()) return null;
  try {
    const parts = token.trim().split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    if (!base64Url || typeof base64Url !== "string") return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const jsonStr =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");
    const payload = JSON.parse(jsonStr);
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.exp !== "number" || !Number.isInteger(payload.exp)) return null;
    return payload.exp;
  } catch {
    return null;
  }
}

/**
 * Resume Grace Eligibility Evaluator (Test Reference Implementation)
 * Mirrors verbatim the function in src/app/mock-exam/take/page.tsx
 */
function isResumeGraceEligible(
  sessionInput: unknown,
  nowUnix = Math.floor(Date.now() / 1000)
): boolean {
  if (!sessionInput) return false;
  let parsed: any;
  if (typeof sessionInput === "string") {
    try {
      parsed = JSON.parse(sessionInput);
    } catch {
      return false;
    }
  } else if (typeof sessionInput === "object") {
    parsed = sessionInput;
  } else {
    return false;
  }

  if (!parsed || typeof parsed !== "object") return false;
  if (!Array.isArray(parsed.examQuestions) || parsed.examQuestions.length === 0) return false;

  // Strict examMode recognition: explicit GUIDED_REVIEW, explicit SIMULATION, or legitimate legacy omission
  let mode: "GUIDED_REVIEW" | "SIMULATION";
  if (parsed.examMode === "GUIDED_REVIEW") {
    mode = "GUIDED_REVIEW";
  } else if (
    parsed.examMode === "SIMULATION" ||
    parsed.examMode === undefined ||
    parsed.examMode === null
  ) {
    mode = "SIMULATION";
  } else {
    return false;
  }

  // Safe questions required for BOTH modes: scan ALL TEN sensitive fields
  const hasLegacyAnswers = parsed.examQuestions.some(
    (q: any) =>
      q.answerIndex !== undefined ||
      q.explanation !== undefined ||
      q.stepByStep !== undefined ||
      q.whyA !== undefined ||
      q.whyB !== undefined ||
      q.whyC !== undefined ||
      q.whyD !== undefined ||
      q.eliminationStrategy !== undefined ||
      q.commonTrap !== undefined ||
      q.examTip !== undefined
  );
  if (hasLegacyAnswers) return false;

  if (mode === "GUIDED_REVIEW") {
    // 1. Must possess a non-empty guidedReviewToken
    if (typeof parsed.guidedReviewToken !== "string" || !parsed.guidedReviewToken.trim()) {
      return false;
    }
    // 2. Cross-mode attemptToken must strictly be null or undefined
    if (parsed.attemptToken !== undefined && parsed.attemptToken !== null) {
      return false;
    }
    // 3. Advisory expiry check on guidedReviewToken
    const exp = parseJwtAdvisoryExp(parsed.guidedReviewToken);
    if (exp === null || exp <= nowUnix) return false;

    return true;
  } else {
    // SIMULATION
    // 1. Must possess a non-empty attemptToken
    if (typeof parsed.attemptToken !== "string" || !parsed.attemptToken.trim()) {
      return false;
    }
    // 2. Cross-mode guidedReviewToken must strictly be null or undefined
    if (parsed.guidedReviewToken !== undefined && parsed.guidedReviewToken !== null) {
      return false;
    }
    // 3. Advisory expiry check on attemptToken
    const exp = parseJwtAdvisoryExp(parsed.attemptToken);
    if (exp === null || exp <= nowUnix) return false;

    return true;
  }
}

console.log("============================================================");
console.log("RUNNING ENTITLEMENT-1E5A IN-FLIGHT RESUME GRACE TESTS");
console.log("============================================================");

// Set test secret unconditionally before running tests
process.env.JWT_SECRET = "test_govstudyx_secret_for_regression_testing_only_do_not_use_in_prod";

let passed = 0;
let total = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passed++;
    console.log(`✔ [${total}] ${name}`);
  } catch (err) {
    console.error(`✖ [${total}] ${name}`);
    console.error(err);
    throw err;
  }
}

async function main() {
  const rootDir = process.cwd();
  const takePagePath = path.join(rootDir, "src/app/mock-exam/take/page.tsx");
  const takePageSource = fs.readFileSync(takePagePath, "utf8").replace(/\r\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const futureExp = now + 3600; // 1 hour in future
  const pastExp = now - 3600;   // 1 hour in past

  function makeJwtWithPayload(payload: Record<string, unknown>): string {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = "dummy_signature";
    return `${header}.${body}.${sig}`;
  }

  const validSimToken = makeJwtWithPayload({ exp: futureExp, sub: "user-123" });
  const expiredSimToken = makeJwtWithPayload({ exp: pastExp, sub: "user-123" });
  const exactNowSimToken = makeJwtWithPayload({ exp: now, sub: "user-123" });

  const validGuidedToken = makeJwtWithPayload({ exp: futureExp, sub: "user-456" });
  const expiredGuidedToken = makeJwtWithPayload({ exp: pastExp, sub: "user-456" });
  const exactNowGuidedToken = makeJwtWithPayload({ exp: now, sub: "user-456" });

  const safeExamQuestions = [
    { id: "q1", category: "Math", prompt: "2+2?", options: ["3", "4"] },
    { id: "q2", category: "Logic", prompt: "All A are B", options: ["True", "False"] },
  ];

  const allTenSensitiveFields = [
    "answerIndex",
    "explanation",
    "stepByStep",
    "whyA",
    "whyB",
    "whyC",
    "whyD",
    "eliminationStrategy",
    "commonTrap",
    "examTip",
  ];

  // ─────────────────────────────────────────────────────────────
  // GROUP A: ADVISORY JWT EXPIRATION PARSER (TESTS 1 - 11)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group A: Advisory JWT Expiration Parser (parseJwtAdvisoryExp) ---");

  await runTest("Test 1: parseJwtAdvisoryExp extracts valid integer exp from standard JWT", () => {
    const token = makeJwtWithPayload({ exp: futureExp, sub: "user-123" });
    const parsedExp = parseJwtAdvisoryExp(token);
    assert.strictEqual(parsedExp, futureExp);
  });

  await runTest("Test 2: parseJwtAdvisoryExp returns null for empty string or whitespace", () => {
    assert.strictEqual(parseJwtAdvisoryExp(""), null);
    assert.strictEqual(parseJwtAdvisoryExp("   "), null);
    assert.strictEqual(parseJwtAdvisoryExp("\t\n"), null);
  });

  await runTest("Test 3: parseJwtAdvisoryExp returns null for token with fewer than 3 parts", () => {
    assert.strictEqual(parseJwtAdvisoryExp("onlyonepart"), null);
    assert.strictEqual(parseJwtAdvisoryExp("header.body"), null);
  });

  await runTest("Test 4: parseJwtAdvisoryExp returns null for token with more than 3 parts", () => {
    assert.strictEqual(parseJwtAdvisoryExp("a.b.c.d"), null);
  });

  await runTest("Test 5: parseJwtAdvisoryExp returns null when payload is not valid JSON", () => {
    const invalidBody = Buffer.from("this is not json { [").toString("base64url");
    const token = `header.${invalidBody}.sig`;
    assert.strictEqual(parseJwtAdvisoryExp(token), null);
  });

  await runTest("Test 6: parseJwtAdvisoryExp returns null when payload has no exp property", () => {
    const token = makeJwtWithPayload({ sub: "user-123", mode: "FULL_MOCK" });
    assert.strictEqual(parseJwtAdvisoryExp(token), null);
  });

  await runTest("Test 7: parseJwtAdvisoryExp returns null when exp is not a number", () => {
    assert.strictEqual(parseJwtAdvisoryExp(makeJwtWithPayload({ exp: "1726000000" })), null);
    assert.strictEqual(parseJwtAdvisoryExp(makeJwtWithPayload({ exp: true })), null);
    assert.strictEqual(parseJwtAdvisoryExp(makeJwtWithPayload({ exp: null })), null);
    assert.strictEqual(parseJwtAdvisoryExp(makeJwtWithPayload({ exp: {} })), null);
  });

  await runTest("Test 8: parseJwtAdvisoryExp returns null when exp is a float", () => {
    assert.strictEqual(parseJwtAdvisoryExp(makeJwtWithPayload({ exp: 1726000000.5 })), null);
  });

  await runTest("Test 9: parseJwtAdvisoryExp handles base64 with URL-safe chars (- and _)", () => {
    const payload = { exp: futureExp, data: "???>>>___---" };
    const token = makeJwtWithPayload(payload);
    assert.strictEqual(parseJwtAdvisoryExp(token), futureExp);
  });

  await runTest("Test 10: parseJwtAdvisoryExp extracts correct exp from actual signExamAttemptToken JWT", async () => {
    const result = await signExamAttemptToken({
      userId: "user-test-1",
      examType: "FULL_MOCK",
      questionIds: ["q1"],
    });
    const parsedExp = parseJwtAdvisoryExp(result.attemptToken);
    assert.ok(typeof parsedExp === "number" && parsedExp > now);
    assert.ok(parsedExp >= now + 23 * 3600);
  });

  await runTest("Test 11: parseJwtAdvisoryExp extracts correct exp from actual signGuidedReviewToken JWT", async () => {
    const result = await signGuidedReviewToken({
      userId: "user-test-2",
      questionIds: ["q2"],
    });
    const parsedExp = parseJwtAdvisoryExp(result.guidedReviewToken);
    assert.ok(typeof parsedExp === "number" && parsedExp > now);
    assert.ok(parsedExp >= now + 23 * 3600);
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP B: STRICT EXAM MODE RECOGNITION (TESTS 12 - 22)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group B: Strict Exam Mode Recognition ---");

  await runTest("Test 12: Explicit examMode === 'SIMULATION' is accepted", () => {
    const session = {
      examMode: "SIMULATION",
      attemptToken: validSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), true);
  });

  await runTest("Test 13: Explicit examMode === 'GUIDED_REVIEW' is accepted", () => {
    const session = {
      examMode: "GUIDED_REVIEW",
      guidedReviewToken: validGuidedToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), true);
  });

  await runTest("Test 14: Missing examMode (undefined) preserves legacy SIMULATION compatibility", () => {
    const session = {
      attemptToken: validSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), true);
  });

  await runTest("Test 15: examMode === null preserves legacy SIMULATION compatibility", () => {
    const session = {
      examMode: null,
      attemptToken: validSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), true);
  });

  await runTest("Test 16: Empty string examMode ('') fails eligibility", () => {
    const session = {
      examMode: "",
      attemptToken: validSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 17: 'INVALID' examMode fails eligibility", () => {
    const session = {
      examMode: "INVALID",
      attemptToken: validSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 18: 'CUSTOM_PRACTICE' examMode fails Standard Mock resume eligibility", () => {
    const session = {
      examMode: "CUSTOM_PRACTICE",
      attemptToken: validSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 19: 'SIM' truncated examMode fails eligibility", () => {
    const session = {
      examMode: "SIM",
      attemptToken: validSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 20: Numeric examMode (123, 0) fails eligibility", () => {
    assert.strictEqual(
      isResumeGraceEligible({ examMode: 123, attemptToken: validSimToken, examQuestions: safeExamQuestions }, now),
      false
    );
    assert.strictEqual(
      isResumeGraceEligible({ examMode: 0, attemptToken: validSimToken, examQuestions: safeExamQuestions }, now),
      false
    );
  });

  await runTest("Test 21: Boolean examMode (true, false) fails eligibility", () => {
    assert.strictEqual(
      isResumeGraceEligible({ examMode: true, attemptToken: validSimToken, examQuestions: safeExamQuestions }, now),
      false
    );
    assert.strictEqual(
      isResumeGraceEligible({ examMode: false, attemptToken: validSimToken, examQuestions: safeExamQuestions }, now),
      false
    );
  });

  await runTest("Test 22: Object/Array examMode ({}, []) fails eligibility", () => {
    assert.strictEqual(
      isResumeGraceEligible({ examMode: {}, attemptToken: validSimToken, examQuestions: safeExamQuestions }, now),
      false
    );
    assert.strictEqual(
      isResumeGraceEligible({ examMode: [], attemptToken: validSimToken, examQuestions: safeExamQuestions }, now),
      false
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP C: SAFE QUESTIONS ENFORCEMENT ON BOTH MODES (TESTS 23 - 42)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group C: Safe Questions Enforcement (Both Modes) ---");

  for (const field of allTenSensitiveFields) {
    await runTest(`Test Simulation rejects field '${field}' in examQuestions`, () => {
      const taintedQuestions = [
        { id: "q1", category: "Math", prompt: "2+2?", options: ["3", "4"], [field]: field === "answerIndex" ? 1 : "sensitive" },
      ];
      const session = {
        examMode: "SIMULATION",
        attemptToken: validSimToken,
        examQuestions: taintedQuestions,
      };
      assert.strictEqual(isResumeGraceEligible(session, now), false);
    });
  }

  for (const field of allTenSensitiveFields) {
    await runTest(`Test Guided Review rejects field '${field}' in examQuestions`, () => {
      const taintedQuestions = [
        { id: "q1", category: "Math", prompt: "2+2?", options: ["3", "4"], [field]: field === "answerIndex" ? 1 : "sensitive" },
      ];
      const session = {
        examMode: "GUIDED_REVIEW",
        guidedReviewToken: validGuidedToken,
        examQuestions: taintedQuestions,
      };
      assert.strictEqual(isResumeGraceEligible(session, now), false);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // GROUP D: TOKEN REQUIREMENT, CROSS-CONTAMINATION & EXPIRY (TESTS 43 - 54)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group D: Token Requirements, Cross-Contamination & Expiry ---");

  await runTest("Test 43: Simulation requires non-empty attemptToken", () => {
    assert.strictEqual(isResumeGraceEligible({ examMode: "SIMULATION", examQuestions: safeExamQuestions }, now), false);
    assert.strictEqual(isResumeGraceEligible({ examMode: "SIMULATION", attemptToken: "", examQuestions: safeExamQuestions }, now), false);
    assert.strictEqual(isResumeGraceEligible({ examMode: "SIMULATION", attemptToken: "   ", examQuestions: safeExamQuestions }, now), false);
  });

  await runTest("Test 44: Guided Review requires non-empty guidedReviewToken", () => {
    assert.strictEqual(isResumeGraceEligible({ examMode: "GUIDED_REVIEW", examQuestions: safeExamQuestions }, now), false);
    assert.strictEqual(isResumeGraceEligible({ examMode: "GUIDED_REVIEW", guidedReviewToken: "", examQuestions: safeExamQuestions }, now), false);
    assert.strictEqual(isResumeGraceEligible({ examMode: "GUIDED_REVIEW", guidedReviewToken: "   ", examQuestions: safeExamQuestions }, now), false);
  });

  await runTest("Test 45: Simulation with cross-mode guidedReviewToken fails (non-empty string)", () => {
    const session = {
      examMode: "SIMULATION",
      attemptToken: validSimToken,
      guidedReviewToken: "some-guided-token",
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 45b: Simulation strictly requires guidedReviewToken to be null or undefined", () => {
    const invalidShapes = ["", "   ", "\t", 123, 0, true, false, {}, []];
    for (const val of invalidShapes) {
      const session = {
        examMode: "SIMULATION",
        attemptToken: validSimToken,
        guidedReviewToken: val,
        examQuestions: safeExamQuestions,
      };
      assert.strictEqual(
        isResumeGraceEligible(session, now),
        false,
        `Simulation must reject guidedReviewToken shape: ${JSON.stringify(val)}`
      );
    }
    // null and undefined must pass
    assert.strictEqual(
      isResumeGraceEligible(
        { examMode: "SIMULATION", attemptToken: validSimToken, guidedReviewToken: null, examQuestions: safeExamQuestions },
        now
      ),
      true
    );
    assert.strictEqual(
      isResumeGraceEligible(
        { examMode: "SIMULATION", attemptToken: validSimToken, guidedReviewToken: undefined, examQuestions: safeExamQuestions },
        now
      ),
      true
    );
  });

  await runTest("Test 46: Guided Review with cross-mode attemptToken fails (non-empty string)", () => {
    const session = {
      examMode: "GUIDED_REVIEW",
      guidedReviewToken: validGuidedToken,
      attemptToken: "some-attempt-token",
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 46b: Guided Review strictly requires attemptToken to be null or undefined", () => {
    const invalidShapes = ["", "   ", "\t", 123, 0, true, false, {}, []];
    for (const val of invalidShapes) {
      const session = {
        examMode: "GUIDED_REVIEW",
        guidedReviewToken: validGuidedToken,
        attemptToken: val,
        examQuestions: safeExamQuestions,
      };
      assert.strictEqual(
        isResumeGraceEligible(session, now),
        false,
        `Guided Review must reject attemptToken shape: ${JSON.stringify(val)}`
      );
    }
    // null and undefined must pass
    assert.strictEqual(
      isResumeGraceEligible(
        { examMode: "GUIDED_REVIEW", guidedReviewToken: validGuidedToken, attemptToken: null, examQuestions: safeExamQuestions },
        now
      ),
      true
    );
    assert.strictEqual(
      isResumeGraceEligible(
        { examMode: "GUIDED_REVIEW", guidedReviewToken: validGuidedToken, attemptToken: undefined, examQuestions: safeExamQuestions },
        now
      ),
      true
    );
  });

  await runTest("Test 47: Simulation with expired attemptToken (exp < now) fails", () => {
    const session = {
      examMode: "SIMULATION",
      attemptToken: expiredSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 48: Simulation with attemptToken expiring exactly now (exp === now) fails", () => {
    const session = {
      examMode: "SIMULATION",
      attemptToken: exactNowSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 49: Guided Review with expired guidedReviewToken (exp < now) fails", () => {
    const session = {
      examMode: "GUIDED_REVIEW",
      guidedReviewToken: expiredGuidedToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 50: Guided Review with guidedReviewToken expiring exactly now (exp === now) fails", () => {
    const session = {
      examMode: "GUIDED_REVIEW",
      guidedReviewToken: exactNowGuidedToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(session, now), false);
  });

  await runTest("Test 51: Malformed JWT tokens fail for both modes", () => {
    assert.strictEqual(
      isResumeGraceEligible({ examMode: "SIMULATION", attemptToken: "malformed.jwt", examQuestions: safeExamQuestions }, now),
      false
    );
    assert.strictEqual(
      isResumeGraceEligible({ examMode: "GUIDED_REVIEW", guidedReviewToken: "malformed.jwt", examQuestions: safeExamQuestions }, now),
      false
    );
  });

  await runTest("Test 52: Empty or non-array examQuestions fails", () => {
    assert.strictEqual(
      isResumeGraceEligible({ examMode: "SIMULATION", attemptToken: validSimToken, examQuestions: [] }, now),
      false
    );
    assert.strictEqual(
      isResumeGraceEligible({ examMode: "SIMULATION", attemptToken: validSimToken, examQuestions: "not-array" }, now),
      false
    );
  });

  await runTest("Test 53: Future exp passes advisory expiry for both modes", () => {
    assert.strictEqual(
      isResumeGraceEligible({ examMode: "SIMULATION", attemptToken: validSimToken, examQuestions: safeExamQuestions }, now),
      true
    );
    assert.strictEqual(
      isResumeGraceEligible({ examMode: "GUIDED_REVIEW", guidedReviewToken: validGuidedToken, examQuestions: safeExamQuestions }, now),
      true
    );
  });

  await runTest("Test 54: Handles stringified JSON session identical to object session", () => {
    const sessionObj = {
      examMode: "SIMULATION",
      attemptToken: validSimToken,
      examQuestions: safeExamQuestions,
    };
    assert.strictEqual(isResumeGraceEligible(JSON.stringify(sessionObj), now), true);
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP E: SOURCE CODE AST & ARCHITECTURAL INVARIANTS (TESTS 55 - 67)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group E: Source Code AST & Architectural Invariants ---");

  await runTest("Test 55: parseJwtAdvisoryExp documented as advisory UX helper without HMAC verification", () => {
    assert.ok(
      takePageSource.includes("Advisory Client-Side JWT Expiration Parser"),
      "Must have advisory documentation banner"
    );
    assert.ok(
      takePageSource.includes("It is NOT cryptographic verification and does NOT verify the HMAC signature"),
      "Must explicitly disclaim cryptographic verification"
    );
  });

  await runTest("Test 56: isResumeGraceEligible enforces strict mode recognition in source", () => {
    assert.ok(
      takePageSource.includes('if (parsed.examMode === "GUIDED_REVIEW")'),
      "Must check explicit GUIDED_REVIEW"
    );
    assert.ok(
      takePageSource.includes('parsed.examMode === "SIMULATION" ||'),
      "Must check explicit SIMULATION"
    );
    assert.ok(
      takePageSource.includes('parsed.examMode === undefined ||'),
      "Must allow legacy undefined mode"
    );
    assert.ok(
      takePageSource.includes('parsed.examMode === null'),
      "Must allow legacy null mode"
    );
  });

  await runTest("Test 57: isResumeGraceEligible scans all 10 sensitive fields for both modes", () => {
    for (const f of allTenSensitiveFields) {
      assert.ok(
        takePageSource.includes(`q.${f} !== undefined`),
        `isResumeGraceEligible must check q.${f} !== undefined`
      );
    }
  });

  await runTest("Test 58: isResumeGraceEligible enforces cross-mode token strictly null or undefined in source", () => {
    assert.ok(
      takePageSource.includes("if (parsed.attemptToken !== undefined && parsed.attemptToken !== null)"),
      "Guided Review must strictly reject non-null/non-undefined attemptToken"
    );
    assert.ok(
      takePageSource.includes("if (parsed.guidedReviewToken !== undefined && parsed.guidedReviewToken !== null)"),
      "Simulation must strictly reject non-null/non-undefined guidedReviewToken"
    );
  });

  await runTest("Test 59: isResumeGraceEligible verifies advisory exp > nowUnix in source", () => {
    assert.ok(
      takePageSource.includes("const exp = parseJwtAdvisoryExp("),
      "Must parse exp with parseJwtAdvisoryExp"
    );
    assert.ok(
      takePageSource.includes("if (exp === null || exp <= nowUnix) return false;"),
      "Must enforce exp > nowUnix"
    );
  });

  await runTest("Test 60: Page-level redirect effect evaluates isResumeGraceEligible(saved)", () => {
    assert.ok(
      takePageSource.includes("if (!isResumeGraceEligible(saved))"),
      "Redirect effect must check !isResumeGraceEligible(saved)"
    );
  });

  await runTest("Test 61: initExam() synchronously evaluates isResumeGraceEligible(saved) and sets hasResumeGrace(true)", () => {
    assert.ok(
      takePageSource.includes("const graceEligible = isResumeGraceEligible(saved);"),
      "initExam must evaluate isResumeGraceEligible(saved)"
    );
    assert.ok(
      takePageSource.includes("setHasResumeGrace(true);"),
      "initExam must set hasResumeGrace(true) when eligible"
    );
  });

  await runTest("Test 62: initExam() auth-loading race correction — early-return removed, downstream code reachable", () => {
    // (1) graceEligible declaration still present in initExam
    assert.ok(
      takePageSource.includes("const graceEligible = isResumeGraceEligible(saved);"),
      "initExam must still declare: const graceEligible = isResumeGraceEligible(saved);"
    );
    // (2) setHasResumeGrace(true) still called when eligible
    assert.ok(
      takePageSource.includes("setHasResumeGrace(true);"),
      "initExam must still call setHasResumeGrace(true) when graceEligible"
    );
    // (3) The removed early-return if-block must NOT be present
    assert.strictEqual(
      takePageSource.includes("if (!hasAnyCustomParam && !isPaid && !graceEligible)"),
      false,
      "initExam must NOT contain the early-return block: if (!hasAnyCustomParam && !isPaid && !graceEligible)"
    );
    // (4) Bookmark loading is reachable (fetch call still present after grace block)
    assert.ok(
      takePageSource.includes('fetch("/api/bookmarks")'),
      "initExam must contain bookmark fetch after grace block"
    );
    // (5) Saved-session parsing reachable (JSON.parse of saved still present)
    assert.ok(
      takePageSource.includes("const parsed = JSON.parse(saved);"),
      "initExam must contain saved-session JSON.parse block"
    );
    // (6) Auth redirect effect still checks unpaid users (not mount-only initExam)
    assert.ok(
      takePageSource.includes("if (!isResumeGraceEligible(saved))"),
      "Auth redirect effect must still call isResumeGraceEligible(saved) to gate unpaid redirect"
    );
    // (7) Render guard still requires !hasResumeGrace
    assert.ok(
      takePageSource.includes("if (!hasAnyCustomParam && !isPaid && !hasResumeGrace)"),
      "Render guard must still check !hasResumeGrace"
    );
    // (8) Resume-click revalidation remains in handleResumeSavedSession
    assert.ok(
      takePageSource.includes("if (!isResumeGraceEligible(savedSessionData))"),
      "handleResumeSavedSession must still revalidate grace for !isPaid users"
    );
    // (9) No isPaid gate inside initExam (mount-only — isPaid is false during auth loading)
    const initExamStart = takePageSource.indexOf("async function initExam()");
    const initExamEnd = takePageSource.indexOf("initExam();", initExamStart);
    const initExamBody = initExamStart >= 0 && initExamEnd > initExamStart
      ? takePageSource.slice(initExamStart, initExamEnd)
      : "";
    assert.strictEqual(
      initExamBody.includes("!isPaid && !graceEligible"),
      false,
      "initExam must not gate on (!isPaid && !graceEligible) — isPaid is false during auth loading"
    );
  });

  await runTest("Test 63: Render guard checks !hasResumeGrace before rendering upgrade indicator", () => {
    assert.ok(
      takePageSource.includes("if (!hasAnyCustomParam && !isPaid && !hasResumeGrace)"),
      "Render guard must check !hasResumeGrace"
    );
  });

  await runTest("Test 64: Discard action clears grace and redirects to /upgrade when !isPaid", () => {
    assert.ok(
      takePageSource.includes("if (!isPaid) {"),
      "Discard action must check !isPaid"
    );
    assert.ok(
      takePageSource.includes('router.replace("/upgrade");'),
      "Discard action must redirect to /upgrade when !isPaid"
    );
  });

  await runTest("Test 65: No call to /api/exam/start in resume grace code path", () => {
    const resumeGraceSlice = takePageSource.slice(
      takePageSource.indexOf("function isResumeGraceEligible"),
      takePageSource.indexOf("function TakeExamPageInner")
    );
    assert.strictEqual(
      resumeGraceSlice.includes("/api/exam/start"),
      false,
      "Resume grace helpers must never call /api/exam/start"
    );
  });

  await runTest("Test 66: NO endpoints exist for token refresh, renewal, extension, or re-issuance", () => {
    assert.strictEqual(takePageSource.includes("/refresh"), false, "Must not call /refresh");
    assert.strictEqual(takePageSource.includes("/renew"), false, "Must not call /renew");
    assert.strictEqual(takePageSource.includes("/extend"), false, "Must not call /extend");
    assert.strictEqual(takePageSource.includes("/reissue"), false, "Must not call /reissue");
  });

  await runTest("Test 67: Guided Review invariants preserved (no server submit)", () => {
    assert.ok(
      takePageSource.includes('if (examMode === "GUIDED_REVIEW") return; // Safety guard: Guided Review NEVER submits to server'),
      "Must preserve guided review submission safety guard"
    );
  });

  await runTest("Test 68: handleResumeSavedSession revalidates grace for unpaid users", () => {
    const fnSlice = takePageSource.slice(
      takePageSource.indexOf("function handleResumeSavedSession()"),
      takePageSource.indexOf("function handleStartCustomExam")
    );
    assert.ok(fnSlice.includes("if (!isPaid) {"), "Must check if (!isPaid)");
    assert.ok(
      fnSlice.includes("if (!isResumeGraceEligible(savedSessionData))"),
      "Must revalidate isResumeGraceEligible(savedSessionData)"
    );
    assert.ok(
      fnSlice.includes("localStorage.removeItem(LOCAL_STORAGE_KEY);"),
      "Must purge localStorage on ineligible resume"
    );
    assert.ok(
      fnSlice.includes("setSavedSessionData(null);"),
      "Must clear saved session data on ineligible resume"
    );
    assert.ok(
      fnSlice.includes("setHasResumeGrace(false);"),
      "Must revoke hasResumeGrace on ineligible resume"
    );
    assert.ok(
      fnSlice.includes("setAttemptToken(null);"),
      "Must clear attemptToken on ineligible resume"
    );
    assert.ok(
      fnSlice.includes("setGuidedReviewToken(null);"),
      "Must clear guidedReviewToken on ineligible resume"
    );
    assert.ok(
      fnSlice.includes('router.replace("/upgrade");'),
      "Must redirect to /upgrade on ineligible resume"
    );
    assert.ok(fnSlice.includes("return;"), "Must return immediately after redirect");
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP F: EXACT PROTECTED ZERO-DIFF VERIFICATION (TEST 68)
  // GROUP F: EXACT PROTECTED ZERO-DIFF VERIFICATION (TEST 69)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group F: Exact Protected Zero-Diff Verification ---");

  await runTest("Test 69: Protected files have EXACT ZERO diff against baseline commit", () => {
    const protectedFiles = [
      "src/app/api/exam/start/route.ts",
      "src/app/api/exam/submit/route.ts",
      "src/app/api/exam/guided-review/check/route.ts",
      "src/lib/examAttemptToken.ts",
      "src/lib/guidedReviewToken.ts",
      "src/lib/examSubmissionIntegrity.ts",
      "src/lib/userMistakeBatch.ts",
      "src/lib/offline-storage.ts",
      "src/hooks/useOfflineSync.ts",
      "src/lib/streakEngine.ts",
      "src/lib/badges.ts",
      "prisma/schema.prisma",
      "src/app/api/mock-exam/history/route.ts",
      "src/app/api/mock-exam/history/[id]/route.ts",
    ];

    for (const file of protectedFiles) {
      const diff = execSync(`git diff HEAD -- "${file}"`, { encoding: "utf8" }).trim();
      assert.strictEqual(
        diff,
        "",
        `Protected file ${file} MUST NOT have any diff, found:\n${diff}`
      );
    }
  });

  console.log("\n============================================================");
  console.log(`SUMMARY: ${passed} of ${total} tests passed.`);
  console.log("============================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
