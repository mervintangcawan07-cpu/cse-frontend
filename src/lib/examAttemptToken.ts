// Relative Path: src/lib/examAttemptToken.ts
import { createHmac, randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";

export const EXAM_ATTEMPT_TOKEN_TTL = "24h";

export type ExamAttemptType = "CUSTOM_PRACTICE" | "FULL_MOCK";

export interface SignExamAttemptTokenInput {
  userId: string;
  examType: ExamAttemptType;
  questionIds: string[];
}

export interface SignExamAttemptTokenResult {
  attemptToken: string;
  attemptId: string;
}

export interface VerifiedExamAttemptToken {
  tokenPurpose: "EXAM_ATTEMPT";
  tokenVersion: 1;
  userId: string;
  attemptId: string;
  examType: ExamAttemptType;
  questionIds: string[];
  itemCount: number;
  iat: number;
  exp: number;
}

/**
 * Derives a domain-separated HMAC-SHA256 signing key from the root JWT_SECRET.
 * Ensures exam attempt tokens cannot be confused with session/auth JWTs.
 *
 * Throws a critical configuration error if JWT_SECRET is missing or blank.
 */
function getExamAttemptSigningKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "Critical Configuration Error: Required environment variable JWT_SECRET is not configured."
    );
  }
  const derived = createHmac("sha256", secret)
    .update("govstudyx:exam-attempt:v1")
    .digest();
  return new Uint8Array(derived);
}

/**
 * Issues a cryptographically signed exam attempt token binding:
 * - authenticated userId
 * - unique attemptId (crypto.randomUUID())
 * - examType ("CUSTOM_PRACTICE" | "FULL_MOCK")
 * - exact list of returned questionIds
 * - authoritative itemCount (derived from questionIds.length)
 * - 24h expiration
 *
 * NOTE: This stateless signed token provides authenticity, integrity, and binding.
 * It does NOT provide single-use replay protection on its own. Replay protection
 * will be enforced with server-side attempt tracking in ENTITLEMENT-1E3B.
 */
export async function signExamAttemptToken(
  input: SignExamAttemptTokenInput
): Promise<SignExamAttemptTokenResult> {
  const { userId, examType, questionIds } = input;

  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Invalid userId: must be a non-empty string.");
  }

  if (examType !== "CUSTOM_PRACTICE" && examType !== "FULL_MOCK") {
    throw new Error(`Invalid examType: "${examType}". Must be CUSTOM_PRACTICE or FULL_MOCK.`);
  }

  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new Error("Invalid questionIds: must be a non-empty array of question IDs.");
  }

  if (questionIds.length > 170) {
    throw new Error(`Invalid questionIds: count ${questionIds.length} exceeds maximum limit of 170.`);
  }

  const seenIds = new Set<string>();
  for (const qid of questionIds) {
    if (typeof qid !== "string" || !qid.trim()) {
      throw new Error("Invalid questionId: every question ID must be a non-empty string.");
    }
    if (seenIds.has(qid)) {
      throw new Error(`Duplicate questionId detected in attempt token payload: "${qid}".`);
    }
    seenIds.add(qid);
  }

  const attemptId = randomUUID();
  const signingKey = getExamAttemptSigningKey();

  const payload = {
    tokenPurpose: "EXAM_ATTEMPT" as const,
    tokenVersion: 1 as const,
    userId: userId.trim(),
    attemptId,
    examType,
    questionIds,
    itemCount: questionIds.length,
  };

  const attemptToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXAM_ATTEMPT_TOKEN_TTL)
    .setSubject(userId.trim())
    .setJti(attemptId)
    .sign(signingKey);

  return {
    attemptToken,
    attemptId,
  };
}

/**
 * Verifies and decodes an exam attempt token.
 * Validates HS256 signature, expiry, purpose, version, user binding (sub === userId),
 * attempt ID (jti === attemptId), attempt type, question ID bounds, and mandatory numeric iat/exp.
 *
 * Critical configuration failures (missing/blank JWT_SECRET) throw immediately
 * and are NOT swallowed or silently converted to null.
 *
 * Returns typed validated claims or null on malformed/invalid/expired tokens.
 */
export async function verifyExamAttemptToken(
  token: string
): Promise<VerifiedExamAttemptToken | null> {
  if (typeof token !== "string" || !token.trim()) {
    return null;
  }

  // Obtain derived signing key outside token verification try/catch
  // so critical configuration errors (missing JWT_SECRET) fail closed and throw.
  const signingKey = getExamAttemptSigningKey();

  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ["HS256"],
    });

    if (payload.tokenPurpose !== "EXAM_ATTEMPT") {
      return null;
    }

    if (payload.tokenVersion !== 1) {
      return null;
    }

    if (typeof payload.userId !== "string" || !payload.userId.trim()) {
      return null;
    }

    // sub is mandatory and must match userId exactly
    if (typeof payload.sub !== "string" || payload.sub !== payload.userId) {
      return null;
    }

    if (typeof payload.attemptId !== "string" || !payload.attemptId.trim()) {
      return null;
    }

    // jti is mandatory and must match attemptId exactly
    if (
      typeof payload.jti !== "string" ||
      !payload.jti.trim() ||
      payload.jti !== payload.attemptId
    ) {
      return null;
    }

    if (payload.examType !== "CUSTOM_PRACTICE" && payload.examType !== "FULL_MOCK") {
      return null;
    }

    if (!Array.isArray(payload.questionIds)) {
      return null;
    }

    if (payload.questionIds.length < 1 || payload.questionIds.length > 170) {
      return null;
    }

    const seenIds = new Set<string>();
    for (const qid of payload.questionIds) {
      if (typeof qid !== "string" || !qid.trim()) {
        return null;
      }
      if (seenIds.has(qid)) {
        return null;
      }
      seenIds.add(qid);
    }

    if (typeof payload.itemCount !== "number" || !Number.isInteger(payload.itemCount)) {
      return null;
    }

    if (payload.itemCount !== payload.questionIds.length) {
      return null;
    }

    if (payload.itemCount < 1 || payload.itemCount > 170) {
      return null;
    }

    // Mandatory integer iat and exp claims, with exp > iat
    if (
      typeof payload.iat !== "number" ||
      !Number.isInteger(payload.iat) ||
      typeof payload.exp !== "number" ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= payload.iat
    ) {
      return null;
    }

    return {
      tokenPurpose: "EXAM_ATTEMPT",
      tokenVersion: 1,
      userId: payload.userId,
      attemptId: payload.attemptId,
      examType: payload.examType,
      questionIds: payload.questionIds,
      itemCount: payload.itemCount,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
