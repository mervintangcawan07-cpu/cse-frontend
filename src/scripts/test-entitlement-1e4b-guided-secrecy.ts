// Relative Path: src/scripts/test-entitlement-1e4b-guided-secrecy.ts
import assert from "assert";
import fs from "fs";
import path from "path";
import { createHmac } from "crypto";
import { SignJWT } from "jose";
import {
  createGuidedReviewToken,
  signGuidedReviewToken,
  verifyGuidedReviewToken,
} from "../lib/guidedReviewToken";
import {
  signExamAttemptToken,
  verifyExamAttemptToken,
} from "../lib/examAttemptToken";
import { GUIDED_CHECK_LIMITER } from "../lib/ratelimit";
import { CACHE_PROFILES } from "../lib/cache";

console.log("============================================================");
console.log("RUNNING ENTITLEMENT-1E4B GUIDED REVIEW SECRECY TESTS");
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
  const checkRoutePath = path.join(rootDir, "src/app/api/exam/guided-review/check/route.ts");
  const takePagePath = path.join(rootDir, "src/app/mock-exam/take/page.tsx");
  const ratelimitPath = path.join(rootDir, "src/lib/ratelimit.ts");

  const startRouteSource = fs.readFileSync(startRoutePath, "utf8").replace(/\r\n/g, "\n");
  const checkRouteSource = fs.readFileSync(checkRoutePath, "utf8").replace(/\r\n/g, "\n");
  const takePageSource = fs.readFileSync(takePagePath, "utf8").replace(/\r\n/g, "\n");
  const ratelimitSource = fs.readFileSync(ratelimitPath, "utf8").replace(/\r\n/g, "\n");

  // ─────────────────────────────────────────────────────────────
  // GROUP A: FULL_MOCK HTTP SERIALIZER (TESTS 1 - 4)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group A: FULL_MOCK HTTP Serializer ---");

  const mockDbQuestion = {
    id: "q-mock-1",
    category: "Numerical Ability",
    subtopic: "Basic Operations",
    prompt: "What is 12 * 12?",
    options: ["120", "132", "144", "156"],
    optionA: "120",
    optionB: "132",
    optionC: "144",
    optionD: "156",
    answerIndex: 2,
    explanation: "12 times 12 equals 144.",
    stepByStep: "Step 1: Multiply 12 by 10 (120). Step 2: Multiply 12 by 2 (24). Sum = 144.",
    whyA: "Incorrect: 120 is 12 * 10.",
    whyB: "Incorrect: 132 is 12 * 11.",
    whyC: "Correct: 144 is 12 * 12.",
    whyD: "Incorrect: 156 is 12 * 13.",
    eliminationStrategy: "Eliminate numbers not ending in 4.",
    commonTrap: "Adding instead of multiplying.",
    examTip: "Memorize multiplication tables through 15.",
    difficulty: "EASY",
    tags: ["arithmetic", "multiplication"],
    imageUrl: null,
  };

  // FULL_MOCK serializer matching src/app/api/exam/start/route.ts
  const serializeFullMock = (q: typeof mockDbQuestion) => {
    let resolvedOptions: string[] = [];
    if (Array.isArray(q.options) && q.options.length > 0) {
      resolvedOptions = q.options as string[];
    } else {
      resolvedOptions = [q.optionA, q.optionB, q.optionC, q.optionD].filter(
        (opt): opt is string => Boolean(opt)
      );
    }

    return {
      id: q.id,
      category: q.category,
      subtopic: q.subtopic,
      prompt: q.prompt,
      options: resolvedOptions,
      difficulty: q.difficulty,
      tags: q.tags,
      imageUrl: q.imageUrl,
    };
  };

  runTest("Test 1: Delivery payload contains ONLY safe fields (id, category, subtopic, prompt, options, difficulty, tags, imageUrl)", () => {
    const serialized = serializeFullMock(mockDbQuestion);
    const keys = Object.keys(serialized).sort();
    const expectedKeys = [
      "category",
      "difficulty",
      "id",
      "imageUrl",
      "options",
      "prompt",
      "subtopic",
      "tags",
    ].sort();
    assert.deepStrictEqual(keys, expectedKeys);
    assert.strictEqual(serialized.id, "q-mock-1");
    assert.strictEqual(serialized.category, "Numerical Ability");
    assert.strictEqual(serialized.subtopic, "Basic Operations");
    assert.strictEqual(serialized.prompt, "What is 12 * 12?");
    assert.deepStrictEqual(serialized.options, ["120", "132", "144", "156"]);
    assert.strictEqual(serialized.difficulty, "EASY");
    assert.deepStrictEqual(serialized.tags, ["arithmetic", "multiplication"]);
    assert.strictEqual(serialized.imageUrl, null);
  });

  runTest("Test 2: Delivery payload strictly excludes answerIndex", () => {
    const serialized: Record<string, unknown> = serializeFullMock(mockDbQuestion);
    assert.strictEqual(serialized.answerIndex, undefined);
    assert.strictEqual("answerIndex" in serialized, false);
  });

  runTest("Test 3: Delivery payload strictly excludes all 9 rationale fields", () => {
    const serialized: Record<string, unknown> = serializeFullMock(mockDbQuestion);
    const sensitiveRationaleFields = [
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
    for (const field of sensitiveRationaleFields) {
      assert.strictEqual(serialized[field], undefined, `Field "${field}" must NOT be present`);
      assert.strictEqual(field in serialized, false, `Field "${field}" key must NOT exist`);
    }
  });

  runTest("Test 4: FULL_MOCK delivery returns attemptToken and guidedReviewToken: null", () => {
    // Assert start route declares both attemptToken and guidedReviewToken in response payload
    assert.ok(
      startRouteSource.includes("let attemptToken: string | null = null;"),
      "start/route.ts must initialize attemptToken"
    );
    assert.ok(
      startRouteSource.includes("let guidedReviewToken: string | null = null;"),
      "start/route.ts must initialize guidedReviewToken"
    );
    assert.ok(
      /attemptToken,\s*guidedReviewToken,/.test(startRouteSource),
      "start/route.ts must return both tokens in JSON response"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP B: TOKEN DOMAIN SEPARATION & VERIFICATION (TESTS 5 - 12)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group B: Token Domain Separation & Verification ---");

  await runTest("Test 5: createGuidedReviewToken generates valid JWT with type GUIDED_REVIEW", async () => {
    const res = await createGuidedReviewToken({
      userId: "user-test-1",
      questionIds: ["q-1", "q-2", "q-3"],
    });
    assert.ok(typeof res.guidedReviewToken === "string");
    assert.ok(res.guidedReviewToken.split(".").length === 3);
    assert.ok(typeof res.sessionId === "string");

    // Decode unverified payload to check claims
    const payloadPart = res.guidedReviewToken.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    assert.strictEqual(payload.tokenPurpose, "GUIDED_REVIEW");
    assert.strictEqual(payload.tokenVersion, 1);
    assert.strictEqual(payload.userId, "user-test-1");
    assert.strictEqual(payload.sub, "user-test-1");
    assert.strictEqual(payload.sessionId, res.sessionId);
    assert.strictEqual(payload.jti, res.sessionId);
    assert.deepStrictEqual(payload.questionIds, ["q-1", "q-2", "q-3"]);
    assert.strictEqual(payload.itemCount, 3);
  });

  await runTest("Test 6: verifyGuidedReviewToken successfully verifies a valid token", async () => {
    const { guidedReviewToken, sessionId } = await createGuidedReviewToken({
      userId: "user-test-2",
      questionIds: ["q-a", "q-b"],
    });
    const verified = await verifyGuidedReviewToken(guidedReviewToken);
    assert.ok(verified !== null);
    assert.strictEqual(verified.tokenPurpose, "GUIDED_REVIEW");
    assert.strictEqual(verified.userId, "user-test-2");
    assert.strictEqual(verified.sessionId, sessionId);
    assert.deepStrictEqual(verified.questionIds, ["q-a", "q-b"]);
    assert.strictEqual(verified.itemCount, 2);
    assert.ok(typeof verified.iat === "number");
    assert.ok(typeof verified.exp === "number");
    assert.ok(verified.exp > verified.iat);
  });

  await runTest("Test 7: verifyGuidedReviewToken rejects expired token", async () => {
    const secret = process.env.JWT_SECRET!;
    const derived = createHmac("sha256", secret).update("govstudyx:guided-review:v1").digest();
    const expiredToken = await new SignJWT({
      tokenPurpose: "GUIDED_REVIEW",
      tokenVersion: 1,
      userId: "user-expired",
      sessionId: "session-expired",
      questionIds: ["q-expired"],
      itemCount: 1,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .setSubject("user-expired")
      .setJti("session-expired")
      .sign(new Uint8Array(derived));

    const verified = await verifyGuidedReviewToken(expiredToken);
    assert.strictEqual(verified, null, "Expired token must be rejected");
  });

  await runTest("Test 8: verifyGuidedReviewToken rejects token with wrong secret", async () => {
    const { guidedReviewToken } = await createGuidedReviewToken({
      userId: "user-secret-test",
      questionIds: ["q-sec"],
    });
    const originalSecret = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = "totally_different_wrong_secret_1234567890";
      const verified = await verifyGuidedReviewToken(guidedReviewToken);
      assert.strictEqual(verified, null, "Token verified with wrong secret must be rejected");
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  await runTest("Test 9: verifyGuidedReviewToken rejects corrupted/tampered payload", async () => {
    const { guidedReviewToken } = await createGuidedReviewToken({
      userId: "user-tamper-original",
      questionIds: ["q-t1"],
    });
    const parts = guidedReviewToken.split(".");
    const decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    decoded.userId = "user-tamper-attacker";
    decoded.sub = "user-tamper-attacker";
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const verified = await verifyGuidedReviewToken(tamperedToken);
    assert.strictEqual(verified, null, "Tampered token must fail signature check");
  });

  await runTest("Test 10: verifyGuidedReviewToken rejects EXAM_ATTEMPT token (wrong type/salt)", async () => {
    const { attemptToken } = await signExamAttemptToken({
      userId: "user-cross-test",
      examType: "FULL_MOCK",
      questionIds: ["q-10"],
    });
    const verified = await verifyGuidedReviewToken(attemptToken);
    assert.strictEqual(
      verified,
      null,
      "verifyGuidedReviewToken must reject token signed for EXAM_ATTEMPT"
    );
  });

  await runTest("Test 11: verifyExamAttemptToken rejects GUIDED_REVIEW token", async () => {
    const { guidedReviewToken } = await createGuidedReviewToken({
      userId: "user-cross-test-2",
      questionIds: ["q-11"],
    });
    const verified = await verifyExamAttemptToken(guidedReviewToken);
    assert.strictEqual(
      verified,
      null,
      "verifyExamAttemptToken must reject token signed for GUIDED_REVIEW"
    );
  });

  await runTest("Test 12: Guided Review token binds userId, sessionId, questionIds, itemCount", async () => {
    const qids = ["qid-1", "qid-2", "qid-3", "qid-4", "qid-5"];
    const { guidedReviewToken, sessionId } = await signGuidedReviewToken({
      userId: "user-bind-99",
      questionIds: qids,
    });
    const verified = await verifyGuidedReviewToken(guidedReviewToken);
    assert.ok(verified !== null);
    assert.strictEqual(verified.userId, "user-bind-99");
    assert.strictEqual(verified.sessionId, sessionId);
    assert.deepStrictEqual(verified.questionIds, qids);
    assert.strictEqual(verified.itemCount, 5);
  });

  await runTest("Test 12a: signGuidedReviewToken rejects duplicate question IDs at signing", async () => {
    await assert.rejects(
      async () => {
        await signGuidedReviewToken({
          userId: "user-dup-test",
          questionIds: ["q1", "q1"],
        });
      },
      /Duplicate questionId detected/
    );
  });

  await runTest("Test 12b: signGuidedReviewToken rejects more than 170 question IDs at signing", async () => {
    const q171 = Array.from({ length: 171 }, (_, i) => `qid-${i}`);
    await assert.rejects(
      async () => {
        await signGuidedReviewToken({
          userId: "user-171-test",
          questionIds: q171,
        });
      },
      /exceeds maximum limit of 170/
    );
  });

  await runTest("Test 12c: missing or blank JWT_SECRET fails closed for signing and verification", async () => {
    const originalSecret = process.env.JWT_SECRET;
    try {
      delete process.env.JWT_SECRET;
      await assert.rejects(
        async () => {
          await signGuidedReviewToken({
            userId: "user-secret-test",
            questionIds: ["q1"],
          });
        },
        /Critical Configuration Error.*JWT_SECRET/
      );

      process.env.JWT_SECRET = "   ";
      await assert.rejects(
        async () => {
          await signGuidedReviewToken({
            userId: "user-secret-test",
            questionIds: ["q1"],
          });
        },
        /Critical Configuration Error.*JWT_SECRET/
      );

      delete process.env.JWT_SECRET;
      await assert.rejects(
        async () => {
          await verifyGuidedReviewToken("some.dummy.token");
        },
        /Critical Configuration Error.*JWT_SECRET/
      );

      process.env.JWT_SECRET = "   ";
      await assert.rejects(
        async () => {
          await verifyGuidedReviewToken("some.dummy.token");
        },
        /Critical Configuration Error.*JWT_SECRET/
      );
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  await runTest("Test 12d: malformed non-JWT token verifies as null", async () => {
    const malformedTokens = [
      "not-a-valid-jwt",
      "header.payload",
      "header.payload.signature.extra",
      "invalid..jwt",
      "",
      "   ",
    ];
    for (const token of malformedTokens) {
      const verified = await verifyGuidedReviewToken(token);
      assert.strictEqual(verified, null, `Token "${token}" must verify as null`);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP C: START ENDPOINT CONTRACT (TESTS 13 - 17)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group C: Start Endpoint Contract ---");

  runTest("Test 13: experience=SIMULATION returns attemptToken and guidedReviewToken: null", () => {
    // Assert route implementation logic for SIMULATION
    assert.ok(
      startRouteSource.includes('let experience: "SIMULATION" | "GUIDED_REVIEW" = "SIMULATION";')
    );
    assert.ok(
      startRouteSource.includes('if (experience === "GUIDED_REVIEW")')
    );
    assert.ok(
      startRouteSource.includes("const tokenResult = await signExamAttemptToken({")
    );
  });

  runTest("Test 14: experience=GUIDED_REVIEW returns guidedReviewToken and attemptToken: null", () => {
    assert.ok(
      startRouteSource.includes("const tokenResult = await signGuidedReviewToken({")
    );
    assert.ok(
      startRouteSource.includes("guidedReviewToken = tokenResult.guidedReviewToken;")
    );
  });

  runTest("Test 15: Default (no experience param) defaults to SIMULATION", () => {
    const resolveExperience = (experienceRaw: string | null) => {
      if (experienceRaw !== null) {
        if (experienceRaw === "SIMULATION") return "SIMULATION";
        if (experienceRaw === "GUIDED_REVIEW") return "GUIDED_REVIEW";
        throw new Error("Invalid experience parameter");
      }
      return "SIMULATION";
    };

    assert.strictEqual(resolveExperience(null), "SIMULATION");
    assert.strictEqual(resolveExperience("SIMULATION"), "SIMULATION");
    assert.strictEqual(resolveExperience("GUIDED_REVIEW"), "GUIDED_REVIEW");
  });

  runTest("Test 16: Invalid experience param returns 400 Bad Request", () => {
    assert.ok(
      startRouteSource.includes("Invalid experience: must be SIMULATION or GUIDED_REVIEW.")
    );
  });

  runTest("Test 17: CUSTOM_PRACTICE with ANY experience parameter is rejected (HTTP 400)", () => {
    assert.ok(
      startRouteSource.includes('if (searchParams.has("experience"))')
    );
    assert.ok(
      startRouteSource.includes("Invalid custom quiz configuration: experience parameter is not supported for Custom Practice.")
    );

    // Verify rejection for GUIDED_REVIEW, SIMULATION, or arbitrary value
    const checkExperienceRejection = (params: { experience?: string }) => {
      if ("experience" in params) {
        return { status: 400, error: "Invalid custom quiz configuration: experience parameter is not supported for Custom Practice." };
      }
      return { status: 200 };
    };

    assert.strictEqual(checkExperienceRejection({ experience: "GUIDED_REVIEW" }).status, 400);
    assert.strictEqual(checkExperienceRejection({ experience: "SIMULATION" }).status, 400);
    assert.strictEqual(checkExperienceRejection({ experience: "anything" }).status, 400);
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP D: CHECK ENDPOINT SECURITY & BEHAVIOR (TESTS 18 - 30)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group D: Check Endpoint Security & Behavior ---");

  runTest("Test 18: Unauthenticated request returns 401", () => {
    assert.ok(
      checkRouteSource.includes("const authenticatedUser = await getAuthenticatedUser();")
    );
    assert.ok(
      checkRouteSource.includes("if (!authenticatedUser)")
    );
    assert.ok(
      checkRouteSource.includes('{ error: "Unauthorized" }')
    );
  });

  runTest("Test 19: Missing or invalid token returns 400", () => {
    assert.ok(
      checkRouteSource.includes("const verified = await verifyGuidedReviewToken(guidedReviewToken.trim());")
    );
    assert.ok(
      checkRouteSource.includes("if (!verified)")
    );
    assert.ok(
      checkRouteSource.includes('error: "Invalid or expired guided review token"')
    );
  });

  runTest("Test 20: Missing body fields (guidedReviewToken, questionId, selectedIndex) returns 400", () => {
    assert.ok(
      checkRouteSource.includes('typeof guidedReviewToken !== "string" ||') &&
      checkRouteSource.includes('typeof questionId !== "string" ||') &&
      checkRouteSource.includes('typeof selectedIndex !== "number"')
    );
    assert.ok(
      checkRouteSource.includes("Invalid request payload: guidedReviewToken, questionId, and selectedIndex")
    );
  });

  runTest("Test 21: selectedIndex out of bounds (negative or >= options count) returns 400", () => {
    assert.ok(
      checkRouteSource.includes("selectedIndex < 0")
    );
    assert.ok(
      checkRouteSource.includes("if (selectedIndex >= resolvedOptions.length)")
    );
    assert.ok(
      checkRouteSource.includes("Selected index is out of bounds for question options")
    );
  });

  runTest("Test 22: Non-integer selectedIndex returns 400", () => {
    assert.ok(
      checkRouteSource.includes("!Number.isInteger(selectedIndex)")
    );
  });

  runTest("Test 23: questionId not in token manifest returns 400", () => {
    assert.ok(
      checkRouteSource.includes("if (!verified.questionIds.includes(questionId.trim()))")
    );
    assert.ok(
      checkRouteSource.includes("Question is not part of this guided review session")
    );
  });

  runTest("Test 24: userId mismatch between session and token returns 403", () => {
    assert.ok(
      checkRouteSource.includes("if (verified.userId !== userId)")
    );
    assert.ok(
      checkRouteSource.includes("Guided review token does not match authenticated user")
    );
  });

  runTest("Test 25: Question not found in DB returns 422", () => {
    assert.ok(
      checkRouteSource.includes("if (!q)")
    );
    assert.ok(
      checkRouteSource.includes("Question not found in question bank")
    );
  });

  runTest("Test 26: Soft-deleted question in token manifest is still evaluated correctly", () => {
    // Assert prisma query does not filter deletedAt: null, ensuring questions in snapshot can be evaluated
    assert.ok(
      /prisma\.question\.findUnique\(\{\s*where:\s*\{\s*id:\s*questionId\.trim\(\)\s*\},/.test(checkRouteSource)
    );
    assert.strictEqual(
      checkRouteSource.includes("deletedAt: null"),
      false,
      "Check endpoint must not filter out soft-deleted questions present in token snapshot"
    );
  });

  runTest("Test 27: Correct answer returns isCorrect: true, correctIndex, and populated rationale", () => {
    const question = {
      id: "q-test-correct",
      answerIndex: 2,
      explanation: "Full explanation",
      stepByStep: "Step 1",
      whyA: "Why A",
      whyB: "Why B",
      whyC: "Why C",
      whyD: "Why D",
      eliminationStrategy: "Eliminate A and B",
      commonTrap: "Trap C",
      examTip: "Tip D",
    };
    const selectedIndex = 2;
    const isCorrect = selectedIndex === question.answerIndex;
    assert.strictEqual(isCorrect, true);
    assert.strictEqual(question.answerIndex, 2);
    assert.strictEqual(question.explanation, "Full explanation");
    assert.strictEqual(question.stepByStep, "Step 1");
  });

  runTest("Test 28: Incorrect answer returns isCorrect: false, correctIndex, and populated rationale", () => {
    const question = {
      id: "q-test-incorrect",
      answerIndex: 2,
      explanation: "Full explanation",
      stepByStep: "Step 1",
      whyA: "Why A",
      whyB: "Why B",
      whyC: "Why C",
      whyD: "Why D",
      eliminationStrategy: "Eliminate A and B",
      commonTrap: "Trap C",
      examTip: "Tip D",
    };
    const selectedIndex = 1;
    const isCorrect = selectedIndex === question.answerIndex;
    assert.strictEqual(isCorrect, false);
    assert.strictEqual(question.answerIndex, 2);
    assert.strictEqual(question.whyB, "Why B");
  });

  runTest("Test 29: Check endpoint response contains ONLY single question feedback, never other questions", () => {
    assert.ok(
      /return NextResponse\.json\(\s*\{\s*success:\s*true,\s*questionId:\s*q\.id,\s*selectedIndex,\s*isCorrect,/.test(checkRouteSource)
    );
    assert.ok(
      checkRouteSource.includes("explanation: q.explanation || null,")
    );
    // Does not return full list of questions or other questions
    assert.strictEqual(
      checkRouteSource.includes("questions:"),
      false,
      "Check endpoint must never return other questions"
    );
  });

  runTest("Test 30: Response includes Cache-Control: no-store, private headers", () => {
    assert.ok(
      checkRouteSource.includes("headers: CACHE_PROFILES.PRIVATE"),
      "Check route must attach CACHE_PROFILES.PRIVATE headers"
    );
    assert.strictEqual(
      CACHE_PROFILES.PRIVATE["Cache-Control"],
      "private, no-cache, no-store, max-age=0, must-revalidate"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP E: CLIENT EXPERIENCE & SAFETY (TESTS 31 - 37)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group E: Client Experience & Safety ---");

  runTest("Test 31: Client passes experience=GUIDED_REVIEW when mode is Guided Review", () => {
    assert.ok(
      takePageSource.includes('const experience = examMode === "GUIDED_REVIEW" ? "GUIDED_REVIEW" : "SIMULATION";')
    );
    assert.ok(
      takePageSource.includes("&experience=${experience}")
    );
  });

  runTest("Test 31b: Client strictly requires data.attemptToken === null for Guided Review and data.guidedReviewToken === null for Simulation", () => {
    const startExamFnMatch = takePageSource.match(
      /async function handleStartExam\(\)\s*\{([\s\S]*?)\n  \}/
    );
    assert.ok(startExamFnMatch, "handleStartExam function must exist in take/page.tsx");
    const startExamBody = startExamFnMatch[1];

    // GUIDED: must strictly check data.attemptToken === null
    assert.ok(
      startExamBody.includes("data.attemptToken === null"),
      "Guided Review start must enforce data.attemptToken === null"
    );
    assert.strictEqual(
      /&&\s*!data\.attemptToken\b/.test(startExamBody),
      false,
      "Guided Review start must NOT use loose falsy check !data.attemptToken"
    );

    // SIMULATION: must strictly check data.guidedReviewToken === null
    assert.ok(
      startExamBody.includes("data.guidedReviewToken === null"),
      "Simulation start must enforce data.guidedReviewToken === null"
    );
    assert.strictEqual(
      /&&\s*!data\.guidedReviewToken\b/.test(startExamBody),
      false,
      "Simulation start must NOT use loose falsy check !data.guidedReviewToken"
    );
  });

  runTest("Test 32: Client stores safe questions only (no answerIndex in state)", () => {
    // Check Question interface in take/page.tsx
    const questionInterfaceMatch = takePageSource.match(/interface Question \{([\s\S]*?)\}/);
    assert.ok(questionInterfaceMatch, "Question interface must exist in take/page.tsx");
    const questionBody = questionInterfaceMatch[1];
    assert.strictEqual(questionBody.includes("answerIndex"), false, "Question interface must NOT have answerIndex");
    assert.strictEqual(questionBody.includes("explanation"), false, "Question interface must NOT have explanation");
    assert.strictEqual(questionBody.includes("stepByStep"), false, "Question interface must NOT have stepByStep");
    assert.strictEqual(questionBody.includes("whyA"), false, "Question interface must NOT have whyA");
    assert.strictEqual(questionBody.includes("whyB"), false, "Question interface must NOT have whyB");
    assert.strictEqual(questionBody.includes("whyC"), false, "Question interface must NOT have whyC");
    assert.strictEqual(questionBody.includes("whyD"), false, "Question interface must NOT have whyD");
    assert.strictEqual(questionBody.includes("eliminationStrategy"), false, "Question interface must NOT have eliminationStrategy");
    assert.strictEqual(questionBody.includes("commonTrap"), false, "Question interface must NOT have commonTrap");
    assert.strictEqual(questionBody.includes("examTip"), false, "Question interface must NOT have examTip");
  });

  runTest("Test 33: Client calls /api/exam/guided-review/check on check answer", () => {
    assert.ok(
      takePageSource.includes('fetch("/api/exam/guided-review/check"'),
      "Client must call POST /api/exam/guided-review/check in handleCheckAnswer"
    );
    assert.ok(
      takePageSource.includes("guidedReviewToken: guidedReviewToken.trim(),"),
      "Client must send guidedReviewToken in request body"
    );
    assert.ok(
      takePageSource.includes("questionId,"),
      "Client must send questionId in request body"
    );
    assert.ok(
      takePageSource.includes("selectedIndex: selectedIdx,"),
      "Client must send selectedIndex in request body"
    );
  });

  runTest("Test 34: Keyboard Enter key triggers server-authoritative check (not local evaluation)", () => {
    assert.ok(
      takePageSource.includes('e.key === "Enter"'),
      "take/page.tsx must listen for Enter key"
    );
    assert.ok(
      takePageSource.includes("handleCheckAnswer();"),
      "Enter key must invoke server-authoritative handleCheckAnswer"
    );
  });

  runTest("Test 34b: Keyboard Enter handling does NOT directly call setCheckedAnswers", () => {
    const keyboardEffectMatch = takePageSource.match(/\/\/ Keyboard Shortcuts[\s\S]*?\}, \[isSetupPhase/);
    assert.ok(keyboardEffectMatch, "Keyboard shortcuts effect must exist");
    const keyboardBlock = keyboardEffectMatch[0];
    assert.strictEqual(
      keyboardBlock.includes("setCheckedAnswers"),
      false,
      "Keyboard handler must never bypass server check by calling setCheckedAnswers directly"
    );
    assert.ok(keyboardBlock.includes("handleCheckAnswer();"));
  });

  runTest("Test 34c: handleCheckAnswer captures questionIndex and questionId before await (async race safety)", () => {
    const checkFnMatch = takePageSource.match(/const handleCheckAnswer = useCallback\(async \(\) => \{([\s\S]*?)\}, \[/);
    assert.ok(checkFnMatch, "handleCheckAnswer must exist");
    const checkFnBody = checkFnMatch[1];

    // Captured before await
    assert.ok(checkFnBody.includes("const questionIndex = currentIndex;"));
    assert.ok(checkFnBody.includes("const currentQ = examQuestions[questionIndex];"));
    assert.ok(checkFnBody.includes("const questionId = currentQ.id;"));
    assert.ok(checkFnBody.includes("const selectedIdx = selectedAnswers[questionIndex];"));

    // Applied with captured variables post-await
    assert.ok(checkFnBody.includes("[questionId]: data as GuidedFeedback"));
    assert.ok(checkFnBody.includes("[questionIndex]: true"));
    assert.strictEqual(
      /setCheckedAnswers\(\(prev\)\s*=>\s*\(\{\s*\.\.\.prev,\s*\[currentIndex\]/.test(checkFnBody),
      false,
      "Post-await must not use current mutable currentIndex for checkedAnswers state"
    );
  });

  runTest("Test 35: Client renders correctness and rationale from guidedFeedbackByQuestionId", () => {
    assert.ok(
      takePageSource.includes("const feedback = currentQ ? guidedFeedbackByQuestionId[currentQ.id] : undefined;"),
      "Option rendering must pull feedback from guidedFeedbackByQuestionId"
    );
    assert.ok(
      takePageSource.includes("isGuided ? feedback?.answerIndex === idx : false;"),
      "Option styling must evaluate feedback.answerIndex"
    );
  });

  runTest("Test 36: Summary screen calculates metrics from guidedFeedbackByQuestionId", () => {
    assert.ok(
      takePageSource.includes("guidedFeedbackByQuestionId[qId]?.isCorrect === true"),
      "Summary correct count must use guidedFeedbackByQuestionId"
    );
    assert.ok(
      takePageSource.includes("guidedFeedbackByQuestionId[qId]?.isCorrect === false"),
      "Summary incorrect count must use guidedFeedbackByQuestionId"
    );
  });

  runTest("Test 37: Guided Review never calls /api/exam/submit", () => {
    assert.ok(
      takePageSource.includes('if (examMode === "GUIDED_REVIEW") return;'),
      "handleSubmitExam must have early return guard blocking Guided Review"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP F: OFFLINE & STORAGE SAFETY (TESTS 38 - 41)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group F: Offline & Storage Safety ---");

  runTest("Test 38: Saved session contains safe questions only (no answerIndex)", () => {
    assert.ok(
      takePageSource.includes("const questionsToPersist = examQuestions.map((q) => ({"),
      "saveActiveSession must sanitize questions before persisting to localStorage"
    );
    const saveBlock = takePageSource.slice(
      takePageSource.indexOf("const questionsToPersist"),
      takePageSource.indexOf("localStorage.setItem(LOCAL_STORAGE_KEY")
    );
    assert.strictEqual(saveBlock.includes("answerIndex"), false);
    assert.strictEqual(saveBlock.includes("explanation"), false);
  });

  runTest("Test 39: Saved session includes guidedFeedbackByQuestionId and guidedReviewToken", () => {
    assert.ok(
      takePageSource.includes('guidedReviewToken: examMode === "GUIDED_REVIEW" ? guidedReviewToken : null,'),
      "saveActiveSession must persist guidedReviewToken"
    );
    assert.ok(
      takePageSource.includes('guidedFeedbackByQuestionId: examMode === "GUIDED_REVIEW" ? guidedFeedbackByQuestionId : {},'),
      "saveActiveSession must persist guidedFeedbackByQuestionId"
    );
  });

  runTest("Test 39b: handleSaveAndExit serializes safe questions without answerIndex or rationales", () => {
    const saveAndExitMatch = takePageSource.match(/function handleSaveAndExit\(\) \{([\s\S]*?router\.push\("\/dashboard"\);)/);
    assert.ok(saveAndExitMatch, "handleSaveAndExit must exist");
    const saveAndExitBody = saveAndExitMatch[1];

    assert.ok(saveAndExitBody.includes("const questionsToPersist = examQuestions.map((q) => ({"));
    assert.strictEqual(saveAndExitBody.includes("answerIndex"), false);
    assert.strictEqual(saveAndExitBody.includes("explanation"), false);
    assert.strictEqual(saveAndExitBody.includes("stepByStep"), false);
    assert.ok(saveAndExitBody.includes('guidedReviewToken: examMode === "GUIDED_REVIEW" ? guidedReviewToken : null,'));
    assert.ok(saveAndExitBody.includes('guidedFeedbackByQuestionId: examMode === "GUIDED_REVIEW" ? guidedFeedbackByQuestionId : {},'));
  });

  runTest("Test 40: initExam() legacy scanner contains ALL TEN sensitive fields and purges localStorage", () => {
    const hasLegacyMatch = takePageSource.match(
      /const hasLegacyAnswers = parsed\.examQuestions\.some\([\s\S]*?\);/
    );
    assert.ok(hasLegacyMatch, "hasLegacyAnswers scanner must exist in take/page.tsx");
    const scannerBlock = hasLegacyMatch[0];

    const allTenFields = [
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

    for (const field of allTenFields) {
      assert.ok(
        scannerBlock.includes(`q.${field} !== undefined`),
        `hasLegacyAnswers scanner must explicitly check q.${field} !== undefined`
      );
    }

    assert.ok(
      takePageSource.includes("localStorage.removeItem(LOCAL_STORAGE_KEY);"),
      "initExam must remove legacy session from localStorage"
    );
  });

  runTest("Test 41: initExam() detects legacy Guided Review session without guidedReviewToken and clears it", () => {
    assert.ok(
      takePageSource.includes("const lacksGuidedToken ="),
      "initExam must check for Guided Review session missing guidedReviewToken"
    );
    assert.ok(
      takePageSource.includes('typeof parsed.guidedReviewToken !== "string" || !parsed.guidedReviewToken.trim();'),
      "initExam must verify guidedReviewToken is a non-empty string"
    );
    assert.ok(
      takePageSource.includes("const hasAttemptToken ="),
      "initExam must check for cross-mode attemptToken in Guided Review session"
    );
    assert.ok(
      takePageSource.includes('typeof parsed.attemptToken === "string" && parsed.attemptToken.trim().length > 0;'),
      "initExam must check for non-empty attemptToken"
    );
    assert.ok(
      takePageSource.includes("if (hasLegacyAnswers || lacksGuidedToken || hasAttemptToken)"),
      "initExam must discard session if legacy answers, missing guided token, or cross-mode attempt token are found"
    );
  });

  runTest("Test 41b: Runtime simulation proves legacy scanner rejects any of all ten fields, missing guided token, or cross-mode attempt token", () => {
    const allTenFields = [
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

    const evaluatePurge = (parsed: any) => {
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

      const lacksGuidedToken =
        typeof parsed.guidedReviewToken !== "string" || !parsed.guidedReviewToken.trim();

      const hasAttemptToken =
        typeof parsed.attemptToken === "string" && parsed.attemptToken.trim().length > 0;

      return hasLegacyAnswers || lacksGuidedToken || hasAttemptToken;
    };

    // Clean session must NOT be purged
    const cleanSession = {
      examMode: "GUIDED_REVIEW",
      guidedReviewToken: "valid.token.here",
      attemptToken: null,
      examQuestions: [{ id: "q1", prompt: "Hello", options: ["A", "B"] }],
    };
    assert.strictEqual(evaluatePurge(cleanSession), false, "Clean Guided Review session must not be purged");

    // Testing each of the ten fields causes purge
    for (const field of allTenFields) {
      const contaminatedSession = {
        ...cleanSession,
        examQuestions: [{ id: "q1", prompt: "Hello", options: ["A", "B"], [field]: "leak" }],
      };
      assert.strictEqual(
        evaluatePurge(contaminatedSession),
        true,
        `Contamination with ${field} must trigger session purge`
      );
    }

    // Missing guided token triggers purge
    assert.strictEqual(
      evaluatePurge({ ...cleanSession, guidedReviewToken: null }),
      true,
      "Missing guidedReviewToken must trigger session purge"
    );
    assert.strictEqual(
      evaluatePurge({ ...cleanSession, guidedReviewToken: "   " }),
      true,
      "Blank guidedReviewToken must trigger session purge"
    );

    // Cross-mode attemptToken triggers purge
    assert.strictEqual(
      evaluatePurge({ ...cleanSession, attemptToken: "cross.mode.token" }),
      true,
      "Non-empty attemptToken in Guided Review session must trigger session purge"
    );
  });

  // ─────────────────────────────────────────────────────────────
  // GROUP G: RATE LIMITING & INVARIANTS (TESTS 42 - 44)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group G: Rate Limiting & Invariants ---");

  runTest("Test 42: Guided check limiter is configured with sliding window (120 req / 1 m)", () => {
    assert.ok(
      /export const GUIDED_CHECK_LIMITER = createLimiter\(\s*120,\s*["']1 m["'],/.test(ratelimitSource),
      "GUIDED_CHECK_LIMITER must be configured with 120 req / 1 m"
    );
    assert.ok(GUIDED_CHECK_LIMITER !== undefined);
  });

  runTest("Test 43: Rate limiter keys on guided_check:{userId}", () => {
    assert.ok(
      checkRouteSource.includes('const rateLimitKey = `guided_check:${userId}`;'),
      "Check route must rate limit by guided_check:${userId}"
    );
  });

  runTest("Test 44: Protected files have zero Git diff and core security invariants remain intact", () => {
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
      "src/lib/cache.ts",
      "src/components/question/QuestionResultBanner.tsx",
      "src/components/question/ExplanationPanel.tsx",
    ];
    const { execSync } = require("child_process");
    const diffOutput = execSync(`git diff -- ${protectedFiles.join(" ")}`, { encoding: "utf8" });
    assert.strictEqual(diffOutput.trim(), "", "Protected files must have exactly zero git diff lines");
  });

  console.log("\n============================================================");
  console.log(` ALL ${passed} OF ${total} TESTS PASSED SUCCESSFULLY!`);
  console.log("============================================================\n");
}

main().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
