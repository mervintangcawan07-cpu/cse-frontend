// Relative Path: src/scripts/test-exam-attempt-token.ts
import assert from "assert";
import { createHmac, randomUUID } from "crypto";
import { SignJWT } from "jose";

console.log("▶ Running ENTITLEMENT-1E3A Exam Attempt Token Foundation Tests...\n");

async function runTests() {
  const originalSecret = process.env.JWT_SECRET;

  // Correction 5: Always set test secret unconditionally before importing modules
  const TEST_SECRET = "test_govstudyx_secret_for_regression_testing_only_do_not_use_in_prod";
  process.env.JWT_SECRET = TEST_SECRET;

  try {
    const {
      signExamAttemptToken,
      verifyExamAttemptToken,
    } = await import("@/lib/examAttemptToken");
    const { signJWT, verifyJWT } = await import("@/lib/auth");

    // Helper: test-only derived signing key using exact domain separation context
    const testSigningKey = new Uint8Array(
      createHmac("sha256", TEST_SECRET)
        .update("govstudyx:exam-attempt:v1")
        .digest()
    );

    // Test 1: Valid CUSTOM_PRACTICE token signs and verifies
    console.log("Test 1: Valid CUSTOM_PRACTICE token signs and verifies");
    {
      const qIds = ["q-custom-1", "q-custom-2", "q-custom-3"];
      const { attemptToken, attemptId } = await signExamAttemptToken({
        userId: "user-free-123",
        examType: "CUSTOM_PRACTICE",
        questionIds: qIds,
      });

      assert(typeof attemptToken === "string" && attemptToken.length > 0, "attemptToken must be a non-empty string");
      assert(typeof attemptId === "string" && attemptId.length > 0, "attemptId must be a non-empty string");

      const verified = await verifyExamAttemptToken(attemptToken);
      assert(verified !== null, "Token must verify successfully");
      assert.strictEqual(verified?.tokenPurpose, "EXAM_ATTEMPT");
      assert.strictEqual(verified?.tokenVersion, 1);
      assert.strictEqual(verified?.userId, "user-free-123");
      assert.strictEqual(verified?.attemptId, attemptId);
      assert.strictEqual(verified?.examType, "CUSTOM_PRACTICE");
      assert.strictEqual(verified?.itemCount, 3);
      assert.deepStrictEqual(verified?.questionIds, qIds);
      assert(typeof verified?.iat === "number" && Number.isInteger(verified.iat), "iat must be integer numeric");
      assert(typeof verified?.exp === "number" && Number.isInteger(verified.exp), "exp must be integer numeric");
      assert(verified.exp > verified.iat, "exp must be strictly greater than iat");
    }
    console.log("✔ Test 1 passed: CUSTOM_PRACTICE token signed and verified");

    // Test 2: Valid FULL_MOCK token signs and verifies
    console.log("Test 2: Valid FULL_MOCK token signs and verifies");
    {
      const qIds = Array.from({ length: 170 }, (_, i) => `q-mock-${i + 1}`);
      const { attemptToken, attemptId } = await signExamAttemptToken({
        userId: "user-pro-456",
        examType: "FULL_MOCK",
        questionIds: qIds,
      });

      const verified = await verifyExamAttemptToken(attemptToken);
      assert(verified !== null, "Token must verify successfully");
      assert.strictEqual(verified?.examType, "FULL_MOCK");
      assert.strictEqual(verified?.itemCount, 170);
      assert.strictEqual(verified?.questionIds.length, 170);
      assert.strictEqual(verified?.attemptId, attemptId);
      assert(typeof verified?.iat === "number" && Number.isInteger(verified.iat), "iat must be integer numeric");
      assert(typeof verified?.exp === "number" && Number.isInteger(verified.exp), "exp must be integer numeric");
      assert(verified.exp > verified.iat, "exp must be strictly greater than iat");
    }
    console.log("✔ Test 2 passed: FULL_MOCK token signed and verified");

    // Test 3: attemptId is unique per call (UUIDv4)
    console.log("Test 3: attemptId is unique per call");
    {
      const qIds = ["q-1"];
      const resA = await signExamAttemptToken({ userId: "u1", examType: "CUSTOM_PRACTICE", questionIds: qIds });
      const resB = await signExamAttemptToken({ userId: "u1", examType: "CUSTOM_PRACTICE", questionIds: qIds });
      assert.notStrictEqual(resA.attemptId, resB.attemptId, "attemptIds must be distinct");
      assert.notStrictEqual(resA.attemptToken, resB.attemptToken, "tokens must be distinct");
    }
    console.log("✔ Test 3 passed: Unique attemptId generation verified");

    // Test 4: itemCount equals exact questionIds.length
    console.log("Test 4: itemCount equals exact questionIds.length");
    {
      for (const len of [1, 5, 20, 50, 100, 170]) {
        const qIds = Array.from({ length: len }, (_, i) => `q-len-${i}`);
        const { attemptToken } = await signExamAttemptToken({
          userId: "u-len",
          examType: "CUSTOM_PRACTICE",
          questionIds: qIds,
        });
        const verified = await verifyExamAttemptToken(attemptToken);
        assert.strictEqual(verified?.itemCount, len);
        assert.strictEqual(verified?.questionIds.length, len);
      }
    }
    console.log("✔ Test 4 passed: itemCount matches questionIds.length");

    // Test 5: Tampered token fails verification
    console.log("Test 5: Tampered token fails verification");
    {
      const { attemptToken } = await signExamAttemptToken({
        userId: "u-tamper",
        examType: "CUSTOM_PRACTICE",
        questionIds: ["q-orig"],
      });

      const parts = attemptToken.split(".");
      assert.strictEqual(parts.length, 3, "JWT must contain exactly three segments");

      const signature = parts[2];
      assert(signature.length > 2, "Signature segment must have sufficient length");

      const replacement = signature[0] === "A" ? "B" : "A";
      const tamperedSignature = replacement + signature.slice(1);
      const tampered = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

      assert.strictEqual(tampered.length, attemptToken.length, "Tampered token must preserve length");
      assert.notStrictEqual(tampered, attemptToken, "Tampered token must differ from original token");

      const verified = await verifyExamAttemptToken(tampered);
      assert.strictEqual(verified, null, "Tampered token must fail verification");
    }
    console.log("✔ Test 5 passed: Tampered token rejected");

    // Test 6: Signing helper input validation
    console.log("Test 6: Signing helper input validation");
    {
      // Blank userId
      for (const blankUser of ["", "   ", "\t"]) {
        await assert.rejects(
          async () => {
            await signExamAttemptToken({
              userId: blankUser,
              examType: "CUSTOM_PRACTICE",
              questionIds: ["q-1"],
            });
          },
          /Invalid userId/,
          "Must throw on blank userId"
        );
      }

      // Unsupported examType
      await assert.rejects(
        async () => {
          await signExamAttemptToken({
            userId: "u-test",
            examType: "GUIDED_REVIEW" as any,
            questionIds: ["q-1"],
          });
        },
        /Invalid examType/,
        "Must throw on unsupported examType"
      );

      // Empty questionIds
      await assert.rejects(
        async () => {
          await signExamAttemptToken({
            userId: "u-empty",
            examType: "CUSTOM_PRACTICE",
            questionIds: [],
          });
        },
        /Invalid questionIds/,
        "Must throw on empty questionIds"
      );

      // Duplicate questionIds
      await assert.rejects(
        async () => {
          await signExamAttemptToken({
            userId: "u-dup",
            examType: "CUSTOM_PRACTICE",
            questionIds: ["q-1", "q-2", "q-1"],
          });
        },
        /Duplicate questionId detected/,
        "Must throw on duplicate question IDs"
      );

      // Blank or whitespace questionId
      for (const blankQId of ["", "   ", "\t"]) {
        await assert.rejects(
          async () => {
            await signExamAttemptToken({
              userId: "u-blank-qid",
              examType: "CUSTOM_PRACTICE",
              questionIds: ["q-1", blankQId, "q-2"],
            });
          },
          /Invalid questionId/,
          "Must throw on blank questionId"
        );
      }

      // >170 questionIds
      const tooMany = Array.from({ length: 171 }, (_, i) => `q-${i}`);
      await assert.rejects(
        async () => {
          await signExamAttemptToken({
            userId: "u-too-many",
            examType: "FULL_MOCK",
            questionIds: tooMany,
          });
        },
        /exceeds maximum limit of 170/,
        "Must throw on >170 question IDs"
      );
    }
    console.log("✔ Test 6 passed: Signing helper input validation verified");

    // Test 7: Real signed claim-confusion tests with valid HS256 signatures
    console.log("Test 7: Real signed claim-confusion tests with valid HS256 signatures");
    {
      const invalidTokens = [
        "not.a.token",
        "",
        "   ",
        "header.payload.signature",
      ];
      for (const bad of invalidTokens) {
        const res = await verifyExamAttemptToken(bad);
        assert.strictEqual(res, null, `Malformed token "${bad}" must verify to null`);
      }

      const validBasePayload = {
        tokenPurpose: "EXAM_ATTEMPT" as const,
        tokenVersion: 1 as const,
        userId: "user-base",
        attemptId: randomUUID(),
        examType: "CUSTOM_PRACTICE" as const,
        questionIds: ["q-1", "q-2"],
        itemCount: 2,
      };

      // Helper to mint test token with custom overrides
      const mintTestToken = async (
        payloadOverride: Record<string, any>,
        headerConfig?: {
          skipSub?: boolean;
          sub?: string;
          skipJti?: boolean;
          jti?: string;
          skipIat?: boolean;
          skipExp?: boolean;
          alg?: string;
        }
      ) => {
        const payload = { ...validBasePayload, ...payloadOverride };
        const alg = headerConfig?.alg ?? "HS256";
        let jwt = new SignJWT(payload).setProtectedHeader({ alg });
        if (!headerConfig?.skipSub) {
          jwt = jwt.setSubject(headerConfig?.sub ?? payload.userId);
        }
        if (!headerConfig?.skipJti) {
          jwt = jwt.setJti(headerConfig?.jti ?? payload.attemptId);
        }
        if (!headerConfig?.skipIat) {
          jwt = jwt.setIssuedAt();
        }
        if (!headerConfig?.skipExp) {
          jwt = jwt.setExpirationTime("24h");
        }
        return await jwt.sign(testSigningKey);
      };

      // 7a: tokenPurpose !== "EXAM_ATTEMPT"
      const tWrongPurpose = await mintTestToken({ tokenPurpose: "SESSION" });
      assert.strictEqual(await verifyExamAttemptToken(tWrongPurpose), null, "Wrong tokenPurpose must be rejected");

      // 7b: tokenVersion !== 1
      const tWrongVersion = await mintTestToken({ tokenVersion: 2 });
      assert.strictEqual(await verifyExamAttemptToken(tWrongVersion), null, "Wrong tokenVersion must be rejected");

      // 7c: unsupported examType
      const tWrongExamType = await mintTestToken({ examType: "GUIDED_REVIEW" });
      assert.strictEqual(await verifyExamAttemptToken(tWrongExamType), null, "Wrong examType must be rejected");

      // 7d: missing sub (Correction 1)
      const tMissingSub = await mintTestToken({}, { skipSub: true });
      assert.strictEqual(await verifyExamAttemptToken(tMissingSub), null, "Missing sub must be rejected");

      // 7e: sub !== userId (Correction 1)
      const tMismatchSub = await mintTestToken({}, { sub: "other-user-id" });
      assert.strictEqual(await verifyExamAttemptToken(tMismatchSub), null, "Mismatching sub must be rejected");

      // 7f: missing jti (Correction 2)
      const tMissingJti = await mintTestToken({}, { skipJti: true });
      assert.strictEqual(await verifyExamAttemptToken(tMissingJti), null, "Missing jti must be rejected");

      // 7g: jti !== attemptId (Correction 2)
      const tMismatchJti = await mintTestToken({}, { jti: "mismatched-jti" });
      assert.strictEqual(await verifyExamAttemptToken(tMismatchJti), null, "Mismatching jti must be rejected");

      // 7h: itemCount !== questionIds.length
      const tMismatchedCount = await mintTestToken({ itemCount: 10, questionIds: ["q-1", "q-2"] });
      assert.strictEqual(await verifyExamAttemptToken(tMismatchedCount), null, "itemCount mismatch must be rejected");

      // 7i: questionIds containing duplicate in signed payload
      const tDupQIds = await mintTestToken({ questionIds: ["q-1", "q-1"], itemCount: 2 });
      assert.strictEqual(await verifyExamAttemptToken(tDupQIds), null, "Duplicate questionIds must be rejected");

      // 7j: questionIds containing blank in signed payload
      const tBlankQId = await mintTestToken({ questionIds: ["q-1", "   "], itemCount: 2 });
      assert.strictEqual(await verifyExamAttemptToken(tBlankQId), null, "Blank questionId must be rejected");

      // 7k: expired token rejection
      const now = Math.floor(Date.now() / 1000);
      const expiredPayload = {
        ...validBasePayload,
        iat: now - 3600,
        exp: now - 1800, // Expired 30 minutes ago
      };
      const tExpired = await new SignJWT(expiredPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(validBasePayload.userId)
        .setJti(validBasePayload.attemptId)
        .sign(testSigningKey);
      assert.strictEqual(await verifyExamAttemptToken(tExpired), null, "Expired token must be rejected");

      // 7l: exp <= iat rejection (Correction 3)
      const invalidExpPayload = {
        ...validBasePayload,
        iat: now,
        exp: now, // exp equal to iat
      };
      const tEqualExp = await new SignJWT(invalidExpPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(validBasePayload.userId)
        .setJti(validBasePayload.attemptId)
        .sign(testSigningKey);
      assert.strictEqual(await verifyExamAttemptToken(tEqualExp), null, "exp <= iat must be rejected");

      // 7m: missing iat claim (Fix 2)
      const tMissingIat = await mintTestToken({}, { skipIat: true });
      assert.strictEqual(await verifyExamAttemptToken(tMissingIat), null, "Missing iat must be rejected");

      // 7n: missing exp claim (Fix 2)
      const tMissingExp = await mintTestToken({}, { skipExp: true });
      assert.strictEqual(await verifyExamAttemptToken(tMissingExp), null, "Missing exp must be rejected");

      // 7o: non-HS256 algorithm restriction (e.g. HS384)
      const tWrongAlg = await mintTestToken({}, { alg: "HS384" });
      assert.strictEqual(await verifyExamAttemptToken(tWrongAlg), null, "Non-HS256 algorithm (HS384) must be rejected");
    }
    console.log("✔ Test 7 passed: Real signed claim-confusion tests verified");

    // Test 8: Missing or blank JWT_SECRET throws critical configuration error (Correction 4)
    console.log("Test 8: Missing or blank JWT_SECRET throws critical configuration error");
    {
      const { attemptToken } = await signExamAttemptToken({
        userId: "u-config",
        examType: "CUSTOM_PRACTICE",
        questionIds: ["q-cfg"],
      });

      // Temporarily blank out JWT_SECRET
      delete process.env.JWT_SECRET;

      await assert.rejects(
        async () => {
          await verifyExamAttemptToken(attemptToken);
        },
        /Critical Configuration Error: Required environment variable JWT_SECRET is not configured/,
        "Verifier must throw critical configuration error when JWT_SECRET is missing"
      );

      process.env.JWT_SECRET = "   ";
      await assert.rejects(
        async () => {
          await verifyExamAttemptToken(attemptToken);
        },
        /Critical Configuration Error: Required environment variable JWT_SECRET is not configured/,
        "Verifier must throw critical configuration error when JWT_SECRET is blank whitespace"
      );

      // Restore test secret
      process.env.JWT_SECRET = TEST_SECRET;
    }
    console.log("✔ Test 8 passed: Missing JWT_SECRET properly fails closed and throws");

    // Test 9: Domain separation — Session JWT cannot verify as exam attempt token
    console.log("Test 9: Session JWT signed by signJWT cannot verify as exam attempt token");
    {
      const sessionJwt = await signJWT({
        userId: "user-session-123",
        email: "user@example.com",
        role: "USER",
        isPaid: false,
      });

      const attemptCheck = await verifyExamAttemptToken(sessionJwt);
      assert.strictEqual(
        attemptCheck,
        null,
        "Normal session JWT must fail verification as exam attempt token (domain separation)"
      );
    }
    console.log("✔ Test 9 passed: Session JWT rejected by exam attempt verifier (domain separation verified)");

    // Test 10: Domain separation — Exam attempt token cannot verify through ordinary verifyJWT
    console.log("Test 10: Exam attempt token cannot verify through ordinary verifyJWT session verifier");
    {
      const { attemptToken } = await signExamAttemptToken({
        userId: "user-attempt-456",
        examType: "CUSTOM_PRACTICE",
        questionIds: ["q-cross-1"],
      });

      const sessionCheck = await verifyJWT(attemptToken);
      assert.strictEqual(
        sessionCheck,
        null,
        "Exam attempt token must fail verification through ordinary verifyJWT (domain separation verified)"
      );
    }
    console.log("✔ Test 10 passed: Exam attempt token rejected by session JWT verifier");

    console.log("\n🎉 ALL 10 EXAM ATTEMPT TOKEN REGRESSION TESTS PASSED!");
  } finally {
    // Restore prior environment state
    if (originalSecret !== undefined) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
