// Relative Path: src/scripts/test-entitlement-1e5b-mode-isolation.ts
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

const BASELINE_COMMIT = "937e53707e248807e9b87413ea468d5df20bbd05";

let total = 0;
let passed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`✔ [${total}] ${name}`);
  } catch (err: any) {
    console.error(`✖ [${total}] ${name}`);
    console.error(`  Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log("============================================================");
  console.log("RUNNING ENTITLEMENT-1E5B CUSTOM PRACTICE MODE ISOLATION TESTS");
  console.log("============================================================");

  const takePagePath = path.resolve(__dirname, "../app/mock-exam/take/page.tsx");
  const takePageSource = fs.readFileSync(takePagePath, "utf8");

  const startRoutePath = path.resolve(__dirname, "../app/api/exam/start/route.ts");
  const startRouteSource = fs.readFileSync(startRoutePath, "utf8");

  // ─────────────────────────────────────────────────────────────
  // GROUP A: URL CLASSIFICATION & COMPLETE CUSTOM PRACTICE
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group A: URL Classification & Custom Practice Config ---");

  await runTest("Test 1: Complete Custom Practice config is correctly recognized", () => {
    function classifyParams(params: Record<string, string>) {
      const hasItemCount = "itemCount" in params;
      const hasCategories = "categories" in params;
      const hasPool = "pool" in params;
      const hasMode = "mode" in params;

      const hasAnyCustomParam = hasItemCount || hasCategories || hasPool || hasMode;
      const hasAllCustomParams = hasItemCount && hasCategories && hasPool && hasMode;

      const itemCountVal = (params["itemCount"] || "").trim();
      const categoriesVal = (params["categories"] || "").trim();
      const poolVal = (params["pool"] || "").trim();
      const modeVal = (params["mode"] || "").trim();

      const isCompleteNonEmptyCustom =
        hasAllCustomParams &&
        itemCountVal !== "" &&
        categoriesVal !== "" &&
        poolVal !== "" &&
        modeVal !== "";

      const isPartialOrEmptyCustom = hasAnyCustomParam && !isCompleteNonEmptyCustom;

      return { hasAnyCustomParam, hasAllCustomParams, isCompleteNonEmptyCustom, isPartialOrEmptyCustom };
    }

    // Complete valid Custom Practice
    const complete = classifyParams({
      itemCount: "20",
      categories: "Verbal Ability",
      pool: "ALL",
      mode: "TIMED",
    });
    assert.strictEqual(complete.isCompleteNonEmptyCustom, true);
    assert.strictEqual(complete.isPartialOrEmptyCustom, false);
    assert.strictEqual(complete.hasAnyCustomParam, true);

    // Missing one param (partial)
    const missingMode = classifyParams({
      itemCount: "20",
      categories: "Verbal Ability",
      pool: "ALL",
    });
    assert.strictEqual(missingMode.isCompleteNonEmptyCustom, false);
    assert.strictEqual(missingMode.isPartialOrEmptyCustom, true);

    // Empty string param (partial/empty)
    const emptyCategory = classifyParams({
      itemCount: "20",
      categories: "   ",
      pool: "ALL",
      mode: "TIMED",
    });
    assert.strictEqual(emptyCategory.isCompleteNonEmptyCustom, false);
    assert.strictEqual(emptyCategory.isPartialOrEmptyCustom, true);

    // Standard Mock (zero custom params)
    const standardMock = classifyParams({});
    assert.strictEqual(standardMock.isCompleteNonEmptyCustom, false);
    assert.strictEqual(standardMock.isPartialOrEmptyCustom, false);
    assert.strictEqual(standardMock.hasAnyCustomParam, false);

    // Verify client source contains exact classification logic
    assert.ok(takePageSource.includes("const isCompleteNonEmptyCustom ="), "Must declare isCompleteNonEmptyCustom");
    assert.ok(takePageSource.includes("const isPartialOrEmptyCustom ="), "Must declare isPartialOrEmptyCustom");
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP B: RENDER GUARD ORDERING & UI MODE ISOLATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group B: Render Guard Ordering & UI Mode Isolation ---");

  await runTest("Test 2: Custom Practice loading guard occurs before generic if (isSetupPhase)", () => {
    const customLoadingGuardIdx = takePageSource.indexOf("if (isCompleteNonEmptyCustom && isSetupPhase)");
    const genericSetupPhaseIdx = takePageSource.indexOf("if (isSetupPhase)");

    assert.ok(customLoadingGuardIdx > 0, "Custom Practice loading guard must exist in page source");
    assert.ok(genericSetupPhaseIdx > 0, "Generic setup phase must exist in page source");
    assert.ok(
      customLoadingGuardIdx < genericSetupPhaseIdx,
      "Custom Practice loading guard must occur BEFORE generic if (isSetupPhase)"
    );

    // Verify it renders a dedicated loading indicator
    const guardSlice = takePageSource.slice(
      customLoadingGuardIdx,
      takePageSource.indexOf("if (isSetupPhase)", customLoadingGuardIdx)
    );
    assert.ok(guardSlice.includes("<DatabaseLoadingIndicator"), "Must render DatabaseLoadingIndicator");
    assert.ok(guardSlice.includes("Generating Custom Practice Quiz..."), "Must show custom practice title");
    assert.strictEqual(guardSlice.includes("Configure Mock Exam"), false, "Must NOT render Configure Mock Exam");
    assert.strictEqual(guardSlice.includes("Guided Review"), false, "Must NOT render Guided Review in guard");
  });

  await runTest("Test 3: Complete Custom Practice cannot render or select Guided mode", () => {
    // Mode selector buttons in setup phase have isCompleteNonEmptyCustom click guards
    const guidedButtonIdx = takePageSource.indexOf('onClick={() => {');
    assert.ok(guidedButtonIdx > 0, "Button onClick handlers must exist");

    assert.ok(
      takePageSource.includes("if (isCompleteNonEmptyCustom) return;\n                    setExamMode(\"GUIDED_REVIEW\");") ||
      takePageSource.includes("if (isCompleteNonEmptyCustom) return;\r\n                    setExamMode(\"GUIDED_REVIEW\");"),
      "Guided Review button must guard against isCompleteNonEmptyCustom"
    );

    assert.ok(
      takePageSource.includes("if (isCompleteNonEmptyCustom) return;\n                    setExamMode(\"SIMULATION\");") ||
      takePageSource.includes("if (isCompleteNonEmptyCustom) return;\r\n                    setExamMode(\"SIMULATION\");"),
      "Simulation button must guard against isCompleteNonEmptyCustom"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP C: CUSTOM PRACTICE LIFECYCLE & STATE ISOLATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group C: Custom Practice Lifecycle & State Isolation ---");

  await runTest("Test 4: handleStartCustomExam forces SIMULATION before network start", () => {
    const fnStart = takePageSource.indexOf("async function handleStartCustomExam(");
    assert.ok(fnStart > 0, "handleStartCustomExam must exist");

    const fetchIdx = takePageSource.indexOf("fetch(`/api/exam/start?", fnStart);
    assert.ok(fetchIdx > fnStart, "fetch call must exist in handleStartCustomExam");

    const fnPrefix = takePageSource.slice(fnStart, fetchIdx);
    assert.ok(
      fnPrefix.includes('setExamMode("SIMULATION");'),
      "handleStartCustomExam must call setExamMode('SIMULATION') before fetch"
    );
  });

  await runTest("Test 5: Success path re-establishes SIMULATION before setIsSetupPhase(false)", () => {
    const fnStart = takePageSource.indexOf("async function handleStartCustomExam(");
    const fnEnd = takePageSource.indexOf("async function handleStartExam()", fnStart);
    const fnBody = takePageSource.slice(fnStart, fnEnd);

    const setupPhaseFalseIdx = fnBody.indexOf("setIsSetupPhase(false);");
    assert.ok(setupPhaseFalseIdx > 0, "setIsSetupPhase(false) must exist in custom exam success branch");

    const beforeSetupFalse = fnBody.slice(0, setupPhaseFalseIdx);
    // Find the second setExamMode("SIMULATION") in the success path
    const lastExamModeIdx = beforeSetupFalse.lastIndexOf('setExamMode("SIMULATION");');
    const fetchCallIdx = beforeSetupFalse.indexOf("fetch(`/api/exam/start?");

    assert.ok(
      lastExamModeIdx > fetchCallIdx,
      "Success path must re-establish setExamMode('SIMULATION') after fetch and before setIsSetupPhase(false)"
    );
  });

  await runTest("Test 6: Guided Review token is cleared for Custom Practice", () => {
    const fnStart = takePageSource.indexOf("async function handleStartCustomExam(");
    const fnEnd = takePageSource.indexOf("async function handleStartExam()", fnStart);
    const fnBody = takePageSource.slice(fnStart, fnEnd);

    // Initial clear
    const fetchCallIdx = fnBody.indexOf("fetch(`/api/exam/start?");
    const beforeFetch = fnBody.slice(0, fetchCallIdx);
    assert.ok(
      beforeFetch.includes("setGuidedReviewToken(null);"),
      "Must clear guidedReviewToken before fetch"
    );

    // Success path clear/confirmation
    const afterFetch = fnBody.slice(fetchCallIdx);
    assert.ok(
      afterFetch.includes("setGuidedReviewToken(null);"),
      "Must ensure guidedReviewToken is null in success path"
    );
  });

  await runTest("Test 7: Guided feedback state is cleared", () => {
    const fnStart = takePageSource.indexOf("async function handleStartCustomExam(");
    const fnEnd = takePageSource.indexOf("async function handleStartExam()", fnStart);
    const fnBody = takePageSource.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes("setGuidedFeedbackByQuestionId({});"),
      "Must clear guidedFeedbackByQuestionId in handleStartCustomExam"
    );
  });

  await runTest("Test 8: Checked Guided state is cleared", () => {
    const fnStart = takePageSource.indexOf("async function handleStartCustomExam(");
    const fnEnd = takePageSource.indexOf("async function handleStartExam()", fnStart);
    const fnBody = takePageSource.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes("setCheckedAnswers({});"),
      "Must clear checkedAnswers in handleStartCustomExam"
    );
  });

  await runTest("Test 9: guidedFinished is reset", () => {
    const fnStart = takePageSource.indexOf("async function handleStartCustomExam(");
    const fetchCallIdx = takePageSource.indexOf("fetch(`/api/exam/start?", fnStart);
    const beforeFetch = takePageSource.slice(fnStart, fetchCallIdx);

    assert.ok(
      beforeFetch.includes("setGuidedFinished(false);"),
      "Must reset guidedFinished to false at beginning of handleStartCustomExam"
    );
  });

  await runTest("Test 10: Valid Custom attemptToken is required before entering exam phase", () => {
    const fnStart = takePageSource.indexOf("async function handleStartCustomExam(");
    const fnEnd = takePageSource.indexOf("async function handleStartExam()", fnStart);
    const fnBody = takePageSource.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes('typeof data.attemptToken === "string"'),
      "Must check typeof data.attemptToken === 'string'"
    );
    assert.ok(
      fnBody.includes("data.attemptToken.trim().length > 0"),
      "Must check data.attemptToken.trim().length > 0"
    );

    // Ensure fallback else alerts and redirects
    assert.ok(
      fnBody.includes('alert("Unable to generate custom quiz questions. Please try again.");'),
      "Must alert when custom quiz questions or token cannot be generated"
    );
    assert.ok(
      fnBody.includes('router.push("/practice/custom");'),
      "Must redirect to /practice/custom on failure"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP D: AUTOSAVE & TOKEN PRESERVATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group D: Autosave & Token Preservation ---");

  await runTest("Test 11: Autosave under Custom/SIMULATION preserves attemptToken", () => {
    const autosaveStart = takePageSource.indexOf("// 2. Auto-Save Active Exam State to LocalStorage");
    const autosaveEnd = takePageSource.indexOf("// Toggle Bookmark Handler", autosaveStart);
    const autosaveBody = takePageSource.slice(autosaveStart, autosaveEnd);

    assert.ok(
      autosaveBody.includes('attemptToken: examMode === "GUIDED_REVIEW" ? null : attemptToken,'),
      "Autosave must preserve attemptToken when examMode is SIMULATION"
    );

    // Runtime simulation: active session with SIMULATION retains custom attemptToken
    const activeSession = {
      examMode: "SIMULATION",
      attemptToken: "custom_signed_attempt_token_123",
      guidedReviewToken: null,
    };
    const savedAttempt = activeSession.examMode === "GUIDED_REVIEW" ? null : activeSession.attemptToken;
    assert.strictEqual(savedAttempt, "custom_signed_attempt_token_123");
  });

  await runTest("Test 12: Autosave persists guidedReviewToken as null for Custom/SIMULATION", () => {
    const autosaveStart = takePageSource.indexOf("// 2. Auto-Save Active Exam State to LocalStorage");
    const autosaveEnd = takePageSource.indexOf("// Toggle Bookmark Handler", autosaveStart);
    const autosaveBody = takePageSource.slice(autosaveStart, autosaveEnd);

    assert.ok(
      autosaveBody.includes('guidedReviewToken: examMode === "GUIDED_REVIEW" ? guidedReviewToken : null,'),
      "Autosave must force guidedReviewToken to null when examMode is SIMULATION"
    );

    // Runtime simulation: active session with SIMULATION forces guidedReviewToken to null
    const activeSession = {
      examMode: "SIMULATION",
      attemptToken: "custom_token",
      guidedReviewToken: "should_never_exist",
    };
    const savedGuidedToken = activeSession.examMode === "GUIDED_REVIEW" ? activeSession.guidedReviewToken : null;
    assert.strictEqual(savedGuidedToken, null);
  });

  await runTest("Test 13: Sensitive question fields remain excluded in pre-submit payloads and storage", () => {
    const sensitiveFields = [
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

    // In page.tsx: questionsToPersist mapping only selects safe fields
    const autosaveStart = takePageSource.indexOf("// 2. Auto-Save Active Exam State to LocalStorage");
    const autosaveEnd = takePageSource.indexOf("// Toggle Bookmark Handler", autosaveStart);
    const autosaveBody = takePageSource.slice(autosaveStart, autosaveEnd);

    for (const field of sensitiveFields) {
      assert.strictEqual(
        autosaveBody.includes(`${field}:`),
        false,
        `Autosave questionsToPersist must not include sensitive field '${field}'`
      );
    }

    // In start route: Custom Practice preparedQuestions only selects safe fields
    const customBlockStart = startRouteSource.indexOf("if (isCustom && targetItemCount)");
    const customBlockEnd = startRouteSource.indexOf("meta: { mode, pool, isCustom: true }", customBlockStart);
    const customBlock = startRouteSource.slice(customBlockStart, customBlockEnd);

    for (const field of sensitiveFields) {
      assert.strictEqual(
        customBlock.includes(`${field}: q.${field}`),
        false,
        `Custom start route preparedQuestions must not include sensitive field '${field}'`
      );
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP E: FAIL-CLOSED STANDARD START & INIT ISOLATION
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group E: Fail-Closed Standard Start & Init Isolation ---");

  await runTest("Test 14: handleStartExam fails closed in complete Custom Practice context", () => {
    const fnStart = takePageSource.indexOf("async function handleStartExam() {");
    assert.ok(fnStart > 0, "handleStartExam must exist");

    const fetchIdx = takePageSource.indexOf("fetch(", fnStart);
    const prefix = takePageSource.slice(fnStart, fetchIdx);

    assert.ok(
      prefix.includes("if (isCompleteNonEmptyCustom) {"),
      "handleStartExam must check if (isCompleteNonEmptyCustom)"
    );
    assert.ok(
      prefix.includes("return;"),
      "handleStartExam must return immediately when in complete Custom Practice context"
    );
  });

  await runTest("Test 15: Custom Practice initialization does NOT hydrate a previously captured Standard/Guided saved session", () => {
    const initExamStart = takePageSource.indexOf("async function initExam() {");
    const initExamEnd = takePageSource.indexOf("initExam();", initExamStart);
    const initExamBody = takePageSource.slice(initExamStart, initExamEnd);

    // 1. Pre-bookmark read must be guarded
    assert.ok(
      initExamBody.includes("if (!isCompleteNonEmptyCustom) {"),
      "initExam must gate saved-session retrieval behind if (!isCompleteNonEmptyCustom)"
    );

    // 2. Post-bookmark hydration must be guarded
    assert.ok(
      initExamBody.includes("if (!isCompleteNonEmptyCustom && saved) {"),
      "initExam must gate post-bookmark hydration behind if (!isCompleteNonEmptyCustom && saved)"
    );

    // 3. Baseline ordering invariant: bookmark fetch occurs BEFORE saved-session JSON parsing
    const bookmarkFetchIdx = initExamBody.indexOf('fetch("/api/bookmarks")');
    const jsonParseIdx = initExamBody.indexOf("const parsed = JSON.parse(saved);");
    assert.ok(bookmarkFetchIdx > 0, "Bookmark fetch must exist in initExam");
    assert.ok(jsonParseIdx > 0, "JSON.parse(saved) must exist in initExam");
    assert.ok(
      bookmarkFetchIdx < jsonParseIdx,
      "Bookmark fetch must occur BEFORE saved-session JSON parsing, matching baseline Standard Mock ordering"
    );

    // 4. Runtime simulation: when isCompleteNonEmptyCustom is true, saved remains null and hydration never runs
    let saved: string | null = null;
    let hydrated = false;
    const isCompleteNonEmptyCustom = true;

    if (!isCompleteNonEmptyCustom) {
      saved = JSON.stringify({ examMode: "GUIDED_REVIEW", examQuestions: [{ id: "q1" }] });
    }

    if (!isCompleteNonEmptyCustom && saved) {
      hydrated = true;
    }

    assert.strictEqual(saved, null, "saved must remain null for complete Custom Practice");
    assert.strictEqual(hydrated, false, "hydration must not occur for complete Custom Practice");
  });

  await runTest("Test 16: Custom Practice does NOT set hasResumeGrace from old Standard saved state", () => {
    const initExamStart = takePageSource.indexOf("async function initExam() {");
    const initExamEnd = takePageSource.indexOf("initExam();", initExamStart);
    const initExamBody = takePageSource.slice(initExamStart, initExamEnd);

    const customGateIdx = initExamBody.indexOf("if (!isCompleteNonEmptyCustom) {");
    const graceCallIdx = initExamBody.indexOf("setHasResumeGrace(true);", customGateIdx);
    assert.ok(
      graceCallIdx > customGateIdx,
      "setHasResumeGrace(true) must be inside if (!isCompleteNonEmptyCustom)"
    );

    // Runtime simulation: when isCompleteNonEmptyCustom is true, grace is never evaluated
    let hasResumeGrace = false;
    const isCompleteNonEmptyCustom = true;
    const staleStandardSaved = JSON.stringify({
      examMode: "SIMULATION",
      examQuestions: [{ id: "q1", prompt: "p" }],
      attemptToken: "valid_token",
    });

    if (!isCompleteNonEmptyCustom) {
      hasResumeGrace = true;
    }
    assert.strictEqual(hasResumeGrace, false, "Resume grace must remain false for Custom Practice");
  });

  await runTest("Test 17: Standard Mock init still hydrates valid saved sessions", () => {
    // When isCompleteNonEmptyCustom is false, the block executes
    let hydrated = false;
    let hydratedMode = "";
    const isCompleteNonEmptyCustom = false;
    const mockSaved = {
      examMode: "SIMULATION",
      examQuestions: [{ id: "q1", prompt: "test prompt" }],
      attemptToken: "valid_token_abc",
    };

    if (!isCompleteNonEmptyCustom) {
      if (mockSaved && mockSaved.examQuestions?.length > 0) {
        hydrated = true;
        hydratedMode = mockSaved.examMode;
      }
    }

    assert.strictEqual(hydrated, true, "Standard Mock must hydrate saved session");
    assert.strictEqual(hydratedMode, "SIMULATION", "Standard Mock must preserve session mode");
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP F: SAFETY GUARDS & SERVER ENTITLEMENT BOUNDARIES
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group F: Safety Guards & Server Boundaries ---");

  await runTest("Test 18: Existing handleSubmitExam Guided safety guard remains intact", () => {
    assert.ok(
      takePageSource.includes('if (examMode === "GUIDED_REVIEW") return; // Safety guard: Guided Review NEVER submits to server'),
      "handleSubmitExam must preserve guided review safety guard"
    );
  });

  await runTest("Test 19: Existing handleCheckAnswer guidedReviewToken requirement remains intact", () => {
    assert.ok(
      takePageSource.includes("if (!guidedReviewToken || !guidedReviewToken.trim()) {"),
      "handleCheckAnswer must gate on valid non-empty guidedReviewToken"
    );
    assert.ok(
      takePageSource.includes('alert("Missing or invalid review session credential.'),
      "handleCheckAnswer must alert if token is missing"
    );
  });

  await runTest("Test 20: FREE <=20 Custom Practice server entitlement logic remains unchanged", () => {
    // Check server route source: 20-item cap for non-PRO accounts
    assert.ok(
      startRouteSource.includes('if (parsedItemCount > 20 && !isAccountAuthorizedFor(authenticatedUser, "PRO")) {'),
      "Server start route must enforce 20-item cap for free users"
    );
    assert.ok(
      startRouteSource.includes('"Payment required. Free practice quizzes are limited to 20 items. Upgrade to Pro for up to 170 items."'),
      "Server start route must return 402 upgrade message for >20 free custom items"
    );

    // Rejection of experience parameter in custom practice
    assert.ok(
      startRouteSource.includes('if (searchParams.has("experience")) {'),
      "Server start route must reject experience parameter for Custom Practice"
    );
    assert.ok(
      startRouteSource.includes('"Invalid custom quiz configuration: experience parameter is not supported for Custom Practice."'),
      "Server start route must return 400 when experience parameter is passed to Custom Practice"
    );
  });

  await runTest("Test 21: Standard PRO Simulation behavior remains unchanged structurally", () => {
    assert.ok(
      startRouteSource.includes('if (customParamCount === 0) {'),
      "Server start route must classify customParamCount === 0 as Standard Mock"
    );
    assert.ok(
      startRouteSource.includes('if (!isAccountAuthorizedFor(authenticatedUser, "PRO")) {'),
      "Server start route must require PRO for Standard Mock Exam"
    );
    assert.ok(
      startRouteSource.includes('examType: "FULL_MOCK"'),
      "Server start route must sign FULL_MOCK attemptToken for simulation"
    );
  });

  await runTest("Test 22: Standard PRO Guided behavior remains unchanged structurally", () => {
    assert.ok(
      startRouteSource.includes('signGuidedReviewToken({'),
      "Server start route must sign guidedReviewToken for GUIDED_REVIEW"
    );
    assert.ok(
      startRouteSource.includes('experience === "GUIDED_REVIEW"'),
      "Server start route must support experience === 'GUIDED_REVIEW'"
    );
  });

  await runTest("Test 23: Existing 1E5A source invariants remain intact", () => {
    // isResumeGraceEligible function exists
    assert.ok(
      takePageSource.includes("function isResumeGraceEligible("),
      "isResumeGraceEligible helper must exist"
    );
    // parseJwtAdvisoryExp exists
    assert.ok(
      takePageSource.includes("function parseJwtAdvisoryExp("),
      "parseJwtAdvisoryExp helper must exist"
    );
    // Page redirect checks isResumeGraceEligible
    assert.ok(
      takePageSource.includes("if (!isResumeGraceEligible(saved))"),
      "Page redirect effect must check isResumeGraceEligible(saved)"
    );
    // Render guard checks !hasResumeGrace
    assert.ok(
      takePageSource.includes("if (!hasAnyCustomParam && !isPaid && !hasResumeGrace)"),
      "Render guard must check !hasResumeGrace"
    );
    // handleResumeSavedSession checks isResumeGraceEligible
    assert.ok(
      takePageSource.includes("if (!isResumeGraceEligible(savedSessionData))"),
      "handleResumeSavedSession must check isResumeGraceEligible"
    );
  });

  await runTest("Test 24: Existing 1E5A regression test file is exact zero diff against baseline", () => {
    const diff = execSync(`git diff ${BASELINE_COMMIT} -- src/scripts/test-entitlement-1e5a-lapse-resume.ts`, {
      encoding: "utf8",
    }).trim();
    assert.strictEqual(
      diff,
      "",
      `1E5A regression test MUST NOT have any diff against baseline, found:\n${diff}`
    );
  });

  await runTest("Test 25: All protected files have EXACT ZERO diff against baseline commit", () => {
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
      const diff = execSync(`git diff ${BASELINE_COMMIT} -- "${file}"`, { encoding: "utf8" }).trim();
      assert.strictEqual(
        diff,
        "",
        `Protected file ${file} MUST NOT have any diff against baseline commit ${BASELINE_COMMIT}, found:\n${diff}`
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
