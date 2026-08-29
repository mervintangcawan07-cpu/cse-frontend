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
    deferredToB2.length === 65,
    "65 remaining direct verifyJWT callers are explicitly deferred after B2.1"
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
