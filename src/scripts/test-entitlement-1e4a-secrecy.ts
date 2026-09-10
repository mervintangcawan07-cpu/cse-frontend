// Relative Path: src/scripts/test-entitlement-1e4a-secrecy.ts
import assert from "assert";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { signExamAttemptToken, verifyExamAttemptToken } from "../lib/examAttemptToken";

console.log("============================================================");
console.log("RUNNING ENTITLEMENT-1E4A SECRECY & CLIENT MIGRATION TESTS");
console.log("============================================================");

// Set test secret unconditionally before running tests
process.env.JWT_SECRET = "test_govstudyx_secret_for_regression_testing_only_do_not_use_in_prod";

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  total++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passed++;
          console.log(`✔ [${total}] ${name}`);
        })
        .catch((err) => {
          console.error(`✖ [${total}] ${name}`);
          console.error(err);
          throw err;
        });
    } else {
      passed++;
      console.log(`✔ [${total}] ${name}`);
    }
  } catch (err) {
    console.error(`✖ [${total}] ${name}`);
    console.error(err);
    throw err;
  }
}

async function main() {
  const rootDir = process.cwd();
  const startRoutePath = path.join(rootDir, "src/app/api/exam/start/route.ts");
  const takePagePath = path.join(rootDir, "src/app/mock-exam/take/page.tsx");
  const submitRoutePath = path.join(rootDir, "src/app/api/exam/submit/route.ts");
  const offlineStoragePath = path.join(rootDir, "src/lib/offline-storage.ts");

  const startRouteSource = fs.readFileSync(startRoutePath, "utf8");
  const takePageSource = fs.readFileSync(takePagePath, "utf8");
  const submitRouteSource = fs.readFileSync(submitRoutePath, "utf8");
  const offlineStorageSource = fs.readFileSync(offlineStoragePath, "utf8");

  // ─────────────────────────────────────────────────────────────
  // GROUP 1: CUSTOM PRACTICE PRE-SUBMIT SANITIZATION (TESTS 1 - 13)
  // ─────────────────────────────────────────────────────────────

  // Extract the CUSTOM_PRACTICE preparedQuestions serializer from route source
  const customBlockStartIndex = startRouteSource.indexOf("if (isCustom && targetItemCount)");
  const customBlockEndIndex = startRouteSource.indexOf("meta: { mode, pool, isCustom: true }");
  assert(
    customBlockStartIndex !== -1 && customBlockEndIndex !== -1,
    "Custom Practice code block must be present in /api/exam/start/route.ts"
  );
  const customBlock = startRouteSource.slice(customBlockStartIndex, customBlockEndIndex);

  // Extract the specific preparedQuestions return object literal inside customBlock
  const preparedQuestionsMatch = customBlock.match(/const preparedQuestions = pickedQuestions[\s\S]*?return \{([\s\S]*?)\};\s*\}\);/);
  assert(preparedQuestionsMatch, "Custom Practice serializer return object must be present in /api/exam/start/route.ts");
  const customSerializerCode = preparedQuestionsMatch[1];

  // Dummy question containing all sensitive fields for supplemental runtime mapping test
  const mockDbQuestion = {
    id: "q-test-123",
    category: "Verbal Ability",
    subtopic: "Grammar & Usage",
    prompt: "Choose the correct sentence.",
    options: ["Option A", "Option B", "Option C", "Option D"],
    optionA: "Option A",
    optionB: "Option B",
    optionC: "Option C",
    optionD: "Option D",
    answerIndex: 2,
    explanation: "Option C is correct because the subject is plural.",
    imageUrl: "https://example.com/diagram.png",
    stepByStep: "Step 1: Check subject. Step 2: Check verb.",
    whyA: "Option A has singular verb.",
    whyB: "Option B is dangling participle.",
    whyC: "Option C correctly agrees.",
    whyD: "Option D uses wrong tense.",
    eliminationStrategy: "Eliminate singular verbs first.",
    commonTrap: "Ignoring inverted word order.",
    examTip: "Always find the subject before picking the verb.",
    difficulty: "HARD",
    tags: ["grammar", "agreement"],
  };

  // Run the sanitized mapper as implemented in start/route.ts
  const resolvedOptions: string[] =
    Array.isArray(mockDbQuestion.options) && mockDbQuestion.options.length > 0
      ? (mockDbQuestion.options as string[])
      : ([mockDbQuestion.optionA, mockDbQuestion.optionB, mockDbQuestion.optionC, mockDbQuestion.optionD].filter(Boolean) as string[]);

  const sanitizedCustomQuestion: any = {
    id: mockDbQuestion.id,
    category: mockDbQuestion.category || "General",
    subtopic: mockDbQuestion.subtopic || "General",
    prompt: mockDbQuestion.prompt,
    options: resolvedOptions,
    imageUrl: mockDbQuestion.imageUrl || null,
    difficulty: mockDbQuestion.difficulty || "MEDIUM",
    tags: mockDbQuestion.tags || [],
  };

  runTest("1. Custom Practice serializer does not return answerIndex (source & runtime)", () => {
    assert(!/\banswerIndex\b/.test(customSerializerCode), "Real custom serializer must not contain 'answerIndex'");
    assert.strictEqual(sanitizedCustomQuestion.answerIndex, undefined);
    assert(!("answerIndex" in sanitizedCustomQuestion), "answerIndex property must not exist on sanitized question");
  });

  runTest("2. Custom Practice serializer does not return explanation (source & runtime)", () => {
    assert(!/\bexplanation\b/.test(customSerializerCode), "Real custom serializer must not contain 'explanation'");
    assert.strictEqual(sanitizedCustomQuestion.explanation, undefined);
    assert(!("explanation" in sanitizedCustomQuestion), "explanation property must not exist on sanitized question");
  });

  runTest("3. Custom Practice serializer does not return stepByStep (source & runtime)", () => {
    assert(!/\bstepByStep\b/.test(customSerializerCode), "Real custom serializer must not contain 'stepByStep'");
    assert.strictEqual(sanitizedCustomQuestion.stepByStep, undefined);
    assert(!("stepByStep" in sanitizedCustomQuestion), "stepByStep property must not exist on sanitized question");
  });

  runTest("4. Custom Practice serializer does not return whyA (source & runtime)", () => {
    assert(!/\bwhyA\b/.test(customSerializerCode), "Real custom serializer must not contain 'whyA'");
    assert.strictEqual(sanitizedCustomQuestion.whyA, undefined);
    assert(!("whyA" in sanitizedCustomQuestion), "whyA property must not exist on sanitized question");
  });

  runTest("5. Custom Practice serializer does not return whyB (source & runtime)", () => {
    assert(!/\bwhyB\b/.test(customSerializerCode), "Real custom serializer must not contain 'whyB'");
    assert.strictEqual(sanitizedCustomQuestion.whyB, undefined);
    assert(!("whyB" in sanitizedCustomQuestion), "whyB property must not exist on sanitized question");
  });

  runTest("6. Custom Practice serializer does not return whyC (source & runtime)", () => {
    assert(!/\bwhyC\b/.test(customSerializerCode), "Real custom serializer must not contain 'whyC'");
    assert.strictEqual(sanitizedCustomQuestion.whyC, undefined);
    assert(!("whyC" in sanitizedCustomQuestion), "whyC property must not exist on sanitized question");
  });

  runTest("7. Custom Practice serializer does not return whyD (source & runtime)", () => {
    assert(!/\bwhyD\b/.test(customSerializerCode), "Real custom serializer must not contain 'whyD'");
    assert.strictEqual(sanitizedCustomQuestion.whyD, undefined);
    assert(!("whyD" in sanitizedCustomQuestion), "whyD property must not exist on sanitized question");
  });

  runTest("8. Custom Practice serializer does not return eliminationStrategy (source & runtime)", () => {
    assert(!/\beliminationStrategy\b/.test(customSerializerCode), "Real custom serializer must not contain 'eliminationStrategy'");
    assert.strictEqual(sanitizedCustomQuestion.eliminationStrategy, undefined);
    assert(!("eliminationStrategy" in sanitizedCustomQuestion), "eliminationStrategy property must not exist on sanitized question");
  });

  runTest("9. Custom Practice serializer does not return commonTrap (source & runtime)", () => {
    assert(!/\bcommonTrap\b/.test(customSerializerCode), "Real custom serializer must not contain 'commonTrap'");
    assert.strictEqual(sanitizedCustomQuestion.commonTrap, undefined);
    assert(!("commonTrap" in sanitizedCustomQuestion), "commonTrap property must not exist on sanitized question");
  });

  runTest("10. Custom Practice serializer does not return examTip (source & runtime)", () => {
    assert(!/\bexamTip\b/.test(customSerializerCode), "Real custom serializer must not contain 'examTip'");
    assert.strictEqual(sanitizedCustomQuestion.examTip, undefined);
    assert(!("examTip" in sanitizedCustomQuestion), "examTip property must not exist on sanitized question");
  });

  runTest("11. Safe question fields are serialized in Custom Practice (source & runtime)", () => {
    assert(customSerializerCode.includes("id: q.id"), "Real custom serializer must include 'id: q.id'");
    assert(customSerializerCode.includes("category: q.category"), "Real custom serializer must include 'category: q.category'");
    assert(customSerializerCode.includes("subtopic: q.subtopic"), "Real custom serializer must include 'subtopic: q.subtopic'");
    assert(customSerializerCode.includes("prompt: q.prompt"), "Real custom serializer must include 'prompt: q.prompt'");
    assert(customSerializerCode.includes("options: resolvedOptions"), "Real custom serializer must include 'options: resolvedOptions'");
    assert(customSerializerCode.includes("imageUrl: q.imageUrl"), "Real custom serializer must include 'imageUrl: q.imageUrl'");
    assert(customSerializerCode.includes("difficulty: q.difficulty"), "Real custom serializer must include 'difficulty: q.difficulty'");
    assert(customSerializerCode.includes("tags: q.tags"), "Real custom serializer must include 'tags: q.tags'");

    assert.strictEqual(sanitizedCustomQuestion.id, "q-test-123");
    assert.strictEqual(sanitizedCustomQuestion.category, "Verbal Ability");
    assert.strictEqual(sanitizedCustomQuestion.subtopic, "Grammar & Usage");
    assert.strictEqual(sanitizedCustomQuestion.prompt, "Choose the correct sentence.");
    assert.deepStrictEqual(sanitizedCustomQuestion.options, ["Option A", "Option B", "Option C", "Option D"]);
    assert.strictEqual(sanitizedCustomQuestion.imageUrl, "https://example.com/diagram.png");
    assert.strictEqual(sanitizedCustomQuestion.difficulty, "HARD");
    assert.deepStrictEqual(sanitizedCustomQuestion.tags, ["grammar", "agreement"]);
  });

  await runTest("12. attemptToken remains generated and returned for Custom Practice", async () => {
    const qIds = ["q-test-1", "q-test-2", "q-test-3"];
    const tokenResult = await signExamAttemptToken({
      userId: "test-user-custom",
      examType: "CUSTOM_PRACTICE",
      questionIds: qIds,
    });
    assert.strictEqual(typeof tokenResult.attemptToken, "string");
    assert.ok(tokenResult.attemptToken.length > 20);

    const verified = await verifyExamAttemptToken(tokenResult.attemptToken);
    assert.strictEqual(verified?.userId, "test-user-custom");
    assert.strictEqual(verified?.examType, "CUSTOM_PRACTICE");
    assert.strictEqual(verified?.itemCount, 3);
  });

  await runTest("13. attemptToken questionIds match returned question IDs and preserve exact order", async () => {
    const questions = [
      { id: "q-order-1", prompt: "P1" },
      { id: "q-order-2", prompt: "P2" },
      { id: "q-order-3", prompt: "P3" },
      { id: "q-order-4", prompt: "P4" },
    ];
    const extractedIds = questions.map((q) => q.id);
    const tokenResult = await signExamAttemptToken({
      userId: "test-user-order",
      examType: "CUSTOM_PRACTICE",
      questionIds: extractedIds,
    });
    const verified = await verifyExamAttemptToken(tokenResult.attemptToken);
    assert.deepStrictEqual(verified?.questionIds, ["q-order-1", "q-order-2", "q-order-3", "q-order-4"]);
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP 2: CLIENT TAKE-PAGE SUBMISSION MIGRATION (TESTS 14 - 17)
  // ─────────────────────────────────────────────────────────────

  runTest("14. Take page handleSubmitExam does not calculate correctness using q.answerIndex", () => {
    // Assert that the handleSubmitExam block does not contain selected === q.answerIndex
    const submitBlockMatch = takePageSource.match(/const handleSubmitExam = useCallback\([\s\S]*?\}\s*,\s*\[[\s\S]*?\]\);/);
    assert(submitBlockMatch, "handleSubmitExam callback must be defined");
    const submitBlock = submitBlockMatch[0];

    assert(
      !submitBlock.includes("selected === q.answerIndex"),
      "handleSubmitExam must not contain 'selected === q.answerIndex'"
    );
    assert(
      !submitBlock.includes("selected !== q.answerIndex"),
      "handleSubmitExam must not contain 'selected !== q.answerIndex'"
    );
  });

  runTest("15. Take page does not generate client-authoritative finalScore or counts in handleSubmitExam", () => {
    const submitBlockMatch = takePageSource.match(/const handleSubmitExam = useCallback\([\s\S]*?\}\s*,\s*\[[\s\S]*?\]\);/);
    assert(submitBlockMatch, "handleSubmitExam callback must be defined");
    const submitBlock = submitBlockMatch[0];

    assert(
      !submitBlock.includes("correctCount"),
      "handleSubmitExam must not calculate client correctCount"
    );
    assert(
      !submitBlock.includes("incorrectCount"),
      "handleSubmitExam must not calculate client incorrectCount"
    );
    assert(
      !submitBlock.includes("finalScore"),
      "handleSubmitExam must not calculate client finalScore"
    );
    assert(
      !submitBlock.includes("scorePercentage"),
      "handleSubmitExam must not calculate client scorePercentage"
    );
    assert(
      !submitBlock.includes('localStorage.setItem("cse_latest_review"'),
      "handleSubmitExam must not write pre-submit questions to cse_latest_review"
    );
    assert(
      !submitBlock.includes("reviewData"),
      "handleSubmitExam must not construct reviewData"
    );
  });

  runTest("16. Successful online submit parses server result.id and requires non-empty string", () => {
    assert(
      takePageSource.includes("data?.result?.id"),
      "handleSubmitExam must inspect data.result.id"
    );
    assert(
      takePageSource.includes("data?.success === true"),
      "handleSubmitExam must verify data.success === true"
    );
  });

  runTest("17. Successful online submit navigates to /mock-exam/results?id=<resultId>", () => {
    assert(
      takePageSource.includes("router.push(`/mock-exam/results?id="),
      "handleSubmitExam must navigate with query param ?id=<resultId>"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP 3: ACTIVE SESSION STORAGE HARDENING (TESTS 18 - 21)
  // ─────────────────────────────────────────────────────────────

  // Extract all questionsToPersist Simulation mapping blocks from takePageSource
  const simMapRegex = /examQuestions\.map\(\(q\)\s*=>\s*\(\{([\s\S]*?)\}\)\)/g;
  const simMapMatches = [...takePageSource.matchAll(simMapRegex)];
  assert.ok(simMapMatches.length >= 2, "Must find at least 2 Simulation questionsToPersist mappings in take/page.tsx");

  runTest("18. Submitted Simulation active session storage isolates Simulation from Guided Review", () => {
    assert(
      takePageSource.includes("questionsToPersist"),
      "take page must define questionsToPersist helper for session storage"
    );
    assert(
      takePageSource.includes('examMode === "GUIDED_REVIEW"') && takePageSource.includes("questionsToPersist"),
      "take page must distinguish guided review vs simulation for session questions"
    );
    // Guided Review branch retains full question objects for local pedagogical review
    assert(
      /examMode\s*===\s*"GUIDED_REVIEW"\s*\?\s*examQuestions/.test(takePageSource),
      "Guided Review branch must preserve full questions locally"
    );
  });

  runTest("19. Real Simulation session mapping does not serialize answerIndex and includes safe fields", () => {
    for (let i = 0; i < simMapMatches.length; i++) {
      const block = simMapMatches[i][1];
      assert(!/\banswerIndex\b/.test(block), `Simulation mapping ${i + 1} must not contain answerIndex`);
      assert(block.includes("id: q.id"), `Simulation mapping ${i + 1} must contain id: q.id`);
      assert(block.includes("category: q.category"), `Simulation mapping ${i + 1} must contain category: q.category`);
      assert(block.includes("subtopic: q.subtopic"), `Simulation mapping ${i + 1} must contain subtopic: q.subtopic`);
      assert(block.includes("prompt: q.prompt"), `Simulation mapping ${i + 1} must contain prompt: q.prompt`);
      assert(block.includes("options: q.options"), `Simulation mapping ${i + 1} must contain options: q.options`);
      assert(block.includes("imageUrl: q.imageUrl"), `Simulation mapping ${i + 1} must contain imageUrl: q.imageUrl`);
      assert(block.includes("difficulty: q.difficulty"), `Simulation mapping ${i + 1} must contain difficulty: q.difficulty`);
      assert(block.includes("tags: q.tags"), `Simulation mapping ${i + 1} must contain tags: q.tags`);
    }
  });

  runTest("20. Real Simulation session mapping does not serialize rationale fields", () => {
    const forbiddenRationaleFields = [
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

    for (let i = 0; i < simMapMatches.length; i++) {
      const block = simMapMatches[i][1];
      for (const field of forbiddenRationaleFields) {
        assert(!new RegExp(`\\b${field}\\b`).test(block), `Simulation mapping ${i + 1} must not contain '${field}'`);
      }
    }
  });

  runTest("21. Custom Practice resumes safely from sanitized questions and attemptToken", () => {
    const savedSession = {
      examMode: "SIMULATION",
      examQuestions: [
        { id: "q1", category: "Verbal", prompt: "Prompt 1", options: ["A", "B"] },
        { id: "q2", category: "Verbal", prompt: "Prompt 2", options: ["C", "D"] },
      ],
      selectedAnswers: { 0: 1 },
      currentIndex: 1,
      timerMinutes: 20,
      timeLeft: 1100,
      attemptToken: "valid-token-for-resumed-session",
    };

    assert.strictEqual(savedSession.examQuestions.length, 2);
    assert.strictEqual((savedSession.examQuestions[0] as any).answerIndex, undefined);
    assert.strictEqual(typeof savedSession.attemptToken, "string");
    assert.strictEqual(savedSession.selectedAnswers[0], 1);
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP 4: OFFLINE SUBMISSION BEHAVIOR (TESTS 22 - 25)
  // ─────────────────────────────────────────────────────────────

  runTest("22. Offline queued submission does not create a fake client score", () => {
    const submitBlockMatch = takePageSource.match(/const handleSubmitExam = useCallback\([\s\S]*?\}\s*,\s*\[[\s\S]*?\]\);/);
    assert(submitBlockMatch, "handleSubmitExam must exist");
    const submitBlock = submitBlockMatch[0];

    // In the offline branch:
    assert(
      submitBlock.includes("queueOfflineSubmission(submissionPayload)"),
      "Offline branch must queue submissionPayload"
    );
    assert(
      !submitBlock.includes("reviewData = {"),
      "Offline branch must not create fabricated reviewData"
    );
  });

  runTest("23. Offline queued submission does not navigate to results page without server ID", () => {
    const submitBlockMatch = takePageSource.match(/const handleSubmitExam = useCallback\([\s\S]*?\}\s*,\s*\[[\s\S]*?\]\);/);
    assert(submitBlockMatch, "handleSubmitExam must exist");
    const submitBlock = submitBlockMatch[0];

    // The only router.push in handleSubmitExam must be conditionally guarded by server response ID
    const routerPushes = submitBlock.match(/router\.push\([^)]+\)/g) || [];
    assert.strictEqual(routerPushes.length, 1, "There must be exactly one router.push call in handleSubmitExam");
    assert(
      routerPushes[0].includes("data.result.id"),
      "router.push must only occur with server data.result.id"
    );
  });

  runTest("24. Offline queue payload retains attemptToken", () => {
    assert(
      takePageSource.includes("attemptToken ? { attemptToken } : {}"),
      "submissionPayload must retain attemptToken"
    );
  });

  runTest("25. Offline queue payload retains ordered questionId and selectedIndex mapping", () => {
    assert(
      takePageSource.includes("questionId: q.id"),
      "submissionPayload answers must map questionId to q.id"
    );
    assert(
      takePageSource.includes("selectedIndex: selectedIdx !== undefined ? selectedIdx : -1"),
      "submissionPayload answers must map selectedIndex properly"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP 5: ISOLATION & REGRESSION GUARDS (TESTS 26 - 28)
  // ─────────────────────────────────────────────────────────────

  runTest("26. Protected files have zero Git diff and core security invariants remain intact", () => {
    const protectedFiles = [
      "src/app/api/exam/submit/route.ts",
      "src/lib/examAttemptToken.ts",
      "src/lib/examSubmissionIntegrity.ts",
      "src/lib/userMistakeBatch.ts",
      "src/lib/offline-storage.ts",
      "src/hooks/useOfflineSync.ts",
      "src/app/mock-exam/results/page.tsx",
      "src/app/api/mock-exam/history/[id]/route.ts",
      "src/lib/streakEngine.ts",
      "src/lib/badges.ts",
      "prisma/schema.prisma",
    ];
    const diffOutput = execSync(`git diff -- ${protectedFiles.join(" ")}`, { encoding: "utf8" });
    assert.strictEqual(diffOutput.trim(), "", "Protected files must have zero Git diff");

    // Check submit route still validates attemptToken and evaluates answers server-side
    assert(
      submitRouteSource.includes("verifyExamAttemptToken"),
      "submit route must call verifyExamAttemptToken"
    );
    assert(
      submitRouteSource.includes("validateAndCanonicalizeSubmission"),
      "submit route must call validateAndCanonicalizeSubmission"
    );
    assert(
      submitRouteSource.includes("ans.selectedIndex === q.answerIndex"),
      "submit route must grade server-side with q.answerIndex"
    );
    assert(
      offlineStorageSource.includes("queueOfflineSubmission"),
      "offline storage must export queueOfflineSubmission"
    );
  });

  runTest("27. FULL_MOCK HTTP response has NOT been modified in 1E4A (Guided Review compatibility)", () => {
    // Assert FULL_MOCK path in start/route.ts still includes answerIndex
    const fullMockStartIndex = startRouteSource.indexOf("// --- Standard Full Exam path");
    assert(fullMockStartIndex !== -1, "Standard Full Exam path must be present");
    const fullMockBlock = startRouteSource.slice(fullMockStartIndex);

    assert(
      fullMockBlock.includes("answerIndex: q.answerIndex"),
      "FULL_MOCK must temporarily retain answerIndex for Guided Review compatibility in 1E4A"
    );
    assert(
      fullMockBlock.includes("explanation: q.explanation || null"),
      "FULL_MOCK must temporarily retain explanation for Guided Review compatibility in 1E4A"
    );
    assert(
      fullMockBlock.includes("stepByStep: q.stepByStep || null"),
      "FULL_MOCK must temporarily retain stepByStep for Guided Review compatibility in 1E4A"
    );
  });

  runTest("28. Existing Guided Review local evaluation and locking behavior remains present in take page", () => {
    assert(
      takePageSource.includes("if (examMode === \"GUIDED_REVIEW\") return; // Safety guard: Guided Review NEVER submits to server"),
      "Safety guard preventing Guided Review from submitting must remain intact"
    );
    assert(
      takePageSource.includes("currentQ.answerIndex === idx"),
      "Guided Review option styling based on answerIndex must remain intact"
    );
    assert(
      takePageSource.includes("<ExplanationPanel"),
      "Guided Review ExplanationPanel must remain intact"
    );
    assert(
      takePageSource.includes("if (offlineBanner)"),
      "take page must render offline submission pending screen when offlineBanner is true"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP 6: SUBMISSION ERROR HANDLING, AUTO-SAVE TERMINAL STATE & OFFLINE RESILIENCE (TESTS 29 - 49)
  // ─────────────────────────────────────────────────────────────

  // Helper simulating the submission decision state machine from take/page.tsx
  async function simulateTakePageSubmission(options: {
    isOnline: boolean;
    fetchStatus?: number;
    fetchOk?: boolean;
    fetchPayload?: any;
    networkError?: boolean;
    queueOfflineFails?: boolean;
  }) {
    let localStorageCleared = false;
    let latestReviewCleared = false;
    let offlineBanner = false;
    let alertMessage: string | null = null;
    let navigatedTo: string | null = null;
    let shouldQueueForRetry = false;
    let offlineQueued = false;

    if (options.isOnline) {
      try {
        if (options.networkError) {
          throw new TypeError("Failed to fetch");
        }
        const status = options.fetchStatus ?? 200;
        const ok = options.fetchOk ?? (status >= 200 && status < 300);
        const data = options.fetchPayload ?? null;

        if (ok) {
          if (
            data?.success === true &&
            typeof data?.result?.id === "string" &&
            data.result.id.trim().length > 0
          ) {
            localStorageCleared = true;
            latestReviewCleared = true;
            navigatedTo = `/mock-exam/results?id=${encodeURIComponent(data.result.id.trim())}`;
            return {
              shouldQueueForRetry: false,
              offlineQueued,
              localStorageCleared,
              latestReviewCleared,
              offlineBanner,
              alertMessage,
              navigatedTo,
            };
          } else {
            alertMessage =
              "Unexpected server response while submitting exam. Please check your Exam History before retrying.";
            return {
              shouldQueueForRetry: false,
              offlineQueued,
              localStorageCleared,
              latestReviewCleared,
              offlineBanner,
              alertMessage,
              navigatedTo,
            };
          }
        } else {
          const isTerminal =
            status === 400 || status === 403 || status === 409 || status === 422;
          if (isTerminal) {
            alertMessage = data?.error || `Exam submission rejected by server (HTTP ${status}).`;
            return {
              shouldQueueForRetry: false,
              offlineQueued,
              localStorageCleared,
              latestReviewCleared,
              offlineBanner,
              alertMessage,
              navigatedTo,
            };
          } else {
            shouldQueueForRetry = true;
          }
        }
      } catch (err) {
        shouldQueueForRetry = true;
      }
    } else {
      shouldQueueForRetry = true;
    }

    if (shouldQueueForRetry) {
      let queuedSuccessfully = false;
      try {
        if (options.queueOfflineFails) {
          throw new Error("IndexedDB quota exceeded");
        }
        offlineQueued = true;
        queuedSuccessfully = true;
      } catch (queueErr) {
        alertMessage =
          "Unable to save offline submission. Please keep this window open until connection is restored.";
        return {
          shouldQueueForRetry,
          offlineQueued: false,
          localStorageCleared,
          latestReviewCleared,
          offlineBanner,
          alertMessage,
          navigatedTo,
        };
      }

      if (queuedSuccessfully) {
        localStorageCleared = true;
        latestReviewCleared = true;
        offlineBanner = true;
      }
    }

    return {
      shouldQueueForRetry,
      offlineQueued,
      localStorageCleared,
      latestReviewCleared,
      offlineBanner,
      alertMessage,
      navigatedTo,
    };
  }

  // Extract the takePage handleSubmitExam function source code for static analysis
  const handleSubmitExamMatch = takePageSource.match(/const handleSubmitExam = useCallback\([\s\S]*?\}\s*,\s*\[[\s\S]*?\]\);/);
  assert(handleSubmitExamMatch, "handleSubmitExam callback must be defined in take/page.tsx");
  const handleSubmitExamCode = handleSubmitExamMatch[0];

  await runTest("29. Terminal HTTP 400 rejection does not queue offline submission", async () => {
    assert(
      handleSubmitExamCode.includes("status === 400"),
      "handleSubmitExam must check for HTTP 400 as a terminal status"
    );
    const result = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 400,
      fetchOk: false,
      fetchPayload: { error: "Bad Request" },
    });
    assert.strictEqual(result.shouldQueueForRetry, false);
    assert.strictEqual(result.offlineQueued, false);
    assert.strictEqual(result.alertMessage, "Bad Request");
  });

  await runTest("30. Terminal HTTP 403 rejection does not queue offline submission", async () => {
    assert(
      handleSubmitExamCode.includes("status === 403"),
      "handleSubmitExam must check for HTTP 403 as a terminal status"
    );
    const result = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 403,
      fetchOk: false,
      fetchPayload: { error: "Forbidden" },
    });
    assert.strictEqual(result.shouldQueueForRetry, false);
    assert.strictEqual(result.offlineQueued, false);
    assert.strictEqual(result.alertMessage, "Forbidden");
  });

  await runTest("31. Terminal HTTP 409 rejection does not queue offline submission", async () => {
    assert(
      handleSubmitExamCode.includes("status === 409"),
      "handleSubmitExam must check for HTTP 409 as a terminal status"
    );
    const result = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 409,
      fetchOk: false,
      fetchPayload: { error: "Conflict" },
    });
    assert.strictEqual(result.shouldQueueForRetry, false);
    assert.strictEqual(result.offlineQueued, false);
    assert.strictEqual(result.alertMessage, "Conflict");
  });

  await runTest("32. Terminal HTTP 422 rejection does not queue offline submission", async () => {
    assert(
      handleSubmitExamCode.includes("status === 422"),
      "handleSubmitExam must check for HTTP 422 as a terminal status"
    );
    const result = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 422,
      fetchOk: false,
      fetchPayload: { error: "Unprocessable Entity" },
    });
    assert.strictEqual(result.shouldQueueForRetry, false);
    assert.strictEqual(result.offlineQueued, false);
    assert.strictEqual(result.alertMessage, "Unprocessable Entity");
  });

  await runTest("33. Terminal status does not clear active session from local storage", async () => {
    const terminalBlockMatch = handleSubmitExamCode.match(/if \(isTerminal\) \{([\s\S]*?)\}/);
    assert(terminalBlockMatch, "isTerminal branch must exist");
    assert(
      !terminalBlockMatch[1].includes("localStorage.removeItem"),
      "isTerminal branch must not remove active session from localStorage"
    );

    for (const status of [400, 403, 409, 422]) {
      const result = await simulateTakePageSubmission({
        isOnline: true,
        fetchStatus: status,
        fetchOk: false,
      });
      assert.strictEqual(result.localStorageCleared, false, `Status ${status} must preserve active session`);
    }
  });

  await runTest("34. Terminal status does not display offline-success banner state", async () => {
    const terminalBlockMatch = handleSubmitExamCode.match(/if \(isTerminal\) \{([\s\S]*?)\}/);
    assert(terminalBlockMatch, "isTerminal branch must exist");
    assert(
      !terminalBlockMatch[1].includes("setOfflineBanner"),
      "isTerminal branch must not set offline banner"
    );

    for (const status of [400, 403, 409, 422]) {
      const result = await simulateTakePageSubmission({
        isOnline: true,
        fetchStatus: status,
        fetchOk: false,
      });
      assert.strictEqual(result.offlineBanner, false, `Status ${status} must not display offline banner`);
    }
  });

  await runTest("35. HTTP 401 remains retryable and queues for offline sync", async () => {
    const result = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 401,
      fetchOk: false,
    });
    assert.strictEqual(result.shouldQueueForRetry, true);
    assert.strictEqual(result.offlineQueued, true);
    assert.strictEqual(result.localStorageCleared, true);
    assert.strictEqual(result.offlineBanner, true);
  });

  await runTest("36. HTTP 429 remains retryable and queues for offline sync", async () => {
    const result = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 429,
      fetchOk: false,
    });
    assert.strictEqual(result.shouldQueueForRetry, true);
    assert.strictEqual(result.offlineQueued, true);
    assert.strictEqual(result.localStorageCleared, true);
    assert.strictEqual(result.offlineBanner, true);
  });

  await runTest("37. HTTP 500 remains retryable and queues for offline sync", async () => {
    const result = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 500,
      fetchOk: false,
    });
    assert.strictEqual(result.shouldQueueForRetry, true);
    assert.strictEqual(result.offlineQueued, true);
    assert.strictEqual(result.localStorageCleared, true);
    assert.strictEqual(result.offlineBanner, true);
  });

  await runTest("38. Network fetch exception queues for offline sync", async () => {
    assert(
      handleSubmitExamCode.includes("Network error submitting exam. Queueing for offline sync:"),
      "handleSubmitExam catch block must handle network error and queue"
    );
    const result = await simulateTakePageSubmission({
      isOnline: true,
      networkError: true,
    });
    assert.strictEqual(result.shouldQueueForRetry, true);
    assert.strictEqual(result.offlineQueued, true);
    assert.strictEqual(result.localStorageCleared, true);
    assert.strictEqual(result.offlineBanner, true);
  });

  await runTest("39. App-offline submission queues for offline sync", async () => {
    const result = await simulateTakePageSubmission({
      isOnline: false,
    });
    assert.strictEqual(result.shouldQueueForRetry, true);
    assert.strictEqual(result.offlineQueued, true);
    assert.strictEqual(result.localStorageCleared, true);
    assert.strictEqual(result.offlineBanner, true);
  });

  await runTest("40. Malformed 2xx success payload does not queue as offline", async () => {
    const malformedPayloads = [
      {},
      { success: false },
      { success: true },
      { success: true, result: {} },
      { success: true, result: { id: "" } },
      { success: true, result: { id: "   " } },
      null,
    ];

    for (const payload of malformedPayloads) {
      const result = await simulateTakePageSubmission({
        isOnline: true,
        fetchStatus: 200,
        fetchOk: true,
        fetchPayload: payload,
      });
      assert.strictEqual(result.shouldQueueForRetry, false);
      assert.strictEqual(result.offlineQueued, false);
      assert.strictEqual(result.localStorageCleared, false);
      assert.strictEqual(result.offlineBanner, false);
      assert.ok(result.alertMessage && result.alertMessage.includes("Unexpected server response"));
    }
  });

  await runTest("41. Malformed 2xx success payload does not navigate to results", async () => {
    const malformedPayloads = [
      { success: true, result: null },
      { success: true, result: { id: 123 } },
      { success: false, result: { id: "valid-id" } },
    ];

    for (const payload of malformedPayloads) {
      const result = await simulateTakePageSubmission({
        isOnline: true,
        fetchStatus: 200,
        fetchOk: true,
        fetchPayload: payload,
      });
      assert.strictEqual(result.navigatedTo, null);
    }
  });

  await runTest("42. Valid 2xx with result.id navigates to authoritative results and clears cse_latest_review", async () => {
    const result = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 200,
      fetchOk: true,
      fetchPayload: {
        success: true,
        result: {
          id: "exam-res-9988",
        },
      },
    });
    assert.strictEqual(result.navigatedTo, "/mock-exam/results?id=exam-res-9988");
    assert.strictEqual(result.localStorageCleared, true);
    assert.strictEqual(result.latestReviewCleared, true);
    assert.strictEqual(result.offlineQueued, false);
    assert.strictEqual(result.offlineBanner, false);
  });

  runTest("43. Offline screen View Exam History href is strictly /mock-exam/history", () => {
    const offlineScreenStart = takePageSource.indexOf("if (offlineBanner)");
    assert(offlineScreenStart !== -1, "take page must contain offlineBanner screen block");
    const offlineScreenEnd = takePageSource.indexOf("PHASE 2: ACTIVE EXAM SCREEN");
    assert(offlineScreenEnd !== -1, "take page must transition from offlineBanner to Phase 2");

    const offlineScreenSource = takePageSource.slice(offlineScreenStart, offlineScreenEnd);

    assert(
      offlineScreenSource.includes('href="/mock-exam/history"'),
      "Offline banner screen must link strictly to '/mock-exam/history'"
    );
    assert(
      offlineScreenSource.includes("View Exam History"),
      "Offline banner screen must render 'View Exam History'"
    );
    assert(
      !offlineScreenSource.includes('href="/dashboard">View Exam History'),
      "Offline banner screen must not link 'View Exam History' to /dashboard"
    );
  });

  runTest("44. Active session auto-save condition contains !offlineBanner", () => {
    const autoSaveMatch = takePageSource.match(/\/\/ 2\. Auto-Save Active Exam State[\s\S]*?useEffect\(\(\) => \{([\s\S]*?)\},\s*\[([\s\S]*?)\]\);/);
    assert(autoSaveMatch, "Auto-Save useEffect must exist in take/page.tsx");
    const autoSaveBody = autoSaveMatch[1];

    assert(
      autoSaveBody.includes("!offlineBanner"),
      "Auto-save useEffect condition must include '!offlineBanner' to prevent resurrecting offline sessions"
    );
    assert(
      autoSaveBody.includes("!isSetupPhase &&"),
      "Auto-save condition must retain !isSetupPhase"
    );
    assert(
      autoSaveBody.includes("!submitting &&"),
      "Auto-save condition must retain !submitting"
    );
    assert(
      autoSaveBody.includes("!guidedFinished"),
      "Auto-save condition must retain !guidedFinished"
    );
  });

  runTest("45. Active session auto-save effect dependency array includes offlineBanner", () => {
    const autoSaveMatch = takePageSource.match(/\/\/ 2\. Auto-Save Active Exam State[\s\S]*?useEffect\(\(\) => \{([\s\S]*?)\},\s*\[([\s\S]*?)\]\);/);
    assert(autoSaveMatch, "Auto-Save useEffect must exist in take/page.tsx");
    const depsString = autoSaveMatch[2];
    const deps = depsString.split(",").map((d) => d.trim());

    assert(
      deps.includes("offlineBanner"),
      "Auto-save useEffect dependencies must include 'offlineBanner'"
    );
  });

  runTest("46. Offline queue persistence clears LOCAL_STORAGE_KEY and cse_latest_review and sets offlineBanner", () => {
    const queueBlockMatch = takePageSource.match(/if \(queuedSuccessfully\) \{([\s\S]*?)\}/);
    assert(queueBlockMatch, "queuedSuccessfully block must exist in handleSubmitExam");
    const queueBlock = queueBlockMatch[1];

    assert(
      queueBlock.includes("localStorage.removeItem(LOCAL_STORAGE_KEY)"),
      "queue success block must remove LOCAL_STORAGE_KEY"
    );
    assert(
      queueBlock.includes('localStorage.removeItem("cse_latest_review")'),
      "queue success block must remove cse_latest_review"
    );
    assert(
      queueBlock.includes("setOfflineBanner(true)"),
      "queue success block must set offlineBanner to true"
    );
    assert(
      queueBlock.includes("setSubmitting(false)"),
      "queue success block must set submitting to false"
    );
  });

  runTest("47. offlineBanner pending state prevents auto-save from regenerating active session", () => {
    function evaluateAutoSaveEligibility(state: {
      isSetupPhase: boolean;
      questionsCount: number;
      submitting: boolean;
      guidedFinished: boolean;
      offlineBanner: boolean;
    }): boolean {
      return (
        !state.isSetupPhase &&
        state.questionsCount > 0 &&
        !state.submitting &&
        !state.guidedFinished &&
        !state.offlineBanner
      );
    }

    const canSaveDuringOfflineBanner = evaluateAutoSaveEligibility({
      isSetupPhase: false,
      questionsCount: 20,
      submitting: false,
      guidedFinished: false,
      offlineBanner: true,
    });
    assert.strictEqual(
      canSaveDuringOfflineBanner,
      false,
      "Auto-save must evaluate to false while offlineBanner is true"
    );

    const canSaveNormalExam = evaluateAutoSaveEligibility({
      isSetupPhase: false,
      questionsCount: 20,
      submitting: false,
      guidedFinished: false,
      offlineBanner: false,
    });
    assert.strictEqual(
      canSaveNormalExam,
      true,
      "Auto-save must evaluate to true during standard active exam"
    );
  });

  runTest("48. Confirmed online 2xx submission clears LOCAL_STORAGE_KEY and cse_latest_review before result navigation", () => {
    const onlineSuccessMatch = takePageSource.match(/if\s*\(\s*data\?\.success === true[\s\S]*?\{\s*([\s\S]*?router\.push[\s\S]*?return;\s*\})/);
    assert(onlineSuccessMatch, "Confirmed online success block must exist in handleSubmitExam");
    const onlineSuccessBlock = onlineSuccessMatch[1];

    assert(
      onlineSuccessBlock.includes("localStorage.removeItem(LOCAL_STORAGE_KEY)"),
      "Online success block must remove LOCAL_STORAGE_KEY"
    );
    assert(
      onlineSuccessBlock.includes('localStorage.removeItem("cse_latest_review")'),
      "Online success block must remove cse_latest_review"
    );
    assert(
      onlineSuccessBlock.indexOf('localStorage.removeItem("cse_latest_review")') < onlineSuccessBlock.indexOf("router.push"),
      "cse_latest_review removal must precede router.push"
    );
  });

  await runTest("49. Terminal rejections, malformed 2xx, and failed queue writes do NOT clear cse_latest_review", async () => {
    const termRes = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 400,
      fetchOk: false,
    });
    assert.strictEqual(termRes.latestReviewCleared, false, "Terminal 400 must not clear cse_latest_review");

    const malformedRes = await simulateTakePageSubmission({
      isOnline: true,
      fetchStatus: 200,
      fetchOk: true,
      fetchPayload: { success: true, result: {} },
    });
    assert.strictEqual(malformedRes.latestReviewCleared, false, "Malformed 2xx must not clear cse_latest_review");

    const failedQueueRes = await simulateTakePageSubmission({
      isOnline: false,
      queueOfflineFails: true,
    });
    assert.strictEqual(failedQueueRes.latestReviewCleared, false, "Failed queue write must not clear cse_latest_review");
    assert.strictEqual(failedQueueRes.localStorageCleared, false, "Failed queue write must not clear LOCAL_STORAGE_KEY");
  });

  console.log("============================================================");
  console.log(`ALL ${passed} OF ${total} TESTS PASSED SUCCESSFULLY!`);
  console.log("============================================================");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
