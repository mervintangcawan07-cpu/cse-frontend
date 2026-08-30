import fs from "node:fs";
import path from "node:path";
import {
  authenticateExistingAccountSession,
  evaluateAccountSession,
  getPresentedSessionId,
  isAccountAuthorizedFor,
  isAccountOperational,
  isValidIdentifier,
  type ExistingAccountState,
// @ts-expect-error Node's built-in TypeScript runner requires the source extension.
} from "../lib/accountLifecycle.ts";

let passed = 0;
let failed = 0;

function assert(condition: boolean, description: string): void {
  if (condition) {
    console.log(`PASS: ${description}`);
    passed++;
  } else {
    console.error(`FAIL: ${description}`);
    failed++;
  }
}

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function appearsBefore(source: string, first: string, second: string): boolean {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

function exportedMethodSource(source: string, method: string): string {
  const methodStart = source.indexOf(`export async function ${method}(`);
  if (methodStart < 0) return "";

  const nextMethod = source.indexOf("\nexport async function ", methodStart + 1);
  return source.slice(methodStart, nextMethod < 0 ? undefined : nextMethod);
}

function runtimeSourceFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "scripts") files.push(...runtimeSourceFiles(absolutePath));
    } else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function relative(file: string): string {
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

function runPurePolicyMatrix(): void {
  const active: ExistingAccountState = {
    anonymizedAt: null,
    anonymizationVersion: null,
    isBanned: false,
    deletedAt: null,
    activeSessionId: "B",
  };

  assert(isValidIdentifier("user-1"), "nonempty User ID is valid");
  assert(!isValidIdentifier(""), "empty User ID is rejected");
  assert(!isValidIdentifier("   "), "whitespace User ID is rejected");
  assert(!isValidIdentifier(123), "non-string User ID is rejected");

  assert(
    getPresentedSessionId({ sessionId: "B", activeSessionId: "B" }) === "B",
    "matching current JWT session claims are accepted"
  );
  assert(
    getPresentedSessionId({ activeSessionId: "B" }) === "B",
    "legacy activeSessionId-only JWT claim remains compatible"
  );
  assert(
    getPresentedSessionId({ sessionId: "B" }) === "B",
    "sessionId-only JWT claim is accepted"
  );
  assert(getPresentedSessionId({}) === null, "missing JWT session is rejected");
  assert(
    getPresentedSessionId({ sessionId: "" }) === null,
    "empty JWT session is rejected"
  );
  assert(
    getPresentedSessionId({ sessionId: 7 }) === null,
    "non-string JWT session is rejected"
  );
  assert(
    getPresentedSessionId({ sessionId: "A", activeSessionId: "B" }) === null,
    "ambiguous mismatched JWT session claims are rejected"
  );

  const cases: Array<{
    description: string;
    input: Parameters<typeof evaluateAccountSession>[0];
    allowed: boolean;
    code?: string;
  }> = [
    {
      description: "active User with exact current session is allowed",
      input: { userId: "user-1", presentedSessionId: "B", user: active },
      allowed: true,
    },
    {
      description: "missing token User ID is denied",
      input: { userId: undefined, presentedSessionId: "B", user: active },
      allowed: false,
      code: "INVALID_USER_ID",
    },
    {
      description: "missing token session is denied",
      input: { userId: "user-1", presentedSessionId: undefined, user: active },
      allowed: false,
      code: "INVALID_SESSION_ID",
    },
    {
      description: "missing User is denied",
      input: { userId: "user-1", presentedSessionId: "B", user: null },
      allowed: false,
      code: "USER_NOT_FOUND",
    },
    {
      description: "fully marked terminal User with matching session is denied",
      input: {
        userId: "user-1",
        presentedSessionId: "B",
        user: {
          ...active,
          anonymizedAt: new Date(0),
          anonymizationVersion: 1,
        },
      },
      allowed: false,
      code: "TERMINAL_ANONYMIZED",
    },
    {
      description: "anonymizedAt-only terminal state fails closed",
      input: {
        userId: "user-1",
        presentedSessionId: "B",
        user: { ...active, anonymizedAt: new Date(0) },
      },
      allowed: false,
      code: "TERMINAL_ANONYMIZED",
    },
    {
      description: "anonymizationVersion-only terminal state fails closed",
      input: {
        userId: "user-1",
        presentedSessionId: "B",
        user: { ...active, anonymizationVersion: 1 },
      },
      allowed: false,
      code: "TERMINAL_ANONYMIZED",
    },
    {
      description: "terminal lifecycle takes precedence over ban and deletion",
      input: {
        userId: "user-1",
        presentedSessionId: "B",
        user: {
          ...active,
          anonymizedAt: new Date(0),
          isBanned: true,
          deletedAt: new Date(0),
        },
      },
      allowed: false,
      code: "TERMINAL_ANONYMIZED",
    },
    {
      description: "banned User with matching session is denied",
      input: {
        userId: "user-1",
        presentedSessionId: "B",
        user: { ...active, isBanned: true },
      },
      allowed: false,
      code: "BANNED",
    },
    {
      description: "soft-deleted User with matching session is denied",
      input: {
        userId: "user-1",
        presentedSessionId: "B",
        user: { ...active, deletedAt: new Date(0) },
      },
      allowed: false,
      code: "CLOSURE_PENDING",
    },
    {
      description: "null database session is revoked",
      input: {
        userId: "user-1",
        presentedSessionId: "B",
        user: { ...active, activeSessionId: null },
      },
      allowed: false,
      code: "SESSION_REVOKED",
    },
    {
      description: "empty database session is revoked",
      input: {
        userId: "user-1",
        presentedSessionId: "B",
        user: { ...active, activeSessionId: "" },
      },
      allowed: false,
      code: "SESSION_REVOKED",
    },
    {
      description: "session mismatch is denied",
      input: { userId: "user-1", presentedSessionId: "A", user: active },
      allowed: false,
      code: "SESSION_MISMATCH",
    },
  ];

  for (const testCase of cases) {
    const decision = evaluateAccountSession(testCase.input);
    assert(
      decision.allowed === testCase.allowed &&
        (testCase.allowed ||
          (!decision.allowed && decision.code === testCase.code)),
      testCase.description
    );
  }

  const replayState: ExistingAccountState = {
    anonymizedAt: null,
    anonymizationVersion: null,
    isBanned: false,
    deletedAt: null,
    activeSessionId: "A",
  };
  assert(
    evaluateAccountSession({
      userId: "user-1",
      presentedSessionId: "A",
      user: replayState,
    }).allowed,
    "session A is accepted while database session is A"
  );
  replayState.activeSessionId = "B";
  assert(
    !evaluateAccountSession({
      userId: "user-1",
      presentedSessionId: "A",
      user: replayState,
    }).allowed,
    "replayed session A is denied after database rotates to B"
  );
  replayState.activeSessionId = null;
  assert(
    !evaluateAccountSession({
      userId: "user-1",
      presentedSessionId: "A",
      user: replayState,
    }).allowed,
    "replayed session A is denied after database revocation"
  );

  assert(isAccountOperational(active), "active account can use login/recovery flows");
  assert(
    !isAccountOperational({ ...active, anonymizedAt: new Date(0) }),
    "anonymizedAt makes an account non-operational"
  );
  assert(
    !isAccountOperational({ ...active, anonymizationVersion: 1 }),
    "anonymizationVersion makes an account non-operational"
  );
  assert(
    !isAccountOperational({ ...active, isBanned: true }),
    "banned account cannot use login/recovery flows"
  );
  assert(
    !isAccountOperational({ ...active, deletedAt: new Date(0) }),
    "soft-deleted account cannot use login/recovery flows"
  );

  const now = Date.UTC(2026, 0, 1);
  const user = { role: "USER" as const, isPaid: false, paidUntil: null };
  const admin = { role: "ADMIN" as const, isPaid: false, paidUntil: null };
  assert(isAccountAuthorizedFor(user, "USER", now), "USER authorization remains USER-appropriate");
  assert(!isAccountAuthorizedFor(user, "ADMIN", now), "USER is not authorized as ADMIN");
  assert(isAccountAuthorizedFor(admin, "ADMIN", now), "ADMIN authorization remains ADMIN-appropriate");
  assert(isAccountAuthorizedFor(admin, "PRO", now), "ADMIN retains PRO entitlement bypass");
  assert(!isAccountAuthorizedFor(user, "PRO", now), "unpaid USER is denied PRO access");
  assert(
    isAccountAuthorizedFor(
      { role: "USER", isPaid: true, paidUntil: new Date(now + 60_000) },
      "PRO",
      now
    ),
    "paid USER with future expiry retains PRO access"
  );
  assert(
    !isAccountAuthorizedFor(
      { role: "USER", isPaid: true, paidUntil: new Date(now) },
      "PRO",
      now
    ),
    "paid USER at expiry is denied PRO access"
  );
}

async function runMockedCanonicalAuthTests(): Promise<void> {
  const liveUser: ExistingAccountState & { id: string } = {
    id: "user-1",
    anonymizedAt: null,
    anonymizationVersion: null,
    isBanned: false,
    deletedAt: null,
    activeSessionId: "B",
  };

  const authenticate = (
    claims: {
      userId?: unknown;
      sessionId?: unknown;
      activeSessionId?: unknown;
    } | null,
    foundUser: typeof liveUser | null = liveUser
  ) =>
    authenticateExistingAccountSession("mock-token", {
      verifyToken: async () => claims,
      findUserById: async () => foundUser,
    });

  assert(
    !(await authenticate(null)).allowed,
    "mocked canonical auth denies malformed/invalid JWT"
  );
  assert(
    !(await authenticate({ sessionId: "B" })).allowed,
    "mocked canonical auth denies missing User ID"
  );
  assert(
    !(await authenticate({ userId: "user-1" })).allowed,
    "mocked canonical auth denies missing session ID"
  );
  assert(
    !(await authenticate({ userId: "user-1", sessionId: "B" }, null)).allowed,
    "mocked canonical auth denies a missing database User"
  );
  assert(
    !(await authenticate(
      { userId: "user-1", sessionId: "B" },
      { ...liveUser, anonymizedAt: new Date(0), anonymizationVersion: 1 }
    )).allowed,
    "mocked canonical auth denies a terminally anonymized User"
  );
  assert(
    !(await authenticate(
      { userId: "user-1", sessionId: "B" },
      { ...liveUser, anonymizedAt: new Date(0) }
    )).allowed,
    "mocked canonical auth fails closed for anonymizedAt-only state"
  );
  assert(
    !(await authenticate(
      { userId: "user-1", sessionId: "B" },
      { ...liveUser, anonymizationVersion: 1 }
    )).allowed,
    "mocked canonical auth fails closed for anonymizationVersion-only state"
  );
  assert(
    !(await authenticate(
      { userId: "user-1", sessionId: "B" },
      { ...liveUser, isBanned: true }
    )).allowed,
    "mocked canonical auth denies a banned User"
  );
  assert(
    !(await authenticate(
      { userId: "user-1", sessionId: "B" },
      { ...liveUser, deletedAt: new Date(0) }
    )).allowed,
    "mocked canonical auth denies a soft-deleted User"
  );
  assert(
    !(await authenticate(
      { userId: "user-1", sessionId: "B" },
      { ...liveUser, activeSessionId: null }
    )).allowed,
    "mocked canonical auth denies a null database session"
  );
  assert(
    !(await authenticate(
      { userId: "user-1", sessionId: "A" },
      liveUser
    )).allowed,
    "mocked canonical auth denies a stale replayed session"
  );

  const accepted = await authenticate({
    userId: "user-1",
    sessionId: "B",
    activeSessionId: "B",
  });
  assert(
    accepted.allowed &&
      accepted.user.id === "user-1" &&
      accepted.sessionId === "B",
    "mocked canonical auth accepts only the exact live session"
  );
}

function runSourceIntegratedRouteTests(): void {
  const serverAuth = read("src/lib/serverAuth.ts");
  assert(
    serverAuth.includes("anonymizedAt: true") &&
      serverAuth.includes("anonymizationVersion: true") &&
      serverAuth.includes("isBanned: true") &&
      serverAuth.includes("deletedAt: true") &&
      serverAuth.includes("activeSessionId: true"),
    "serverAuth loads terminal and existing-field liveness state"
  );
  const publicUserDtoStart = serverAuth.indexOf(
    "export interface AuthenticatedUser {"
  );
  const publicUserDtoEnd = serverAuth.indexOf("\n}", publicUserDtoStart);
  const publicUserDto = serverAuth.slice(publicUserDtoStart, publicUserDtoEnd);
  assert(
    publicUserDtoStart >= 0 &&
      publicUserDtoEnd > publicUserDtoStart &&
      !/anonymizedAt|anonymizationVersion/.test(publicUserDto),
    "AuthenticatedUser safe DTO does not expose terminal lifecycle markers"
  );
  assert(
    serverAuth.includes("authenticateExistingAccountSession(token, dependencies)"),
    "serverAuth delegates token/database state to the tested canonical coordinator"
  );
  assert(
    serverAuth.includes("getAuthenticatedSession(req)"),
    "all existing serverAuth helpers inherit the canonical session authority"
  );
  assert(
    !serverAuth.includes("password: true") &&
      !serverAuth.includes("passwordResetToken: true") &&
      !serverAuth.includes("emailVerificationToken: true") &&
      !serverAuth.includes("banReason: true"),
    "serverAuth does not select sensitive credential or ban-reason fields"
  );
  assert(
    serverAuth.includes('isAccountAuthorizedFor(user, "ADMIN")') &&
      serverAuth.includes('isAccountAuthorizedFor(user, "PRO")'),
    "ADMIN and PRO guards apply authorization only after canonical liveness"
  );

  const b21Routes = [
    ["src/app/api/ai/explain-mistake/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/analytics/dashboard/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/bookmarks/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/duels/[id]/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/duels/challenge/respond/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/duels/challenge/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/duels/matchmake/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/flashcards/route.ts", ["getAuthenticatedSessionResult"]],
    ["src/app/api/notifications/read-all/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/notifications/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/questions/[id]/route.ts", ["getAuthenticatedSessionResult"]],
    ["src/app/api/questions/flag/route.ts", ["getAuthenticatedUser"]],
    [
      "src/app/api/questions/route.ts",
      ["getAuthenticatedUser", "getAuthenticatedSessionResult"],
    ],
    ["src/app/api/support/route.ts", ["getAuthenticatedSessionResult"]],
    ["src/app/api/user/analytics/detailed/route.ts", ["getAuthenticatedSessionResult"]],
    ["src/app/api/user/badges/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/user/mistakes/route.ts", ["getAuthenticatedUser"]],
    ["src/app/api/user/readiness-card/route.ts", ["getAuthenticatedUser"]],
  ] as const;
  const b21RouteSources = new Map(
    b21Routes.map(([file]) => [file, read(file)])
  );
  assert(
    b21Routes.every(([file, helpers]) => {
      const source = b21RouteSources.get(file) || "";
      return (
        !/\bverifyJWT\b/.test(source) &&
        source.includes('from "@/lib/serverAuth"') &&
        helpers.every((helper) => source.includes(helper))
      );
    }),
    "all 18 B2.1 routes use their planned canonical database-backed authentication"
  );
  assert(
    [...b21RouteSources.values()].every(
      (source) =>
        !source.includes("getAuthenticatedUser(request") &&
        !source.includes("getAuthenticatedSessionResult(request")
    ),
    "B2.1 routes preserve cookie-only authentication without adding Bearer fallback"
  );

  const duelById = b21RouteSources.get("src/app/api/duels/[id]/route.ts") || "";
  const duelGetStart = duelById.indexOf("export async function GET");
  const duelPostStart = duelById.indexOf("export async function POST");
  const duelGet = duelById.slice(duelGetStart, duelPostStart);
  const duelPost = duelById.slice(duelPostStart);
  assert(
    duelGetStart >= 0 &&
      duelPostStart > duelGetStart &&
      !duelGet.includes("getAuthenticated") &&
      duelPost.includes("getAuthenticatedUser()"),
    "/duels/[id] GET remains public while POST uses canonical authentication"
  );

  const questionById = b21RouteSources.get("src/app/api/questions/[id]/route.ts") || "";
  const questions = b21RouteSources.get("src/app/api/questions/route.ts") || "";
  assert(
    questionById.includes('authentication.code === "NO_TOKEN"') &&
      questionById.includes('authentication.session.user.role !== "ADMIN"') &&
      questionById.includes('{ error: "Unauthorized" }') &&
      questionById.includes('Forbidden: Admin access required') &&
      questions.includes('authentication.code === "NO_TOKEN"') &&
      questions.includes('authentication.session.user.role !== "ADMIN"') &&
      questions.includes('Forbidden: Admin access required'),
    "B2.1 ADMIN routes preserve database-backed role checks and exact 401/403 errors"
  );

  const flashcards = b21RouteSources.get("src/app/api/flashcards/route.ts") || "";
  const support = b21RouteSources.get("src/app/api/support/route.ts") || "";
  const detailedAnalytics =
    b21RouteSources.get("src/app/api/user/analytics/detailed/route.ts") || "";
  assert(
    flashcards.includes("Unauthorized: Please log in.") &&
      flashcards.includes("Unauthorized: Session invalid.") &&
      support.includes('{ error: "Unauthorized" }') &&
      support.includes('{ error: "Invalid session" }') &&
      detailedAnalytics.includes('{ error: "Unauthorized" }') &&
      detailedAnalytics.includes('{ error: "Invalid session" }'),
    "B2.1 route-specific missing-token and invalid-session responses remain intact"
  );

  const aiExplain = b21RouteSources.get("src/app/api/ai/explain-mistake/route.ts") || "";
  const bookmarks = b21RouteSources.get("src/app/api/bookmarks/route.ts") || "";
  const duelRespond =
    b21RouteSources.get("src/app/api/duels/challenge/respond/route.ts") || "";
  const notifications = b21RouteSources.get("src/app/api/notifications/route.ts") || "";
  const questionFlag = b21RouteSources.get("src/app/api/questions/flag/route.ts") || "";
  assert(
    aiExplain.includes("AI_EXPLAIN_LIMITER") &&
      support.includes("SUPPORT_TICKET_LIMITER") &&
      bookmarks.includes("deleteMany") &&
      bookmarks.includes("userId,") &&
      duelRespond.includes("match.challengedUserId !== userId") &&
      notifications.includes("notif.userId !== userId") &&
      questionFlag.includes("userId_questionId"),
    "B2.1 ownership and per-user rate-limit protections remain present"
  );

  const duelChallenge =
    b21RouteSources.get("src/app/api/duels/challenge/route.ts") || "";
  const duelMatchmake =
    b21RouteSources.get("src/app/api/duels/matchmake/route.ts") || "";
  const readinessCard =
    b21RouteSources.get("src/app/api/user/readiness-card/route.ts") || "";
  assert(
    !duelRespond.includes("prisma.user.findUnique") &&
      !duelMatchmake.includes("prisma.user.findUnique") &&
      (duelChallenge.match(/prisma\.user\.findUnique/g) || []).length === 1 &&
      duelChallenge.includes("targetUserId") &&
      readinessCard.includes("prisma.user.findUnique") &&
      readinessCard.includes("createdAt: true"),
    "B2.1 removes only redundant current-User queries and retains required business User lookups"
  );

  const b22Routes = [
    ["src/app/api/exam/draft/route.ts", 3],
    ["src/app/api/exam/start/route.ts", 1],
    ["src/app/api/exam/submit/route.ts", 1],
    ["src/app/api/mock-exam/history/[id]/route.ts", 1],
    ["src/app/api/mock-exam/history/route.ts", 1],
  ] as const;
  const b22RouteSources = new Map(
    b22Routes.map(([file]) => [file, read(file)])
  );
  assert(
    b22Routes.every(([file, methodCount]) => {
      const source = b22RouteSources.get(file) || "";
      return (
        !/\bverifyJWT\b/.test(source) &&
        !/\bcookies\s*\(/.test(source) &&
        !source.includes('from "next/headers"') &&
        !source.includes("cse_session") &&
        source.includes('from "@/lib/serverAuth"') &&
        (source.match(/\bgetAuthenticatedUser\(\)/g) || []).length === methodCount &&
        !source.includes("getAuthenticatedUser(request")
      );
    }),
    "all five B2.2 routes use cookie-only canonical authentication in every migrated method"
  );

  const examDraft = b22RouteSources.get("src/app/api/exam/draft/route.ts") || "";
  assert(
    examDraft.includes(
      "if (!authenticatedUser) return NextResponse.json({ draft: null }, { status: 401 });"
    ) &&
      (examDraft.match(/\{ error: "Unauthorized" \}, \{ status: 401 \}/g) || [])
        .length === 2,
    "B2.2 exam draft methods preserve their exact unauthorized response contracts"
  );
  assert(
    appearsBefore(examDraft, "await getAuthenticatedUser()", "await request.json()") &&
      (examDraft.match(/where: \{ userId: authenticatedUser\.id \}/g) || []).length === 3 &&
      examDraft.includes("userId: authenticatedUser.id") &&
      examDraft.includes("prisma.examDraft.upsert") &&
      examDraft.includes("prisma.examDraft.delete") &&
      examDraft.includes(".catch(() => null)"),
    "B2.2 draft authentication precedes processing and preserves canonical ownership and save/cleanup behavior"
  );

  const examStart = b22RouteSources.get("src/app/api/exam/start/route.ts") || "";
  assert(
    examStart.includes("CSE_CATEGORY_QUOTAS") &&
      examStart.includes("shuffleArray") &&
      examStart.includes("prisma.examResult.findMany") &&
      examStart.includes("prisma.userMistake.findMany") &&
      examStart.includes("prisma.question.findMany") &&
      examStart.includes("answerIndex: shuffledOptions.findIndex") &&
      examStart.includes("explanation: q.explanation || null"),
    "B2.2 exam start preserves selection, randomization, history, mistake, answer, and explanation behavior"
  );
  assert(
    !/requireProAuth|isPaid|paidUntil|planType|Payment required|status:\s*402/.test(
      examStart
    ),
    "B2.2 exam start does not introduce PRO, payment, or plan authorization"
  );

  const examSubmit = b22RouteSources.get("src/app/api/exam/submit/route.ts") || "";
  assert(
    appearsBefore(examSubmit, "await getAuthenticatedUser()", "await request.json()") &&
      examSubmit.includes("EXAM_SUBMIT_LIMITER") &&
      examSubmit.includes("checkRateLimit") &&
      examSubmit.includes("userIdx === q.answerIndex") &&
      examSubmit.includes("prisma.examResult.create") &&
      examSubmit.includes("prisma.userMistake.upsert") &&
      examSubmit.includes("prisma.$transaction(upsertOperations)") &&
      examSubmit.includes("recordUserActivityStreak(userId)") &&
      examSubmit.includes("evaluateAndAwardBadges(userId)") &&
      examSubmit.includes("prisma.examDraft.deleteMany"),
    "B2.2 exam submit preserves rate limiting, grading, writes, transaction, streak, badge, and cleanup behavior"
  );
  assert(
    !/idempotenc|replay|attemptId|examAttempt/i.test(examSubmit),
    "B2.2 exam submit adds no replay, idempotency, or attempt-ownership mechanism"
  );

  const mockExamHistoryById =
    b22RouteSources.get("src/app/api/mock-exam/history/[id]/route.ts") || "";
  const mockExamHistory =
    b22RouteSources.get("src/app/api/mock-exam/history/route.ts") || "";
  assert(
    mockExamHistoryById.includes("where: { id: attemptId, userId }") &&
      mockExamHistoryById.includes("userId: userId") &&
      mockExamHistoryById.includes("Exam review record not found or access denied.") &&
      mockExamHistoryById.includes("{ status: 404 }") &&
      mockExamHistoryById.includes('{ error: "Unauthorized" }'),
    "B2.2 mock exam review preserves User ownership, exact 401, and combined 404 behavior"
  );
  assert(
    mockExamHistory.includes("where: { userId }") &&
      mockExamHistory.includes('orderBy: { createdAt: "desc" }') &&
      mockExamHistory.includes("attempts: formattedAttempts") &&
      mockExamHistory.includes("history: formattedAttempts") &&
      mockExamHistory.includes('{ error: "Unauthorized" }'),
    "B2.2 mock exam history preserves per-User filtering, ordering, response aliases, and exact 401"
  );

  const deferredExamHistory = read("src/app/api/exam/history/route.ts");
  assert(
    /\bverifyJWT\b/.test(deferredExamHistory) &&
      /\bcookies\s*\(/.test(deferredExamHistory) &&
      deferredExamHistory.includes('searchParams.get("userId")'),
    "exam/history remains explicitly deferred with its existing direct authentication behavior"
  );

  const b23UserRoutes = [
    "src/app/admin/layout.tsx",
    "src/app/api/admin/backups/[id]/route.ts",
    "src/app/api/admin/backups/route.ts",
    "src/app/api/admin/flags/route.ts",
    "src/app/api/admin/flashcards/route.ts",
    "src/app/api/admin/notifications/route.ts",
    "src/app/api/admin/pricing/route.ts",
    "src/app/api/admin/reading/[id]/route.ts",
    "src/app/api/admin/reading/route.ts",
  ] as const;
  const b23ResultRoutes = [
    "src/app/api/admin/db-storage/route.ts",
    "src/app/api/admin/elimination-drills/route.ts",
    "src/app/api/admin/feature-flags/route.ts",
    "src/app/api/admin/flashcards/bulk/route.ts",
    "src/app/api/admin/login-history/route.ts",
    "src/app/api/admin/logs/route.ts",
    "src/app/api/admin/questions/[id]/route.ts",
    "src/app/api/admin/questions/ai-generate/route.ts",
    "src/app/api/admin/questions/bulk-delete/route.ts",
    "src/app/api/admin/questions/export/route.ts",
    "src/app/api/admin/questions/import/route.ts",
    "src/app/api/admin/recovery/route.ts",
    "src/app/api/admin/support-tickets/route.ts",
    "src/app/api/admin/trash/route.ts",
    "src/app/api/admin/users/action/route.ts",
  ] as const;
  const b23Routes = [...b23UserRoutes, ...b23ResultRoutes];
  const b23RouteSources = new Map(
    b23Routes.map((file) => [file, read(file)])
  );
  assert(
    b23Routes.length === 24 &&
      [...b23RouteSources.values()].every(
        (source) =>
          !/\bverifyJWT\b/.test(source) &&
          !/\bcookies\s*\(/.test(source) &&
          !source.includes("cse_session") &&
          source.includes('from "@/lib/serverAuth"')
      ),
    "all 24 B2.3 admin files use canonical authentication without direct JWT or cookie handling"
  );
  assert(
    b23UserRoutes.every((file) =>
      (b23RouteSources.get(file) || "").includes("getAuthenticatedUser()")
    ) &&
      b23ResultRoutes.every((file) =>
        (b23RouteSources.get(file) || "").includes(
          "getAuthenticatedSessionResult()"
        )
      ) &&
      [...b23RouteSources.values()].every(
        (source) =>
          !source.includes("getAuthenticatedUser(request") &&
          !source.includes("getAuthenticatedSessionResult(request")
      ),
    "B2.3 preserves the approved helper map and cookie-only authentication"
  );

  const adminLayout = b23RouteSources.get("src/app/admin/layout.tsx") || "";
  assert(
    adminLayout.includes('if (!user) redirect("/login")') &&
      adminLayout.includes(
        'if (user.role !== "ADMIN") redirect("/dashboard")'
      ) &&
      adminLayout.includes("<SudoProvider>") &&
      adminLayout.includes("</SudoProvider>"),
    "B2.3 admin layout preserves login/non-admin redirects and SudoProvider"
  );

  const adminFeatureFlags =
    b23RouteSources.get("src/app/api/admin/feature-flags/route.ts") || "";
  const featureFlagsGetStart = adminFeatureFlags.indexOf("export async function GET");
  const featureFlagsPostStart = adminFeatureFlags.indexOf("export async function POST");
  const featureFlagsGet = adminFeatureFlags.slice(
    featureFlagsGetStart,
    featureFlagsPostStart
  );
  const featureFlagsPost = adminFeatureFlags.slice(featureFlagsPostStart);
  assert(
    featureFlagsGetStart >= 0 &&
      featureFlagsPostStart > featureFlagsGetStart &&
      !featureFlagsGet.includes("getAuthenticated") &&
      featureFlagsPost.includes("getAuthenticatedSessionResult()") &&
      featureFlagsPost.includes('authentication.session.user.role !== "ADMIN"'),
    "B2.3 feature-flags GET remains public while POST remains ADMIN-only"
  );

  const adminElimination =
    b23RouteSources.get("src/app/api/admin/elimination-drills/route.ts") || "";
  const adminTrash =
    b23RouteSources.get("src/app/api/admin/trash/route.ts") || "";
  assert(
    adminElimination.includes(
      'authentication.session.user.email !== "mervintangcawan07@gmail.com"'
    ) &&
      adminTrash.includes(
        'authentication.session.user.email !== "mervintangcawan07@gmail.com"'
      ) &&
      adminElimination.includes("Access denied. Admin privileges required.") &&
      adminTrash.includes('{ error: "Access denied." }'),
    "B2.3 preserves canonical designated-email authorization and exact access-denied bodies"
  );

  const adminBackupsById =
    b23RouteSources.get("src/app/api/admin/backups/[id]/route.ts") || "";
  const adminBackups =
    b23RouteSources.get("src/app/api/admin/backups/route.ts") || "";
  const adminFlags =
    b23RouteSources.get("src/app/api/admin/flags/route.ts") || "";
  const adminFlashcards =
    b23RouteSources.get("src/app/api/admin/flashcards/route.ts") || "";
  const adminNotifications =
    b23RouteSources.get("src/app/api/admin/notifications/route.ts") || "";
  const adminPricing =
    b23RouteSources.get("src/app/api/admin/pricing/route.ts") || "";
  const adminReadingById =
    b23RouteSources.get("src/app/api/admin/reading/[id]/route.ts") || "";
  const adminReading =
    b23RouteSources.get("src/app/api/admin/reading/route.ts") || "";
  assert(
    adminBackups.includes('{ error: "Unauthorized access" }') &&
      adminBackupsById.includes('{ error: "Unauthorized" }') &&
      adminFlags.includes('{ error: "Forbidden" }') &&
      adminFlashcards.includes("Unauthorized: Admin access required.") &&
      adminNotifications.includes("Forbidden: Admin access required") &&
      adminReading.includes('{ error: "Forbidden" }') &&
      adminReadingById.includes('{ error: "Forbidden" }'),
    "B2.3 preserves collapsed backup, flags, flashcard, notification, and reading auth responses"
  );

  const adminLogs =
    b23RouteSources.get("src/app/api/admin/logs/route.ts") || "";
  assert(
    b23ResultRoutes.every((file) => {
      const source = b23RouteSources.get(file) || "";
      return source.includes('authentication.code === "NO_TOKEN"');
    }) &&
      adminLogs.includes("{ logs: [] }") &&
      adminLogs.includes("{ status: 401 }") &&
      adminPricing.includes('{ error: "Unauthorized" }') &&
      adminPricing.includes("Forbidden: Admin access required."),
    "B2.3 preserves route-owned missing-token, invalid-session, non-admin, logs, and pricing responses"
  );

  const redundantAdminLookupFiles = [
    "src/app/admin/layout.tsx",
    "src/app/api/admin/backups/[id]/route.ts",
    "src/app/api/admin/backups/route.ts",
    "src/app/api/admin/flags/route.ts",
    "src/app/api/admin/flashcards/route.ts",
    "src/app/api/admin/pricing/route.ts",
  ] as const;
  assert(
    redundantAdminLookupFiles.every(
      (file) =>
        !(b23RouteSources.get(file) || "").includes("prisma.user.findUnique")
    ),
    "B2.3 removes only the six approved redundant current-admin User lookups"
  );

  const adminFlashcardsBulk =
    b23RouteSources.get("src/app/api/admin/flashcards/bulk/route.ts") || "";
  const adminQuestionById =
    b23RouteSources.get("src/app/api/admin/questions/[id]/route.ts") || "";
  const adminQuestionBulkDelete =
    b23RouteSources.get("src/app/api/admin/questions/bulk-delete/route.ts") || "";
  const adminQuestionImport =
    b23RouteSources.get("src/app/api/admin/questions/import/route.ts") || "";
  assert(
    adminBackups.includes("actorId: admin.id") &&
      adminBackups.includes("actorEmail: admin.email") &&
      adminBackupsById.includes("actorEmail: admin.email") &&
      adminElimination.includes("authentication.session.user.id") &&
      adminFlashcardsBulk.includes("authentication.session.user.id") &&
      adminQuestionById.includes("authentication.session.user.id") &&
      adminQuestionBulkDelete.includes("authentication.session.user.id") &&
      adminQuestionImport.includes(
        "const userId = authentication.session.user.id"
      ) &&
      adminNotifications.includes("userId: session.id") &&
      adminTrash.includes("authentication.session.user.email"),
    "B2.3 acting-admin audit identities come only from canonical User data"
  );

  const adminRecovery =
    b23RouteSources.get("src/app/api/admin/recovery/route.ts") || "";
  const adminSupport =
    b23RouteSources.get("src/app/api/admin/support-tickets/route.ts") || "";
  const adminUserAction =
    b23RouteSources.get("src/app/api/admin/users/action/route.ts") || "";
  assert(
    adminRecovery.includes("prisma.user.findMany") &&
      adminRecovery.includes("prisma.user.findUnique") &&
      adminRecovery.includes("prisma.user.update") &&
      adminSupport.includes("prisma.user.findUnique") &&
      (adminUserAction.match(/prisma\.user\.update/g) || []).length === 3,
    "B2.3 retains required recovery, support, and admin target-User operations"
  );
  assert(
    adminFlashcardsBulk.includes("export const DELETE = requireSudo") &&
      adminQuestionById.includes("export const DELETE = requireSudo") &&
      adminQuestionBulkDelete.includes("export const DELETE = requireSudo") &&
      adminRecovery.includes("export const POST = requireSudo") &&
      adminRecovery.includes("export const DELETE = requireSudo") &&
      adminUserAction.includes("export const POST = requireSudo"),
    "B2.3 preserves every approved requireSudo wrapper"
  );
  assert(
    adminBackupsById.includes("P0_003_RESTORE_DISABLED_CODE") &&
      adminBackupsById.includes("P0_003_RESTORE_DISABLED_MESSAGE") &&
      adminBackupsById.includes("{ status: 503 }") &&
      adminBackupsById.includes("if (backup.protected)") &&
      appearsBefore(
        adminBackupsById,
        "const admin = await authenticateAdmin()",
        "await request.json()"
      ),
    "B2.3 preserves P0-003 restore containment, protected-backup deletion safeguards, and auth ordering"
  );
  assert(
    adminRecovery.includes("userHardPurgeDisabled") &&
      adminRecovery.includes("{ status: 501 }") &&
      adminTrash.includes("userHardPurgeDisabled") &&
      adminTrash.includes("Physical User purge is disabled") &&
      appearsBefore(
        adminTrash,
        "await getAuthenticatedSessionResult()",
        "await request.json()"
      ),
    "B2.3 preserves recovery/trash User hard-purge containment and destructive auth ordering"
  );

  const b24aFiles = [
    "src/app/api/social/classmates/respond/route.ts",
    "src/app/api/social/classmates/route.ts",
    "src/app/api/social/counts/route.ts",
    "src/app/api/social/presence/route.ts",
    "src/app/api/social/profile/[userId]/route.ts",
    "src/app/api/social/profile/route.ts",
  ] as const;
  const b24aRouteSources = new Map(
    b24aFiles.map((file) => [file, read(file)] as const)
  );
  assert(
    b24aFiles.every((file) => {
      const source = b24aRouteSources.get(file) || "";
      return (
        source.includes("getAuthenticatedUser()") &&
        !/\bverifyJWT\b/.test(source) &&
        !/\bcookies\s*\(/.test(source) &&
        !source.includes("getAuthenticatedUser(request")
      );
    }),
    "B2.4A social routes use cookie-only canonical authentication without direct JWT handling"
  );
  assert(
    Array.from(b24aRouteSources.values()).reduce(
      (total, source) => total + (source.match(/getAuthenticatedUser\(\)/g) || []).length,
      0
    ) === 8 &&
      b24aFiles.every((file) =>
        (b24aRouteSources.get(file) || "").includes(
          'NextResponse.json({ error: "Unauthorized" }, { status: 401 })'
        )
      ),
    "B2.4A preserves all eight mandatory cookie-auth method guards and exact 401 body"
  );

  const socialClassmateRespond =
    b24aRouteSources.get("src/app/api/social/classmates/respond/route.ts") || "";
  const socialClassmates =
    b24aRouteSources.get("src/app/api/social/classmates/route.ts") || "";
  const socialCounts =
    b24aRouteSources.get("src/app/api/social/counts/route.ts") || "";
  const socialPresence =
    b24aRouteSources.get("src/app/api/social/presence/route.ts") || "";
  const socialPublicProfile =
    b24aRouteSources.get("src/app/api/social/profile/[userId]/route.ts") || "";
  const socialProfile =
    b24aRouteSources.get("src/app/api/social/profile/route.ts") || "";

  assert(
    appearsBefore(socialClassmateRespond, "await getAuthenticatedUser()", "await request.json()") &&
      appearsBefore(socialClassmates, "await getAuthenticatedUser()", "await request.json()") &&
      appearsBefore(socialPresence, "await getAuthenticatedUser()", "await request.json()") &&
      appearsBefore(socialProfile, "await getAuthenticatedUser()", "await request.json()"),
    "B2.4A authentication remains before social request-body processing and writes"
  );
  assert(
    socialClassmateRespond.includes("prisma.user.findUnique") &&
      socialClassmateRespond.includes("studyProfile: { select: { displayName: true } }") &&
      socialClassmates.includes("const caller = await prisma.user.findUnique") &&
      socialClassmates.includes("studyInterests: true") &&
      socialClassmates.includes("prisma.classmateRelation.findMany") &&
      socialCounts.includes("prisma.classmateRelation.count") &&
      socialCounts.includes("prisma.directMessage.count"),
    "B2.4A retains classmate display-name, relevance, relationship, and social-count business queries"
  );
  assert(
    socialPresence.includes("const user = await prisma.user.update") &&
      appearsBefore(socialPresence, "await getAuthenticatedUser()", "prisma.user.update") &&
      socialPresence.includes("prisma.studyTogetherProfile.upsert"),
    "B2.4A preserves the presence heartbeat and profile-presence write after canonical authentication"
  );
  assert(
    socialPublicProfile.includes("const targetUser = await prisma.user.findUnique") &&
      socialPublicProfile.includes("showBio") &&
      socialPublicProfile.includes("showStudyGoal") &&
      socialPublicProfile.includes("showInterests") &&
      socialPublicProfile.includes("showActivity"),
    "B2.4A retains target-profile lookup and privacy filtering"
  );
  assert(
    !socialProfile.includes("prisma.user.findUnique") &&
      socialProfile.includes("authenticatedUser.name") &&
      socialProfile.includes("authenticatedUser.lastActiveAt") &&
      socialProfile.includes("prisma.studyTogetherProfile.findUnique") &&
      socialProfile.includes("prisma.studyTogetherProfile.upsert"),
    "B2.4A removes only the redundant own-profile User read while preserving profile read/write behavior"
  );

  const b24bFiles = [
    "src/app/api/social/posts/route.ts",
    "src/app/api/social/posts/[id]/route.ts",
    "src/app/api/social/posts/[id]/comments/route.ts",
    "src/app/api/social/posts/[id]/reactions/route.ts",
  ] as const;
  const b24bRouteSources = new Map(
    b24bFiles.map((file) => [file, read(file)] as const)
  );
  const socialPosts =
    b24bRouteSources.get("src/app/api/social/posts/route.ts") || "";
  const socialPost =
    b24bRouteSources.get("src/app/api/social/posts/[id]/route.ts") || "";
  const socialComments =
    b24bRouteSources.get("src/app/api/social/posts/[id]/comments/route.ts") || "";
  const socialReactions =
    b24bRouteSources.get("src/app/api/social/posts/[id]/reactions/route.ts") || "";
  const b24bMethodSources = [
    exportedMethodSource(socialPosts, "GET"),
    exportedMethodSource(socialPosts, "POST"),
    exportedMethodSource(socialPost, "DELETE"),
    exportedMethodSource(socialComments, "GET"),
    exportedMethodSource(socialComments, "POST"),
    exportedMethodSource(socialReactions, "POST"),
  ];

  assert(
    b24bFiles.every((file) => {
      const source = b24bRouteSources.get(file) || "";
      return (
        source.includes("getAuthenticatedUser()") &&
        !/\bverifyJWT\b/.test(source) &&
        !/\bcookies\s*\(/.test(source) &&
        !source.includes("getAuthenticatedUser(request")
      );
    }) &&
      b24bMethodSources.every((source) =>
        source.includes("await getAuthenticatedUser()")
      ),
    "B2.4B social post routes use cookie-only canonical authentication in all six methods"
  );
  assert(
    Array.from(b24bRouteSources.values()).reduce(
      (total, source) => total + (source.match(/getAuthenticatedUser\(\)/g) || []).length,
      0
    ) === 6 &&
      b24bMethodSources.every((source) =>
        source.includes(
          'NextResponse.json({ error: "Unauthorized" }, { status: 401 })'
        )
      ),
    "B2.4B preserves all six mandatory auth guards and exact 401 body"
  );
  assert(
    appearsBefore(
      exportedMethodSource(socialPosts, "GET"),
      "await getAuthenticatedUser()",
      "prisma.studyPost.findMany"
    ) &&
      appearsBefore(
        exportedMethodSource(socialPosts, "POST"),
        "await getAuthenticatedUser()",
        "await request.json()"
      ) &&
      appearsBefore(
        exportedMethodSource(socialPost, "DELETE"),
        "await getAuthenticatedUser()",
        "prisma.studyPost.update"
      ) &&
      appearsBefore(
        exportedMethodSource(socialComments, "POST"),
        "await getAuthenticatedUser()",
        "await request.json()"
      ) &&
      appearsBefore(
        exportedMethodSource(socialReactions, "POST"),
        "await getAuthenticatedUser()",
        "await request.json()"
      ),
    "B2.4B authentication remains before feed access, request bodies, and authenticated writes"
  );
  assert(
    socialPosts.includes("const currentUserId = authenticatedUser.id") &&
      socialPosts.includes("deletedAt: null") &&
      socialPosts.includes('topic && topic !== "ALL"') &&
      socialPosts.includes('{ isPinned: "desc" }') &&
      socialPosts.includes('{ createdAt: "desc" }') &&
      socialPosts.includes("take: limit") &&
      socialPosts.includes("userId: true") &&
      socialPosts.includes("comments:") &&
      socialPosts.includes("post.authorId === currentUserId") &&
      socialPosts.includes("r.userId === currentUserId"),
    "B2.4B preserves authenticated post feed filtering, ordering, counts, and canonical viewer identity"
  );
  assert(
    socialPosts.includes("const authorId = authenticatedUser.id") &&
      socialPosts.includes('typeof content !== "string"') &&
      socialPosts.includes("validTopics.includes(topic)") &&
      socialPosts.includes("prisma.studyPost.create") &&
      socialPosts.includes("authorId,") &&
      socialPosts.includes("createdAt: newPost.createdAt.toISOString()") &&
      socialPosts.includes("commentsCount: 0"),
    "B2.4B preserves post validation, creation response, and canonical author identity"
  );
  assert(
    socialPost.includes("prisma.studyPost.findUnique") &&
      socialPost.includes("select: { id: true, authorId: true, deletedAt: true }") &&
      socialPost.includes("const isAuthor = post.authorId === currentUserId") &&
      socialPost.includes('const isAdmin = authenticatedUser.role === "ADMIN"') &&
      socialPost.includes("if (!isAuthor && !isAdmin)") &&
      socialPost.includes("prisma.studyPost.update") &&
      socialPost.includes("data: { deletedAt: new Date() }") &&
      !socialPost.includes("prisma.user.findUnique"),
    "B2.4B preserves post author-or-platform-ADMIN deletion and removes only the redundant current-User role read"
  );
  assert(
    socialComments.includes("const currentUserId = authenticatedUser.id") &&
      socialComments.includes("const authorId = authenticatedUser.id") &&
      socialComments.includes("prisma.studyPostComment.findMany") &&
      socialComments.includes('orderBy: { createdAt: "asc" }') &&
      socialComments.includes("c.authorId === currentUserId") &&
      socialComments.includes("prisma.studyPost.findUnique") &&
      socialComments.includes("where: { id: postId, deletedAt: null }") &&
      socialComments.includes("prisma.studyPostComment.create") &&
      socialComments.includes("createdAt: newComment.createdAt.toISOString()"),
    "B2.4B preserves comment projection, order, post existence, validation, creation, and response identity"
  );
  assert(
    socialReactions.includes("const userId = authenticatedUser.id") &&
      socialReactions.includes("prisma.studyPost.findUnique") &&
      socialReactions.includes("postId_userId_reactionType") &&
      socialReactions.includes("prisma.studyPostReaction.findUnique") &&
      socialReactions.includes("prisma.studyPostReaction.delete") &&
      socialReactions.includes("prisma.studyPostReaction.create") &&
      socialReactions.includes("prisma.studyPostReaction.findMany") &&
      socialReactions.includes("reactions: reactionCounts") &&
      socialReactions.includes("userReactions,") &&
      !socialReactions.includes("prisma.user.findUnique"),
    "B2.4B preserves reaction uniqueness, toggle writes, post checks, counts, response, and a single canonical User read"
  );
  assert(
    Array.from(b24bRouteSources.values()).every(
      (source) =>
        !/requireProAuth|isAccountAuthorizedFor|isPaid|paidUntil|planType|status:\s*402|payment/i.test(
          source
        )
    ),
    "B2.4B adds no PRO, payment, or unrelated authorization policy"
  );

  const b24cFiles = [
    "src/app/api/social/clubs/route.ts",
    "src/app/api/social/clubs/join/route.ts",
    "src/app/api/social/clubs/[clubId]/route.ts",
    "src/app/api/social/clubs/[clubId]/invite/route.ts",
    "src/app/api/social/clubs/[clubId]/members/route.ts",
    "src/app/api/social/clubs/[clubId]/transfer/route.ts",
    "src/app/api/social/events/route.ts",
    "src/app/api/social/events/rsvp/route.ts",
  ] as const;
  const b24cRouteSources = new Map(
    b24cFiles.map((file) => [file, read(file)] as const)
  );
  const socialClubs =
    b24cRouteSources.get("src/app/api/social/clubs/route.ts") || "";
  const socialClubJoin =
    b24cRouteSources.get("src/app/api/social/clubs/join/route.ts") || "";
  const socialClub =
    b24cRouteSources.get("src/app/api/social/clubs/[clubId]/route.ts") || "";
  const socialClubInvite =
    b24cRouteSources.get("src/app/api/social/clubs/[clubId]/invite/route.ts") || "";
  const socialClubMembers =
    b24cRouteSources.get("src/app/api/social/clubs/[clubId]/members/route.ts") || "";
  const socialClubTransfer =
    b24cRouteSources.get("src/app/api/social/clubs/[clubId]/transfer/route.ts") || "";
  const socialEvents =
    b24cRouteSources.get("src/app/api/social/events/route.ts") || "";
  const socialEventRsvp =
    b24cRouteSources.get("src/app/api/social/events/rsvp/route.ts") || "";
  const b24cMethodSources = [
    exportedMethodSource(socialClubs, "GET"),
    exportedMethodSource(socialClubs, "POST"),
    exportedMethodSource(socialClubJoin, "POST"),
    exportedMethodSource(socialClub, "GET"),
    exportedMethodSource(socialClub, "DELETE"),
    exportedMethodSource(socialClubInvite, "POST"),
    exportedMethodSource(socialClubMembers, "GET"),
    exportedMethodSource(socialClubMembers, "PATCH"),
    exportedMethodSource(socialClubMembers, "DELETE"),
    exportedMethodSource(socialClubTransfer, "POST"),
    exportedMethodSource(socialEvents, "GET"),
    exportedMethodSource(socialEvents, "POST"),
    exportedMethodSource(socialEventRsvp, "POST"),
  ];

  assert(
    b24cFiles.every((file) => {
      const source = b24cRouteSources.get(file) || "";
      return (
        source.includes("getAuthenticatedUser()") &&
        !/\bverifyJWT\b/.test(source) &&
        !/\bcookies\s*\(/.test(source) &&
        !source.includes("getAuthenticatedUser(request") &&
        !/Authorization|Bearer/.test(source)
      );
    }) &&
      b24cMethodSources.every((source) =>
        source.includes("await getAuthenticatedUser()")
      ),
    "B2.4C club and event routes use cookie-only canonical authentication in all 13 methods"
  );
  assert(
    Array.from(b24cRouteSources.values()).reduce(
      (total, source) => total + (source.match(/getAuthenticatedUser\(\)/g) || []).length,
      0
    ) === 13 &&
      b24cMethodSources.every((source) =>
        source.includes(
          'NextResponse.json({ error: "Unauthorized" }, { status: 401 })'
        )
      ),
    "B2.4C preserves all 13 mandatory auth guards and exact 401 body"
  );
  assert(
    appearsBefore(
      exportedMethodSource(socialClubs, "GET"),
      "await getAuthenticatedUser()",
      "prisma.studyClub.findMany"
    ) &&
      appearsBefore(
        exportedMethodSource(socialClubs, "POST"),
        "await getAuthenticatedUser()",
        "await request.json()"
      ) &&
      appearsBefore(
        exportedMethodSource(socialClubJoin, "POST"),
        "await getAuthenticatedUser()",
        "await request.json()"
      ) &&
      appearsBefore(
        exportedMethodSource(socialClub, "DELETE"),
        "await getAuthenticatedUser()",
        "prisma.studyClub.delete"
      ) &&
      appearsBefore(
        exportedMethodSource(socialClubInvite, "POST"),
        "await getAuthenticatedUser()",
        "prisma.studyClub.findUnique"
      ) &&
      appearsBefore(
        exportedMethodSource(socialClubMembers, "PATCH"),
        "await getAuthenticatedUser()",
        "prisma.studyClubMember.update"
      ) &&
      appearsBefore(
        exportedMethodSource(socialClubMembers, "DELETE"),
        "await getAuthenticatedUser()",
        "prisma.studyClubMember.delete"
      ) &&
      appearsBefore(
        exportedMethodSource(socialClubTransfer, "POST"),
        "await getAuthenticatedUser()",
        "await request.json()"
      ) &&
      appearsBefore(
        exportedMethodSource(socialEvents, "GET"),
        "await getAuthenticatedUser()",
        "prisma.studyEvent.findMany"
      ) &&
      appearsBefore(
        exportedMethodSource(socialEvents, "POST"),
        "await getAuthenticatedUser()",
        "await request.json()"
      ) &&
      appearsBefore(
        exportedMethodSource(socialEventRsvp, "POST"),
        "await getAuthenticatedUser()",
        "await request.json()"
      ),
    "B2.4C authentication remains before sensitive reads, request bodies, and authenticated writes"
  );
  assert(
    socialClubs.includes("const userId = authenticatedUser.id") &&
      socialClubs.includes("let whereClause: any = { isPublic: true }") &&
      socialClubs.includes('filter === "mine"') &&
      socialClubs.includes("members: { some: { userId } }") &&
      socialClubs.includes('orderBy: { createdAt: "desc" }') &&
      socialClubs.includes("prisma.studyClub.create") &&
      socialClubs.includes("ownerId: userId") &&
      socialClubs.includes('role: "OWNER"') &&
      socialClubs.includes('message: "Study club created!"'),
    "B2.4C preserves club listing visibility, filtering, ordering, creation, owner identity, and initial membership"
  );
  assert(
    socialClub.includes("prisma.studyClub.findUnique") &&
      socialClub.includes("currentMember") &&
      socialClub.includes("currentUserRole") &&
      socialClub.includes("memberCount: club.members.length") &&
      socialClub.includes("club.ownerId !== userId") &&
      socialClub.includes('authenticatedUser.role !== "ADMIN"') &&
      socialClub.includes("prisma.studyClub.delete"),
    "B2.4C preserves club detail membership projection and owner-or-platform-ADMIN deletion"
  );
  assert(
    socialClubJoin.includes("const userId = authenticatedUser.id") &&
      socialClubJoin.includes("prisma.studyClub.findUnique") &&
      socialClubJoin.includes("prisma.studyClubMember.findUnique") &&
      socialClubJoin.includes("prisma.studyClubMember.create") &&
      socialClubJoin.includes("prisma.studyClubMember.delete") &&
      socialClubJoin.includes('existingMember.role === "OWNER"') &&
      socialClubJoin.includes("club.ownerId === userId") &&
      !socialClubJoin.includes("authenticatedUser.role"),
    "B2.4C limits clubs/join to canonical identity plumbing while preserving existing join, leave, membership, and owner safeguards"
  );
  assert(
    socialClubInvite.includes("prisma.studyClub.findUnique") &&
      socialClubInvite.includes("members: true") &&
      socialClubInvite.includes("club.ownerId === userId") &&
      socialClubInvite.includes("club.members.some") &&
      socialClubInvite.includes("targetUserIds") &&
      socialClubInvite.includes("const callerUser = await prisma.user.findUnique") &&
      socialClubInvite.includes("studyProfile: { select: { displayName: true } }") &&
      socialClubInvite.includes("await createNotification") &&
      socialClubInvite.includes("invitedCount"),
    "B2.4C preserves invite membership authority, caller display identity, targets, notifications, and response counts"
  );
  assert(
    socialClubMembers.includes("const callerMember = club.members.find") &&
      socialClubMembers.includes('callerMember?.role === "OWNER"') &&
      socialClubMembers.includes('callerMember?.role === "ADMIN"') &&
      socialClubMembers.includes('authenticatedUser.role === "ADMIN"') &&
      socialClubMembers.includes("const targetMember = club.members.find") &&
      socialClubMembers.includes("prisma.studyClubMember.update") &&
      socialClubMembers.includes("prisma.studyClubMember.delete") &&
      socialClubMembers.includes("await createNotification"),
    "B2.4C preserves club-level owner/moderator roles, platform-ADMIN authority, target membership, updates, removals, and notifications"
  );
  assert(
    socialClubTransfer.includes("const userId = authenticatedUser.id") &&
      socialClubTransfer.includes("club.ownerId !== userId") &&
      socialClubTransfer.includes("const newOwnerMember = club.members.find") &&
      socialClubTransfer.includes("await prisma.$transaction") &&
      appearsBefore(socialClubTransfer, "await tx.studyClub.update", "await tx.studyClubMember.update") &&
      socialClubTransfer.includes('data: { role: "OWNER" }') &&
      socialClubTransfer.includes('data: { role: "MEMBER" }') &&
      socialClubTransfer.includes("await createNotification"),
    "B2.4C preserves owner-only transfer, target membership validation, transaction ordering, old-owner handling, and notification"
  );
  assert(
    socialEvents.includes("const userId = authenticatedUser.id") &&
      socialEvents.includes("let whereClause: any = { isPublic: true }") &&
      socialEvents.includes('filter === "mine"') &&
      socialEvents.includes("scheduledAt = { gte:") &&
      socialEvents.includes('orderBy: { scheduledAt: "asc" }') &&
      socialEvents.includes("attendingCount") &&
      socialEvents.includes("myRsvp") &&
      socialEvents.includes("prisma.studyEvent.create") &&
      socialEvents.includes("hostId: userId") &&
      socialEvents.includes('status: "ATTENDING"') &&
      socialEvents.includes('message: "Study event scheduled!"'),
    "B2.4C preserves event visibility, mine/upcoming filters, order, counts, canonical host identity, validation, and creation response"
  );
  assert(
    socialEventRsvp.includes("const userId = authenticatedUser.id") &&
      socialEventRsvp.includes("prisma.studyEvent.findUnique") &&
      socialEventRsvp.includes("prisma.studyEventRSVP.findUnique") &&
      socialEventRsvp.includes("eventId_userId") &&
      socialEventRsvp.includes("prisma.studyEventRSVP.update") &&
      socialEventRsvp.includes("prisma.studyEventRSVP.create") &&
      socialEventRsvp.includes('status === "ATTENDING"') &&
      socialEventRsvp.includes("await createNotification") &&
      socialEventRsvp.includes("RSVP status set to ${status}"),
    "B2.4C preserves RSVP validation, event existence, uniqueness, update/create semantics, notification, and response"
  );
  assert(
    Array.from(b24cRouteSources.values()).every(
      (source) =>
        !/requireProAuth|isAccountAuthorizedFor|isPaid\s*[&|=]|paidUntil|planType|status:\s*402|payment/i.test(
          source
        )
    ),
    "B2.4C adds no PRO, payment, caching, or unrelated authorization policy"
  );

  const b24dFiles = [
    "src/app/api/social/messages/[conversationId]/route.ts",
    "src/app/api/social/messages/conversations/route.ts",
    "src/app/api/social/rooms/[roomId]/chat/route.ts",
  ] as const;
  const b24dRouteSources = new Map(
    b24dFiles.map((file) => [file, read(file)] as const)
  );
  const socialConversation =
    b24dRouteSources.get("src/app/api/social/messages/[conversationId]/route.ts") || "";
  const socialConversations =
    b24dRouteSources.get("src/app/api/social/messages/conversations/route.ts") || "";
  const socialRoomChat =
    b24dRouteSources.get("src/app/api/social/rooms/[roomId]/chat/route.ts") || "";
  const b24dMethodSources = [
    exportedMethodSource(socialConversation, "GET"),
    exportedMethodSource(socialConversation, "POST"),
    exportedMethodSource(socialConversation, "DELETE"),
    exportedMethodSource(socialConversations, "GET"),
    exportedMethodSource(socialConversations, "POST"),
    exportedMethodSource(socialRoomChat, "GET"),
    exportedMethodSource(socialRoomChat, "POST"),
    exportedMethodSource(socialRoomChat, "PATCH"),
    exportedMethodSource(socialRoomChat, "DELETE"),
  ];

  assert(
    b24dFiles.every((file) => {
      const source = b24dRouteSources.get(file) || "";
      return (
        source.includes("getAuthenticatedUser()") &&
        !/\bverifyJWT\b/.test(source) &&
        !/\bcookies\s*\(/.test(source) &&
        !source.includes("getAuthenticatedUser(request") &&
        !/Authorization|Bearer/.test(source)
      );
    }) &&
      b24dMethodSources.every((source) =>
        source.includes("await getAuthenticatedUser()")
      ),
    "B2.4D direct-message and room-chat routes use cookie-only canonical authentication in all 9 methods"
  );
  assert(
    Array.from(b24dRouteSources.values()).reduce(
      (total, source) => total + (source.match(/getAuthenticatedUser\(\)/g) || []).length,
      0
    ) === 9 &&
      b24dMethodSources.every((source) =>
        source.includes(
          'NextResponse.json({ error: "Unauthorized" }, { status: 401 })'
        )
      ),
    "B2.4D preserves all 9 mandatory auth guards and exact 401 body"
  );

  const conversationGet = exportedMethodSource(socialConversation, "GET");
  const conversationPost = exportedMethodSource(socialConversation, "POST");
  const conversationDelete = exportedMethodSource(socialConversation, "DELETE");
  const conversationsGet = exportedMethodSource(socialConversations, "GET");
  const conversationsPost = exportedMethodSource(socialConversations, "POST");
  const roomChatGet = exportedMethodSource(socialRoomChat, "GET");
  const roomChatPost = exportedMethodSource(socialRoomChat, "POST");
  const roomChatPatch = exportedMethodSource(socialRoomChat, "PATCH");
  const roomChatDelete = exportedMethodSource(socialRoomChat, "DELETE");

  assert(
    appearsBefore(conversationGet, "await getAuthenticatedUser()", "prisma.directMessageParticipant.findUnique") &&
      appearsBefore(conversationPost, "await getAuthenticatedUser()", "prisma.directMessageParticipant.findUnique") &&
      appearsBefore(conversationDelete, "await getAuthenticatedUser()", "prisma.directMessage.findUnique") &&
      appearsBefore(conversationsGet, "await getAuthenticatedUser()", "prisma.directMessageParticipant.findMany") &&
      appearsBefore(conversationsPost, "await getAuthenticatedUser()", "await request.json()") &&
      appearsBefore(roomChatGet, "await getAuthenticatedUser()", "prisma.studyRoomParticipant.findUnique") &&
      appearsBefore(roomChatPost, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(roomChatPatch, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(roomChatDelete, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique"),
    "B2.4D authentication remains before sensitive reads, request bodies, and authenticated writes"
  );
  assert(
    conversationGet.includes("conversationId_userId") &&
      conversationGet.includes("prisma.directMessage.updateMany") &&
      conversationGet.includes('state: { not: "READ" }') &&
      conversationGet.includes('data: { state: "READ" }') &&
      conversationGet.includes("prisma.directMessage.findMany") &&
      conversationGet.includes('orderBy: { createdAt: "asc" }') &&
      conversationGet.includes("take: 100") &&
      conversationGet.includes("replyTo:") &&
      conversationGet.includes("otherUser: otherParticipant"),
    "B2.4D preserves direct-message participation, read-state mutation, ordering, limit, replies, and peer projection"
  );
  assert(
    conversationPost.includes("conversationId_userId") &&
      conversationPost.includes("checkRateLimit(MESSAGING_LIMITER") &&
      conversationPost.includes("`msg:${userId}`") &&
      conversationPost.includes("prisma.directMessage.create") &&
      conversationPost.includes("senderId: userId") &&
      conversationPost.includes('state: "SENT"') &&
      conversationPost.includes("prisma.conversation.update") &&
      conversationPost.includes("await createNotification") &&
      conversationPost.includes('type: "DIRECT_MESSAGE"'),
    "B2.4D preserves direct-message membership, throttling, canonical sender, state, conversation activity, and notification"
  );
  assert(
    conversationDelete.includes("msg.conversationId !== conversationId") &&
      conversationDelete.includes('authenticatedUser.role !== "ADMIN"') &&
      conversationDelete.includes("msg.senderId !== userId") &&
      conversationDelete.includes("prisma.directMessage.delete") &&
      conversationDelete.includes("conversationId_userId") &&
      conversationDelete.includes("!isParticipant") &&
      conversationDelete.includes("prisma.conversation.delete"),
    "B2.4D preserves message ownership or platform-ADMIN deletion and participant or platform-ADMIN conversation deletion"
  );
  assert(
    conversationsGet.includes("prisma.directMessageParticipant.findMany") &&
      conversationsGet.includes("prisma.conversation.findMany") &&
      conversationsGet.includes('orderBy: { updatedAt: "desc" }') &&
      conversationsGet.includes("prisma.directMessage.groupBy") &&
      conversationsGet.includes('state: { not: "READ" }') &&
      conversationsGet.includes("unreadCount") &&
      conversationsPost.includes("targetUserId === userId") &&
      conversationsPost.includes("prisma.classmateRelation.findFirst") &&
      conversationsPost.includes('relation.status !== "ACCEPTED"') &&
      conversationsPost.includes("c.participants.length === 2") &&
      conversationsPost.includes("prisma.conversation.create") &&
      conversationsPost.includes("create: [{ userId }, { userId: targetUserId }]"),
    "B2.4D preserves conversation membership filtering, recency, unread counts, accepted-classmate gate, reuse, and creation"
  );
  assert(
    roomChatGet.includes("roomId_userId") &&
      roomChatGet.includes("prisma.studyRoomMessage.findMany") &&
      roomChatGet.includes('orderBy: { createdAt: "asc" }') &&
      roomChatGet.includes("take: 100") &&
      roomChatGet.includes("messages.find((m) => m.isPinned)") &&
      roomChatPost.includes("const participant = room.participants.find") &&
      roomChatPost.includes('participant.role === "MODERATOR"') &&
      roomChatPost.includes("room.allowMemberChat === false") &&
      roomChatPost.includes("prisma.studyRoomMessage.create") &&
      roomChatPost.includes("senderId: userId"),
    "B2.4D preserves room-chat membership, ordering, limit, pinned response, locked-chat host/moderator policy, and canonical sender"
  );
  assert(
    roomChatPatch.includes("room.hostId === userId") &&
      roomChatPatch.includes('participant?.role === "MODERATOR"') &&
      roomChatPatch.includes("targetMessage.roomId !== roomId") &&
      roomChatPatch.includes("prisma.studyRoomMessage.updateMany") &&
      roomChatPatch.includes("prisma.studyRoomMessage.update") &&
      roomChatDelete.includes("msg.roomId !== roomId") &&
      roomChatDelete.includes("msg.senderId !== userId && !isHost && !isModerator") &&
      roomChatDelete.includes("prisma.studyRoomMessage.delete") &&
      !socialRoomChat.includes("authenticatedUser.role"),
    "B2.4D preserves room-scoped pinning, single-pin behavior, and author/host/moderator deletion without adding platform-role authority"
  );
  assert(
    Array.from(b24dRouteSources.values()).every(
      (source) =>
        !/requireProAuth|isAccountAuthorizedFor|isPaid\s*[&|=]|paidUntil|planType|status:\s*402|payment/i.test(
          source
        )
    ),
    "B2.4D adds no PRO, payment, caching, or unrelated authorization policy"
  );

  const b24eFiles = [
    "src/app/api/social/rooms/route.ts",
    "src/app/api/social/rooms/join/route.ts",
    "src/app/api/social/rooms/[roomId]/route.ts",
    "src/app/api/social/rooms/[roomId]/invite/route.ts",
    "src/app/api/social/rooms/[roomId]/leave/route.ts",
    "src/app/api/social/rooms/[roomId]/participants/route.ts",
    "src/app/api/social/rooms/[roomId]/topic/route.ts",
  ] as const;
  const b24eRouteSources = new Map(
    b24eFiles.map((file) => [file, read(file)] as const)
  );
  const socialRooms = b24eRouteSources.get("src/app/api/social/rooms/route.ts") || "";
  const socialRoomJoin = b24eRouteSources.get("src/app/api/social/rooms/join/route.ts") || "";
  const socialRoom = b24eRouteSources.get("src/app/api/social/rooms/[roomId]/route.ts") || "";
  const socialRoomInvite =
    b24eRouteSources.get("src/app/api/social/rooms/[roomId]/invite/route.ts") || "";
  const socialRoomLeave =
    b24eRouteSources.get("src/app/api/social/rooms/[roomId]/leave/route.ts") || "";
  const socialRoomParticipants =
    b24eRouteSources.get("src/app/api/social/rooms/[roomId]/participants/route.ts") || "";
  const socialRoomTopic =
    b24eRouteSources.get("src/app/api/social/rooms/[roomId]/topic/route.ts") || "";

  const roomsGet = exportedMethodSource(socialRooms, "GET");
  const roomsPost = exportedMethodSource(socialRooms, "POST");
  const roomJoinPost = exportedMethodSource(socialRoomJoin, "POST");
  const roomGet = exportedMethodSource(socialRoom, "GET");
  const roomPatch = exportedMethodSource(socialRoom, "PATCH");
  const roomDelete = exportedMethodSource(socialRoom, "DELETE");
  const roomInvitePost = exportedMethodSource(socialRoomInvite, "POST");
  const roomLeavePost = exportedMethodSource(socialRoomLeave, "POST");
  const roomLeaveDelete = exportedMethodSource(socialRoomLeave, "DELETE");
  const roomParticipantsPatch = exportedMethodSource(socialRoomParticipants, "PATCH");
  const roomParticipantsDelete = exportedMethodSource(socialRoomParticipants, "DELETE");
  const roomTopicGet = exportedMethodSource(socialRoomTopic, "GET");
  const roomTopicPost = exportedMethodSource(socialRoomTopic, "POST");
  const roomTopicDelete = exportedMethodSource(socialRoomTopic, "DELETE");
  const b24eAuthSources = [
    roomsGet,
    roomsPost,
    roomJoinPost,
    roomGet,
    roomPatch,
    roomDelete,
    roomInvitePost,
    socialRoomLeave,
    roomParticipantsPatch,
    roomParticipantsDelete,
    roomTopicGet,
    roomTopicPost,
    roomTopicDelete,
  ];

  assert(
    b24eFiles.every((file) => {
      const source = b24eRouteSources.get(file) || "";
      return (
        source.includes("getAuthenticatedUser()") &&
        !/\bverifyJWT\b/.test(source) &&
        !/\bcookies\s*\(/.test(source) &&
        !source.includes("getAuthenticatedUser(request") &&
        !/Authorization|Bearer/.test(source)
      );
    }) &&
      b24eAuthSources.every((source) =>
        source.includes("await getAuthenticatedUser()")
      ) &&
      roomLeavePost.includes("return handleLeaveRoom(request, params)") &&
      roomLeaveDelete.includes("return handleLeaveRoom(request, params)"),
    "B2.4E room lifecycle routes use cookie-only canonical authentication across 13 guards and both leave methods"
  );
  assert(
    Array.from(b24eRouteSources.values()).reduce(
      (total, source) => total + (source.match(/getAuthenticatedUser\(\)/g) || []).length,
      0
    ) === 13 &&
      b24eAuthSources.every((source) =>
        source.includes(
          'NextResponse.json({ error: "Unauthorized" }, { status: 401 })'
        )
      ),
    "B2.4E preserves all 13 canonical auth guards and the exact 401 body"
  );
  assert(
    appearsBefore(roomsGet, "await getAuthenticatedUser()", "prisma.studyRoom.findMany") &&
      appearsBefore(roomsPost, "await getAuthenticatedUser()", "await request.json()") &&
      appearsBefore(roomJoinPost, "await getAuthenticatedUser()", "await request.json()") &&
      appearsBefore(roomGet, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(roomPatch, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(roomDelete, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(roomInvitePost, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(socialRoomLeave, "await getAuthenticatedUser()", "prisma.studyRoomParticipant.findUnique") &&
      appearsBefore(roomParticipantsPatch, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(roomParticipantsDelete, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(roomTopicGet, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(roomTopicPost, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique") &&
      appearsBefore(roomTopicDelete, "await getAuthenticatedUser()", "prisma.studyRoom.findUnique"),
    "B2.4E authentication remains before protected room reads, request bodies, and writes"
  );
  assert(
    roomsGet.includes('state: { in: ["ACTIVE", "SCHEDULED"] }') &&
      roomsGet.includes('filter === "mine"') &&
      roomsGet.includes('filter === "public"') &&
      roomsGet.includes("whereClause.OR") &&
      roomsGet.includes("participants: { some: { userId } }") &&
      roomsGet.includes('orderBy: { createdAt: "desc" }') &&
      roomsGet.includes("participantCount: room.participants.length") &&
      roomsGet.includes("isHost: room.hostId === userId") &&
      roomsGet.includes("isMember: room.participants.some"),
    "B2.4E preserves active/scheduled room discovery, mine/public visibility, ordering, counts, and canonical viewer flags"
  );
  assert(
    roomsPost.includes("const userId = authenticatedUser.id") &&
      roomsPost.includes('error: "Room name is required"') &&
      roomsPost.includes("Math.min(Math.max(Number(maxParticipants) || 10, 2), 50)") &&
      roomsPost.includes("generateInviteCode()") &&
      roomsPost.includes("prisma.studyRoom.findUnique") &&
      roomsPost.includes("prisma.studyRoom.create") &&
      roomsPost.includes("hostId: userId") &&
      roomsPost.includes('role: "HOST"') &&
      roomsPost.includes('isPublic: isPublic !== false') &&
      roomsPost.includes('"SCHEDULED" : "ACTIVE"'),
    "B2.4E preserves room validation, capacity bounds, invite-code uniqueness, defaults, canonical host, initial HOST membership, and schedule state"
  );
  assert(
    roomJoinPost.includes("const userId = authenticatedUser.id") &&
      roomJoinPost.includes("if (!roomId && !inviteCode)") &&
      roomJoinPost.includes("where: { inviteCode: String(inviteCode).toUpperCase().trim() }") &&
      roomJoinPost.includes("where: { id: String(roomId) }") &&
      roomJoinPost.includes('room.state === "ENDED"') &&
      roomJoinPost.includes('room.state === "CANCELLED"') &&
      roomJoinPost.includes("room.participants.find") &&
      roomJoinPost.includes("room.isLocked && room.hostId !== userId") &&
      roomJoinPost.includes("room.participants.length >= room.maxParticipants") &&
      roomJoinPost.includes("!room.isPublic && !inviteCode") &&
      roomJoinPost.includes("prisma.studyRoomParticipant.create") &&
      roomJoinPost.includes('role: "MEMBER"'),
    "B2.4E preserves join lookup, active-state, existing membership, lock, capacity, private invite-code gate, and MEMBER creation"
  );
  assert(
    roomGet.includes("prisma.studyRoom.findUnique") &&
      roomGet.includes('orderBy: { joinedAt: "asc" }') &&
      roomGet.includes("const currentParticipant = room.participants.find") &&
      roomGet.includes("!room.isPublic && !isMember") &&
      roomGet.includes("currentUserRole") &&
      roomGet.includes("participants: room.participants.map") &&
      roomPatch.includes("room.hostId !== userId") &&
      roomPatch.includes("prisma.studyRoom.update") &&
      roomPatch.includes("allowMemberWhiteboard") &&
      roomPatch.includes("allowMemberScreenShare") &&
      roomPatch.includes("allowMemberChat") &&
      roomPatch.includes("isLocked"),
    "B2.4E preserves room detail privacy, participant projection and roles, plus host-only room settings"
  );
  assert(
    roomDelete.includes("room.hostId !== userId") &&
      roomDelete.includes('authenticatedUser.role !== "ADMIN"') &&
      roomDelete.includes("prisma.studyRoom.delete") &&
      roomParticipantsPatch.includes('authenticatedUser.role === "ADMIN"') &&
      roomParticipantsDelete.includes('authenticatedUser.role === "ADMIN"'),
    "B2.4E preserves the existing platform-ADMIN overrides only for room deletion and participant controls"
  );
  assert(
    roomInvitePost.includes("participants: true") &&
      roomInvitePost.includes("room.hostId === userId") &&
      roomInvitePost.includes("room.participants.some") &&
      roomInvitePost.includes("targetUserIds") &&
      roomInvitePost.includes("const callerUser = await prisma.user.findUnique") &&
      roomInvitePost.includes("studyProfile: { select: { displayName: true } }") &&
      roomInvitePost.includes("if (targetId === userId) continue") &&
      roomInvitePost.includes("await createNotification") &&
      roomInvitePost.includes("invitedCount"),
    "B2.4E preserves invite room authority, current-caller display lookup, target filtering, notifications, and response count"
  );
  assert(
    socialRoomLeave.includes("roomId_userId") &&
      socialRoomLeave.includes("prisma.studyRoomParticipant.delete") &&
      socialRoomLeave.includes('participant.role === "HOST"') &&
      socialRoomLeave.includes("prisma.studyRoomParticipant.findFirst") &&
      socialRoomLeave.includes('orderBy: { joinedAt: "asc" }') &&
      socialRoomLeave.includes("await prisma.$transaction") &&
      socialRoomLeave.includes('data: { role: "HOST" }') &&
      socialRoomLeave.includes("data: { hostId: remaining.userId }") &&
      socialRoomLeave.includes('data: { state: "ENDED" }'),
    "B2.4E preserves leave membership deletion, oldest-participant host transfer, and empty-room ending behavior"
  );
  assert(
    roomParticipantsPatch.includes("const callerParticipant = room.participants.find") &&
      roomParticipantsPatch.includes('callerParticipant?.role === "MODERATOR"') &&
      roomParticipantsPatch.includes("const targetParticipant = room.participants.find") &&
      roomParticipantsPatch.includes("Moderators cannot modify Host or other Moderators") &&
      roomParticipantsPatch.includes("Only the Room Host can promote or demote roles") &&
      roomParticipantsPatch.includes("prisma.studyRoomParticipant.update") &&
      roomParticipantsPatch.includes("await createNotification") &&
      roomParticipantsDelete.includes("targetUserId === room.hostId") &&
      roomParticipantsDelete.includes("targetUserId === userId") &&
      roomParticipantsDelete.includes("Moderators cannot remove other moderators") &&
      roomParticipantsDelete.includes("prisma.studyRoomParticipant.delete"),
    "B2.4E preserves room-role participant controls, target lookup, host/self protections, moderator restrictions, writes, and promotion notification"
  );
  assert(
    roomTopicGet.includes("room.participants.some") &&
      roomTopicGet.includes("!room.isPublic && !isMemberOrHost") &&
      roomTopicGet.includes("Prisma.QuestionWhereInput") &&
      roomTopicGet.includes("deletedAt: null") &&
      roomTopicGet.includes("prisma.question.findMany") &&
      roomTopicGet.includes("prisma.question.count") &&
      roomTopicGet.includes("skip,") &&
      roomTopicGet.includes("take: limit") &&
      roomTopicPost.includes("room.hostId !== userId") &&
      roomTopicPost.includes("prisma.question.findUnique") &&
      roomTopicPost.includes('topicType === "IMAGE"') &&
      roomTopicPost.includes("imageUrl.length > 7.5 * 1024 * 1024") &&
      roomTopicPost.includes("prisma.studyRoom.update") &&
      roomTopicDelete.includes("room.hostId !== userId") &&
      roomTopicDelete.includes("activeTopicMeta: Prisma.DbNull"),
    "B2.4E preserves topic visibility, question filtering/pagination, host-only selection/upload/removal, validation, and room writes"
  );
  assert(
    b24eFiles
      .filter((file) => file !== "src/app/api/social/rooms/[roomId]/invite/route.ts")
      .every((file) => !(b24eRouteSources.get(file) || "").includes("prisma.user.findUnique")) &&
      (socialRoomInvite.match(/prisma\.user\.findUnique/g) || []).length === 1,
    "B2.4E adds no duplicate current-User lookup and retains the one caller profile query needed for invite display name"
  );
  assert(
    Array.from(b24eRouteSources.values()).every(
      (source) =>
        !/requireProAuth|isAccountAuthorizedFor|isPaid\s*[&|=]|paidUntil|planType|status:\s*402|payment|unstable_cache|\bcache\s*\(/i.test(
          source
        )
    ),
    "B2.4E adds no PRO, payment, auth caching, or unrelated authorization policy"
  );

  const deferredNonSocialSpecialCallers = [
    "src/app/api/csc/sync/route.ts",
    "src/app/api/exam/history/route.ts",
    "src/app/api/paymongo/checkout/route.ts",
    "src/app/api/paymongo/verify/route.ts",
    "src/app/api/questions/daily/route.ts",
    "src/routes/admin/criticalActions.ts",
  ];
  assert(
    deferredNonSocialSpecialCallers.every((file) => /\bverifyJWT\b/.test(read(file))),
    "six non-social special direct verifyJWT callers remain explicitly deferred after B2.4E"
  );

  const deferredB24SocialCallers = [
    "src/app/api/social/rooms/[roomId]/voice-token/route.ts",
    "src/app/api/social/rooms/[roomId]/whiteboard/route.ts",
  ];
  assert(
    deferredB24SocialCallers.every((file) => /\bverifyJWT\b/.test(read(file))),
    "voice-token and whiteboard remain unchanged direct verifyJWT callers deferred after B2.4E"
  );

  const deferredCriticalActions = read("src/routes/admin/criticalActions.ts");
  assert(
    /\bverifyJWT\b/.test(deferredCriticalActions),
    "admin criticalActions remains explicitly deferred after B2.3"
  );

  assert(
    /\bverifyJWT\b/.test(read("src/app/api/csc/sync/route.ts")) &&
      /\bverifyJWT\b/.test(read("src/app/api/questions/daily/route.ts")),
    "csc/sync and questions/daily remain deferred to the mixed-auth batch"
  );

  const login = read("src/app/api/auth/login/route.ts");
  assert(
    appearsBefore(login, "isAccountOperational(user)", "crypto.randomUUID()") &&
      appearsBefore(login, "prisma.user.updateMany", "signJWT({"),
    "login rejects banned/deleted state before session creation and JWT issuance"
  );
  assert(
    login.includes("isBanned: false") &&
      login.includes("deletedAt: null") &&
      login.includes("sessionUpdate.count !== 1"),
    "login atomically persists a session only for an operational account"
  );
  assert(
    login.includes("activeSessionId,") && login.includes("sessionId: activeSessionId"),
    "login JWT session claims match the stored activeSessionId"
  );

  const me = read("src/app/api/auth/me/route.ts");
  assert(
    me.includes("getAuthenticatedSessionResult()") && !me.includes("verifyJWT"),
    "/me uses canonical database-backed session authentication"
  );
  assert(
    me.includes('authentication.code === "SESSION_MISMATCH"') &&
      me.includes('reason: "CONCURRENT_LOGIN"'),
    "/me preserves the existing concurrent-login response for a mismatch"
  );
  assert(
    me.includes("activeSessionId: sessionId") &&
      me.includes("activityUpdate.count !== 1"),
    "/me refuses activity mutation after concurrent session/state rotation"
  );

  const profile = read("src/app/api/user/profile/route.ts");
  assert(
    profile.includes("getAuthenticatedSession(request)") && !profile.includes("verifyJWT"),
    "profile mutation uses canonical database-backed session authentication"
  );
  assert(
    profile.includes("activeSessionId: sessionId") &&
      profile.includes("isBanned: false") &&
      profile.includes("deletedAt: null") &&
      profile.includes("profileUpdate.count !== 1"),
    "profile mutation is conditional on the exact still-live session"
  );

  const forgot = read("src/app/api/auth/forgot-password/route.ts");
  assert(
    appearsBefore(forgot, "isAccountOperational(user)", "crypto.randomBytes") &&
      appearsBefore(forgot, "tokenUpdate.count !== 1", "await sendPasswordResetEmail"),
    "forgot-password blocks banned/deleted accounts before token/email side effects"
  );
  assert(
    forgot.includes("If an account exists with this email") &&
      forgot.includes("return genericSuccessResponse"),
    "forgot-password preserves a non-enumerating public response"
  );

  const reset = read("src/app/api/auth/reset-password/route.ts");
  assert(
    appearsBefore(reset, "isAccountOperational(user)", "bcrypt.hash") &&
      reset.includes("passwordUpdate.count !== 1") &&
      reset.includes("passwordResetToken: token"),
    "reset-password denies state/token races before credential mutation succeeds"
  );

  const verify = read("src/app/api/auth/verify-email/route.ts");
  assert(
    appearsBefore(verify, "isAccountOperational(user)", "prisma.user.updateMany") &&
      verify.includes("verificationUpdate.count !== 1"),
    "verify-email denies banned/deleted and concurrent-state token replay"
  );

  const resend = read("src/app/api/auth/resend-verification/route.ts");
  assert(
    appearsBefore(resend, "isAccountOperational(user)", "crypto.randomBytes") &&
      appearsBefore(resend, "tokenUpdate.count !== 1", "await sendVerificationEmail"),
    "resend-verification blocks banned/deleted accounts before token/email side effects"
  );
  assert(
    resend.includes("If an unverified account exists") &&
      resend.includes("return genericSuccessResponse"),
    "resend-verification preserves a non-enumerating public response"
  );

  const logout = read("src/app/api/auth/logout/route.ts");
  assert(
    logout.includes("id: payload.userId") &&
      logout.includes("activeSessionId: sessionId") &&
      logout.includes("activeSessionId: null"),
    "logout clears only the exact matching current database session"
  );
  assert(
    appearsBefore(logout, 'response.cookies.set("cse_session"', "try {") &&
      logout.includes("return response;"),
    "logout preserves unconditional cookie expiration"
  );
}

function runStaticSafetyChecks(): void {
  const approvedProductionFiles = [
    "src/lib/accountLifecycle.ts",
    "src/lib/serverAuth.ts",
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/me/route.ts",
    "src/app/api/auth/forgot-password/route.ts",
    "src/app/api/auth/reset-password/route.ts",
    "src/app/api/auth/verify-email/route.ts",
    "src/app/api/auth/resend-verification/route.ts",
    "src/app/api/user/profile/route.ts",
    "src/app/api/auth/logout/route.ts",
  ];
  assert(
    approvedProductionFiles
      .filter((file) => file !== "src/lib/accountLifecycle.ts" && file !== "src/lib/serverAuth.ts")
      .every((file) => !/anonymizedAt|anonymizationVersion/.test(read(file))),
    "B2.0 lifecycle foundation remains limited to canonical authentication production files"
  );

  const runtimeFiles = runtimeSourceFiles(path.join(process.cwd(), "src"));
  const userDeleteCall = /\b[A-Za-z_$][\w$]*\s*\.\s*user\s*\.\s*delete(?:Many)?\s*\(/;
  const rawUserDelete = /\bDELETE\s+FROM\s+(?:(?:"?public"?)\.)?"?User"?\b/i;
  const deleteOffenders = runtimeFiles.filter((file) => {
    const source = fs.readFileSync(file, "utf8");
    return userDeleteCall.test(source) || rawUserDelete.test(source);
  });
  assert(
    deleteOffenders.length === 0,
    "production application/runtime source contains no physical User delete"
  );

  const verifyJwtFiles = runtimeFiles
    .filter((file) => /\bverifyJWT\b/.test(fs.readFileSync(file, "utf8")))
    .map(relative)
    .sort();
  const approvedNonB2 = new Set([
    "src/lib/auth.ts",
    "src/lib/serverAuth.ts",
    "src/proxy.ts",
    "src/app/api/auth/logout/route.ts",
  ]);
  const deferredToB2 = verifyJwtFiles.filter((file) => !approvedNonB2.has(file));

  console.log(`B2_DEFERRED_VERIFY_JWT_COUNT=${deferredToB2.length}`);
  for (const file of deferredToB2) console.log(`B2_DEFERRED_VERIFY_JWT_PATH=${file}`);
  assert(
    deferredToB2.length === 8,
    "8 remaining direct verifyJWT caller files are independently inventoried after B2.4E"
  );
}

async function main(): Promise<void> {
  runPurePolicyMatrix();
  await runMockedCanonicalAuthTests();
  runSourceIntegratedRouteTests();
  runStaticSafetyChecks();

  console.log(`B1 test summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

await main();
