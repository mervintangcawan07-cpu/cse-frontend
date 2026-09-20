// Relative Path: src/scripts/test-phase3-data-exposure-remediation.ts
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "test_jwt_secret_phase3_super_safe_token_key_12345";
}

import { PUBLIC_QUESTION_SELECT, toPublicQuestion } from "@/lib/questionBank";
import { signDrillSessionToken, verifyDrillSessionToken } from "@/lib/drillSessionToken";
import { sanitizeDuelMatchForPlayer } from "@/lib/duels/sanitize";
import fs from "fs";
import path from "path";
import { SignJWT } from "jose";
import { createHmac } from "crypto";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
    failedCount++;
  }
}

async function runVerification() {
  console.log("\n=======================================================");
  console.log("🛡️ PHASE 3B DATA EXPOSURE REMEDIATION VERIFICATION SUITE");
  console.log("=======================================================\n");

  // -----------------------------------------------------------------------------
  // 1. DATA-EXAM-001: Question Bank & Practice Pre-Submission Redaction
  // -----------------------------------------------------------------------------
  console.log("--- 1. DATA-EXAM-001: Practice / Drill Pre-Submission Redaction ---");

  // Test question with ALL 10 sensitive answer/explanation fields populated
  const mockFullQuestion: any = {
    id: "q_test_secret_123",
    category: "Verbal Ability",
    subCategory: "Grammar",
    difficulty: "MODERATE",
    prompt: "Select the correct word.",
    options: ["Option A", "Option B", "Option C", "Option D"],
    answerIndex: 2,
    explanation: "Option C is grammatically correct because of subject-verb agreement.",
    whyA: "Option A is wrong because of tense mismatch.",
    whyB: "Option B is a fragment.",
    whyC: "Option C correctly uses present perfect.",
    whyD: "Option D has a comma splice.",
    stepByStep: ["Step 1: Identify subject.", "Step 2: Check verb."],
    eliminationStrategy: "Eliminate A and B immediately.",
    distractorRationale: "Common trap with plural nouns.",
    wrongAnswersExplanation: "A, B, D fail agreement checks.",
    isSeeded: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const SENSITIVE_EXAM_FIELDS = [
    "answerIndex",
    "explanation",
    "whyA",
    "whyB",
    "whyC",
    "whyD",
    "stepByStep",
    "eliminationStrategy",
    "distractorRationale",
    "wrongAnswersExplanation",
  ];

  // Verify toPublicQuestion helper
  const publicQ = toPublicQuestion(mockFullQuestion);

  assert(Boolean(publicQ), "toPublicQuestion returns an object");
  assert(publicQ.id === "q_test_secret_123", "toPublicQuestion preserves safe id");
  assert(publicQ.prompt === "Select the correct word.", "toPublicQuestion preserves safe prompt");
  assert(publicQ.options.length === 4, "toPublicQuestion preserves options array");

  for (const field of SENSITIVE_EXAM_FIELDS) {
    assert(!(field in publicQ), `Field '${field}' is not in public question keys`);
    assert((publicQ as any)[field] === undefined, `Field '${field}' is undefined on public question`);
  }

  // Verify PUBLIC_QUESTION_SELECT prisma select projection
  for (const field of SENSITIVE_EXAM_FIELDS) {
    assert(!(field in PUBLIC_QUESTION_SELECT), `PUBLIC_QUESTION_SELECT does not include '${field}'`);
  }
  assert(PUBLIC_QUESTION_SELECT.id === true, "PUBLIC_QUESTION_SELECT includes id");
  assert(PUBLIC_QUESTION_SELECT.prompt === true, "PUBLIC_QUESTION_SELECT includes prompt");
  assert(PUBLIC_QUESTION_SELECT.options === true, "PUBLIC_QUESTION_SELECT includes options");

  // Verify static call sites in API routes
  const questionsRouteSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/questions/route.ts"),
    "utf8"
  );
  assert(
    questionsRouteSrc.includes("PUBLIC_QUESTION_SELECT"),
    "/api/questions routes use PUBLIC_QUESTION_SELECT"
  );
  assert(
    questionsRouteSrc.includes("toPublicQuestion"),
    "/api/questions routes map responses through toPublicQuestion"
  );

  const drillsRouteSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/drills/route.ts"),
    "utf8"
  );
  assert(
    drillsRouteSrc.includes("PUBLIC_QUESTION_SELECT"),
    "/api/drills routes use PUBLIC_QUESTION_SELECT"
  );
  assert(
    drillsRouteSrc.includes("toPublicQuestion"),
    "/api/drills routes map responses through toPublicQuestion"
  );

  const eliminationRouteSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/drills/elimination/route.ts"),
    "utf8"
  );
  assert(
    eliminationRouteSrc.includes("PUBLIC_QUESTION_SELECT"),
    "/api/drills/elimination routes use PUBLIC_QUESTION_SELECT"
  );
  assert(
    eliminationRouteSrc.includes("toPublicQuestion"),
    "/api/drills/elimination routes map responses through toPublicQuestion"
  );
  assert(
    eliminationRouteSrc.includes("drillSessionToken"),
    "/api/drills/elimination returns signed drillSessionToken"
  );

  // -----------------------------------------------------------------------------
  // 2. Elimination Drill Cryptographic Session Token & Oracle Protection
  // -----------------------------------------------------------------------------
  console.log("\n--- 2. Elimination Cryptographic Session Token & Oracle Defense ---");

  const testUserId = "user_elim_tester_001";
  const issuedQuestionIds = ["q_elim_1", "q_elim_2", "q_elim_3", "q_elim_4", "q_elim_5"];

  const tokenResult = await signDrillSessionToken({
    userId: testUserId,
    questionIds: issuedQuestionIds,
    drillMode: "ELIMINATION",
  });

  assert(
    typeof tokenResult.drillSessionToken === "string" && tokenResult.drillSessionToken.length > 50,
    "Generated valid JWT drill token"
  );
  assert(Boolean(tokenResult.sessionId), "Generated valid drill sessionId");

  const verifyResult = await verifyDrillSessionToken(tokenResult.drillSessionToken, testUserId);
  assert(verifyResult.valid === true, "Verified drill session token for matching user");
  if (verifyResult.valid) {
    assert(verifyResult.claims.userId === testUserId, "Token userId matches");
    assert(verifyResult.claims.drillMode === "ELIMINATION", "Token drillMode matches ELIMINATION");
    assert(
      JSON.stringify(verifyResult.claims.questionIds) === JSON.stringify(issuedQuestionIds),
      "Token questionIds list intact"
    );
  }

  // Token security boundary tests:
  // A. Different user attempting to use another user's token
  const wrongUserResult = await verifyDrillSessionToken(tokenResult.drillSessionToken, "attacker_user_999");
  assert(
    wrongUserResult.valid === false && wrongUserResult.reason === "USER_MISMATCH",
    "Token rejected when user mismatch (token theft protection)"
  );

  // B. Tampered token
  const tamperedToken = tokenResult.drillSessionToken.slice(0, -5) + "abcde";
  const tamperedResult = await verifyDrillSessionToken(tamperedToken, testUserId);
  assert(
    tamperedResult.valid === false && tamperedResult.reason === "INVALID_SIGNATURE",
    "Tampered token rejected by crypto signature check"
  );

  // C. Expired token simulation
  const derivedKey = new Uint8Array(
    createHmac("sha256", process.env.JWT_SECRET!)
      .update("govstudyx:drill-session:v1")
      .digest()
  );
  const expiredJwt = await new SignJWT({
    tokenPurpose: "DRILL_SESSION",
    tokenVersion: 1,
    userId: testUserId,
    sessionId: "expired_session_1",
    questionIds: issuedQuestionIds,
    drillMode: "ELIMINATION",
    itemCount: 5,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
    .setSubject(testUserId)
    .sign(derivedKey);

  const expiredResult = await verifyDrillSessionToken(expiredJwt, testUserId);
  assert(
    expiredResult.valid === false && expiredResult.reason === "EXPIRED",
    "Expired drill session token rejected"
  );

  // D. Oracle defense check in /api/drills/elimination/check
  const checkRouteSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/drills/elimination/check/route.ts"),
    "utf8"
  );
  assert(
    checkRouteSrc.includes("verifyDrillSessionToken"),
    "Check route validates drill session token"
  );
  assert(
    checkRouteSrc.includes("tokenVerification.claims.questionIds.includes(trimmedQuestionId)"),
    "Check route strictly enforces that questionId is in token questionIds (oracle defense)"
  );
  assert(
    checkRouteSrc.includes("requireProAuth"),
    "Check route enforces server-side pro authorization"
  );

  // E. Elimination drill client uses server check endpoint
  const elimPageSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/drills/elimination/page.tsx"),
    "utf8"
  );
  assert(
    elimPageSrc.includes("/api/drills/elimination/check"),
    "Elimination frontend calls /api/drills/elimination/check"
  );
  assert(
    elimPageSrc.includes("drillSessionToken"),
    "Elimination frontend stores and passes drillSessionToken"
  );
  assert(
    !elimPageSrc.includes("currentQ.eliminationStrategy"),
    "Elimination frontend no longer reads eliminationStrategy directly from question object"
  );

  // -----------------------------------------------------------------------------
  // 3. DATA-DUEL-001: 1v1 Duel Match Sanitization
  // -----------------------------------------------------------------------------
  console.log("\n--- 3. DATA-DUEL-001: Speed Duel Match Sanitization ---");

  const mockDuelMatch: any = {
    id: "duel_match_secret_456",
    player1Id: "player_one",
    player1Name: "Player One",
    player2Id: "player_two",
    player2Name: "Player Two",
    status: "IN_PROGRESS",
    p1Score: 40,
    p2Score: 20,
    p1Current: 2,
    p2Current: 1,
    questions: [
      {
        id: "dq_1",
        category: "Math",
        prompt: "What is 2 + 2?",
        options: ["1", "2", "3", "4"],
        answerIndex: 3,
        explanation: "Basic addition.",
      },
      {
        id: "dq_2",
        category: "Science",
        prompt: "Water formula?",
        options: ["H2O", "CO2", "O2", "NaCl"],
        answerIndex: 0,
        explanation: "Two hydrogen, one oxygen.",
      },
    ],
  };

  const sanitizedInProgress = sanitizeDuelMatchForPlayer(mockDuelMatch);
  assert(Boolean(sanitizedInProgress), "sanitizeDuelMatchForPlayer returns sanitized match");
  assert(sanitizedInProgress?.questions.length === 2, "Sanitized match has 2 questions");

  for (const q of sanitizedInProgress?.questions || []) {
    assert(!("answerIndex" in q), "Sanitized duel question has no 'answerIndex'");
    assert(!("explanation" in q), "Sanitized duel question has no 'explanation'");
    assert(typeof (q as any).answerIndex === "undefined", "answerIndex is undefined on duel question");
    assert(typeof (q as any).explanation === "undefined", "explanation is undefined on duel question");
    assert(q.options.length === 4, "Options preserved on duel question");
  }

  // Verify FINISHED matches also have answers redacted
  const mockFinishedMatch = { ...mockDuelMatch, status: "FINISHED", winnerId: "player_one" };
  const sanitizedFinished = sanitizeDuelMatchForPlayer(mockFinishedMatch);
  for (const q of sanitizedFinished?.questions || []) {
    assert(!("answerIndex" in q), "Finished match question still has no 'answerIndex'");
    assert(!("explanation" in q), "Finished match question still has no 'explanation'");
  }

  // Verify duel API routes apply sanitization
  const matchmakeSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/duels/matchmake/route.ts"),
    "utf8"
  );
  assert(
    matchmakeSrc.includes("sanitizeDuelMatchForPlayer"),
    "/api/duels/matchmake uses sanitizeDuelMatchForPlayer"
  );

  const challengeSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/duels/challenge/route.ts"),
    "utf8"
  );
  assert(
    challengeSrc.includes("sanitizeDuelMatchForPlayer"),
    "/api/duels/challenge uses sanitizeDuelMatchForPlayer"
  );

  const respondSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/duels/challenge/respond/route.ts"),
    "utf8"
  );
  assert(
    respondSrc.includes("sanitizeDuelMatchForPlayer"),
    "/api/duels/challenge/respond uses sanitizeDuelMatchForPlayer"
  );

  const duelIdSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/duels/[id]/route.ts"),
    "utf8"
  );
  assert(
    duelIdSrc.includes("sanitizeDuelMatchForPlayer"),
    "/api/duels/[id] GET and POST use sanitizeDuelMatchForPlayer"
  );

  // -----------------------------------------------------------------------------
  // 4. Speed Duel Concurrency & Replay Attack Protection
  // -----------------------------------------------------------------------------
  console.log("\n--- 4. Speed Duel Concurrency & Replay Attack Protection ---");

  assert(
    duelIdSrc.includes("expectedCurrentIndex"),
    "/api/duels/[id] validates expectedCurrentIndex before grading"
  );
  assert(
    duelIdSrc.includes("tx.duelMatch.updateMany"),
    "/api/duels/[id] uses atomic tx.duelMatch.updateMany inside transaction"
  );
  assert(
    duelIdSrc.includes("CONCURRENT_UPDATE_CONFLICT"),
    "/api/duels/[id] checks updateResult.count and detects concurrent update conflict"
  );
  assert(
    duelIdSrc.includes("409"),
    "/api/duels/[id] returns HTTP 409 on out-of-order or duplicate replay"
  );
  assert(
    duelIdSrc.includes("selectedIndex !== -1"),
    "/api/duels/[id] safely handles timeout submission (selectedIndex = -1)"
  );

  const duelPageSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/duels/page.tsx"),
    "utf8"
  );
  assert(
    !duelPageSrc.includes("idx === currentQ.answerIndex"),
    "Duels page no longer checks answerIndex on currentQ"
  );
  assert(
    duelPageSrc.includes("roundFeedback"),
    "Duels page uses server roundFeedback for answer evaluation"
  );

  // -----------------------------------------------------------------------------
  // 5. DATA-PRIV-001: Social Study Rooms Host Privacy
  // -----------------------------------------------------------------------------
  console.log("\n--- 5. DATA-PRIV-001: Social Study Rooms Host Privacy ---");

  const roomsRouteSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/social/rooms/route.ts"),
    "utf8"
  );
  assert(
    !roomsRouteSrc.includes("email: true"),
    "/api/social/rooms route does NOT include email: true in host select"
  );
  assert(
    roomsRouteSrc.includes("host: { select: { id: true, name: true } }"),
    "/api/social/rooms route selects only { id: true, name: true } for host"
  );

  // -----------------------------------------------------------------------------
  // 6. DATA-INFRA-001: Infrastructure Readiness Generic Error
  // -----------------------------------------------------------------------------
  console.log("\n--- 6. DATA-INFRA-001: Infrastructure Readiness Generic Error ---");

  const readinessRouteSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/health/readiness/route.ts"),
    "utf8"
  );
  assert(
    !readinessRouteSrc.includes("Missing configuration keys:"),
    "/api/health/readiness does NOT leak missing config keys in public error"
  );
  assert(
    readinessRouteSrc.includes('error: "System configuration incomplete"'),
    "/api/health/readiness uses generic 'System configuration incomplete' error"
  );
  assert(
    readinessRouteSrc.includes("logger.error("),
    "/api/health/readiness logs detailed missingEnvVars internally"
  );

  // -----------------------------------------------------------------------------
  // 7. Mock Exam Bookmarks Minimization
  // -----------------------------------------------------------------------------
  console.log("\n--- 7. Mock Exam Bookmarks Minimization ---");

  const bookmarksRouteSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/bookmarks/route.ts"),
    "utf8"
  );
  assert(
    bookmarksRouteSrc.includes("idsOnly"),
    "/api/bookmarks route supports idsOnly parameter"
  );
  assert(
    bookmarksRouteSrc.includes("questionIds"),
    "/api/bookmarks returns questionIds when idsOnly=true without loading full questions"
  );

  const mockExamTakeSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/mock-exam/take/page.tsx"),
    "utf8"
  );
  assert(
    mockExamTakeSrc.includes("/api/bookmarks?idsOnly=true"),
    "Active mock exam /take page fetches bookmarks with idsOnly=true"
  );

  // -----------------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Verification execution error:", err);
  process.exit(1);
});
