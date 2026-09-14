import fs from "node:fs";
import path from "node:path";
import {
  evaluateAccountSession,
  type ExistingAccountState,
} from "../lib/accountLifecycle";

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

function runTests(): void {
  console.log("============================================================");
  console.log("AUTH-1A PASSWORD RESET SESSION REVOCATION VERIFICATION SUITE");
  console.log("============================================================");

  const resetRoutePath = "src/app/api/auth/reset-password/route.ts";
  const source = read(resetRoutePath);

  // 1. reset-password route still uses conditional updateMany
  assert(
    source.includes("await prisma.user.updateMany({"),
    "Test 1: reset-password uses conditional updateMany"
  );

  // 2. successful password mutation still sets password: hashedPassword
  assert(
    source.includes("password: hashedPassword,"),
    "Test 2: password mutation sets password: hashedPassword"
  );

  // 3. reset token is still consumed: passwordResetToken: null
  assert(
    source.includes("passwordResetToken: null,"),
    "Test 3: reset token is consumed by setting passwordResetToken: null"
  );

  // 4. expiration is still cleared: passwordResetExpires: null
  assert(
    source.includes("passwordResetExpires: null,"),
    "Test 4: reset token expiration is cleared by setting passwordResetExpires: null"
  );

  // 5. SAME update data object now includes activeSessionId: null
  assert(
    source.includes("activeSessionId: null,"),
    "Test 5: update data object includes activeSessionId: null"
  );

  // 6. SAME update data object includes lastActiveAt: null
  assert(
    source.includes("lastActiveAt: null,"),
    "Test 6: update data object includes lastActiveAt: null"
  );

  // 7. session revocation is not implemented as a separate second user update
  const userUpdateOccurrences = (source.match(/prisma\.user\.update/g) || []).length;
  assert(
    userUpdateOccurrences === 1,
    "Test 7: atomic single updateMany used (no separate second update query)"
  );

  // 8. existing CAS WHERE protections remain
  const updateManyBlock = source.slice(source.indexOf("prisma.user.updateMany"));
  const whereMatch = updateManyBlock.includes("id: user.id") &&
    updateManyBlock.includes('role: "USER"') &&
    updateManyBlock.includes("isBanned: false") &&
    updateManyBlock.includes("deletedAt: null") &&
    updateManyBlock.includes("passwordResetToken: token") &&
    updateManyBlock.includes("passwordResetExpires: { gt: new Date() }");
  assert(
    whereMatch,
    "Test 8: all CAS WHERE guards remain strictly enforced"
  );

  // 9. passwordUpdate.count === 1 remains required
  assert(
    source.includes("if (passwordUpdate.count !== 1)"),
    "Test 9: passwordUpdate.count === 1 requirement is strictly preserved"
  );

  // 10. reset-password does NOT call signJWT
  assert(
    !source.includes("signJWT"),
    "Test 10: reset-password does not call signJWT or issue tokens"
  );

  // 11. reset-password does NOT create crypto.randomUUID() for a new active session
  assert(
    !source.includes("crypto.randomUUID") && !source.includes("randomUUID"),
    "Test 11: reset-password does not generate a new activeSessionId or rotate to a dummy UUID"
  );

  // 12. success response still preserves success JSON contract
  assert(
    source.includes("success: true,") &&
      source.includes('message: "Password reset successful! You can now log in."'),
    "Test 12: success response preserves exact message and success boolean"
  );

  // 13. success response expires cse_session
  assert(
    source.includes('response.cookies.set("cse_session", "", {') &&
      source.includes("httpOnly: true,") &&
      source.includes("expires: new Date(0),") &&
      source.includes('path: "/",'),
    "Test 13: success response explicitly expires cse_session cookie"
  );

  // 14-18. Real accountLifecycle policy evaluation tests
  // 14. Old direct success return is completely absent (no early return before cookie expiration)
  const hasDirectSuccessReturn = /return\s+NextResponse\.json\(\s*\{\s*success:\s*true/.test(source);
  assert(
    !hasDirectSuccessReturn,
    "Test 14: old direct success return is absent; no early return before cookie expiration"
  );

  // 15. Success flow ordering and reachability: count check -> const response -> cookies.set -> return response
  const countCheckIndex = source.indexOf("if (passwordUpdate.count !== 1)");
  const constResponseIndex = source.indexOf("const response = NextResponse.json({");
  const cookiesSetIndex = source.indexOf('response.cookies.set("cse_session", "", {');
  const returnResponseIndex = source.indexOf("return response;");

  const isOrdered = countCheckIndex >= 0 &&
    countCheckIndex < constResponseIndex &&
    constResponseIndex < cookiesSetIndex &&
    cookiesSetIndex < returnResponseIndex;

  assert(
    isOrdered,
    "Test 15: success response and cookie expiration are strictly ordered after count === 1 check"
  );

  // 16. No return statement exists between count check block and response.cookies.set
  const countCheckBlockEnd = source.indexOf("}", countCheckIndex);
  const codeBetweenCountCheckAndCookies = source.slice(countCheckBlockEnd, cookiesSetIndex);
  assert(
    !codeBetweenCountCheckAndCookies.includes("return"),
    "Test 16: no early return exists between count check block and cookie expiration"
  );

  // 17-21. Real accountLifecycle policy evaluation tests
  const baseAccount: ExistingAccountState = {
    anonymizedAt: null,
    anonymizationVersion: null,
    isBanned: false,
    deletedAt: null,
    activeSessionId: "session-S1",
  };

  // 17. accountLifecycle existing behavior rejects activeSessionId: null as SESSION_REVOKED
  const nullSessionDecision = evaluateAccountSession({
    userId: "user-123",
    presentedSessionId: "session-S1",
    user: { ...baseAccount, activeSessionId: null },
  });
  assert(
    !nullSessionDecision.allowed &&
      nullSessionDecision.code === "SESSION_REVOKED",
    "Test 17: accountLifecycle evaluates activeSessionId: null as SESSION_REVOKED"
  );

  // 18. A previously valid simulated session: S1 allowed BEFORE revocation
  const preResetDecision = evaluateAccountSession({
    userId: "user-123",
    presentedSessionId: "session-S1",
    user: baseAccount,
  });
  assert(
    preResetDecision.allowed === true &&
      preResetDecision.sessionId === "session-S1",
    "Test 18: pre-reset session S1 evaluates as allowed before reset"
  );

  // 19. The same presented session must evaluate as SESSION_REVOKED after database activeSessionId = null
  const postResetDecision = evaluateAccountSession({
    userId: "user-123",
    presentedSessionId: "session-S1",
    user: { ...baseAccount, activeSessionId: null },
  });
  assert(
    !postResetDecision.allowed &&
      postResetDecision.code === "SESSION_REVOKED",
    "Test 19: old session S1 is rejected as SESSION_REVOKED after password reset"
  );

  // 20. A future new session S2 evaluates as allowed
  const newLoginDecision = evaluateAccountSession({
    userId: "user-123",
    presentedSessionId: "session-S2",
    user: { ...baseAccount, activeSessionId: "session-S2" },
  });
  assert(
    newLoginDecision.allowed === true &&
      newLoginDecision.sessionId === "session-S2",
    "Test 20: future new login session S2 evaluates as allowed"
  );

  // 21. SESSION_MISMATCH behavior remains unchanged (old token presented against new session)
  const mismatchDecision = evaluateAccountSession({
    userId: "user-123",
    presentedSessionId: "session-S1",
    user: { ...baseAccount, activeSessionId: "session-S2" },
  });
  assert(
    !mismatchDecision.allowed &&
      mismatchDecision.code === "SESSION_MISMATCH",
    "Test 21: presenting old token S1 against new session S2 evaluates as SESSION_MISMATCH"
  );

  // 22. No reset-token hashing logic was introduced
  assert(
    !source.includes("createHash") &&
      !source.includes("sha256") &&
      !source.includes("SHA-256"),
    "Test 22: reset-token hashing was not introduced in this slice (deferred to AUTH-1B)"
  );

  // 23. No schema/migration dependency was introduced
  const schemaPath = "prisma/schema.prisma";
  const schema = read(schemaPath);
  assert(
    schema.includes("activeSessionId          String?") &&
      schema.includes("lastActiveAt             DateTime?"),
    "Test 23: User model already supports nullable activeSessionId and lastActiveAt without migrations"
  );

  console.log("============================================================");
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("============================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
