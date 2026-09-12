// Relative Path: src/lib/guidedReviewToken.ts
import { createHmac, randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";

export const GUIDED_REVIEW_TOKEN_TTL = "24h";

export interface SignGuidedReviewTokenInput {
  userId: string;
  questionIds: string[];
}

export interface SignGuidedReviewTokenResult {
  guidedReviewToken: string;
  sessionId: string;
}

export interface VerifiedGuidedReviewToken {
  tokenPurpose: "GUIDED_REVIEW";
  tokenVersion: 1;
  userId: string;
  sessionId: string;
  questionIds: string[];
  itemCount: number;
  iat: number;
  exp: number;
}

/**
 * Derives a domain-separated HMAC-SHA256 signing key from root JWT_SECRET.
 * Uses salt "govstudyx:guided-review:v1" so guided review tokens cannot be
 * verified as auth JWTs or standard exam attempt tokens.
 *
 * Throws a critical configuration error if JWT_SECRET is missing or blank.
 */
function getGuidedReviewSigningKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "Critical Configuration Error: Required environment variable JWT_SECRET is not configured."
    );
  }
  const derived = createHmac("sha256", secret)
    .update("govstudyx:guided-review:v1")
    .digest();
  return new Uint8Array(derived);
}

/**
 * Issues a cryptographically signed Guided Review session token binding:
 * - authenticated userId
 * - unique sessionId (crypto.randomUUID())
 * - exact list of returned questionIds (1..170)
 * - authoritative itemCount (derived from questionIds.length)
 * - 24h expiration
 * - sub = userId
 * - jti = sessionId
 */
export async function signGuidedReviewToken(
  input: SignGuidedReviewTokenInput
): Promise<SignGuidedReviewTokenResult> {
  const { userId, questionIds } = input;

  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Invalid userId: must be a non-empty string.");
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
      throw new Error(`Duplicate questionId detected in guided review token payload: "${qid}".`);
    }
    seenIds.add(qid);
  }

  const sessionId = randomUUID();
  const signingKey = getGuidedReviewSigningKey();

  const payload = {
    tokenPurpose: "GUIDED_REVIEW" as const,
    tokenVersion: 1 as const,
    userId: userId.trim(),
    sessionId,
    questionIds,
    itemCount: questionIds.length,
  };

  const guidedReviewToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(GUIDED_REVIEW_TOKEN_TTL)
    .setSubject(userId.trim())
    .setJti(sessionId)
    .sign(signingKey);

  return {
    guidedReviewToken,
    sessionId,
  };
}

export const createGuidedReviewToken = signGuidedReviewToken;

/**
 * Verifies and decodes a Guided Review token.
 * Validates HS256 signature, expiry, purpose, version, user binding (sub === userId),
 * session ID (jti === sessionId), question ID bounds, and mandatory numeric iat/exp.
 *
 * Critical configuration failures (missing/blank JWT_SECRET) throw immediately.
 * Returns typed validated claims or null on malformed/invalid/expired tokens.
 */
export async function verifyGuidedReviewToken(
  token: string
): Promise<VerifiedGuidedReviewToken | null> {
  if (typeof token !== "string" || !token.trim()) {
    return null;
  }

  const signingKey = getGuidedReviewSigningKey();

  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ["HS256"],
    });

    if (payload.tokenPurpose !== "GUIDED_REVIEW") {
      return null;
    }

    if (payload.tokenVersion !== 1) {
      return null;
    }

    if (typeof payload.userId !== "string" || !payload.userId.trim()) {
      return null;
    }

    if (payload.sub !== payload.userId) {
      return null;
    }

    if (typeof payload.sessionId !== "string" || !payload.sessionId.trim()) {
      return null;
    }

    if (payload.jti !== payload.sessionId) {
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

    if (!Number.isInteger(payload.itemCount) || payload.itemCount !== payload.questionIds.length) {
      return null;
    }

    if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
      return null;
    }

    if ((payload.exp as number) <= (payload.iat as number)) {
      return null;
    }

    return {
      tokenPurpose: "GUIDED_REVIEW",
      tokenVersion: 1,
      userId: payload.userId,
      sessionId: payload.sessionId,
      questionIds: payload.questionIds,
      itemCount: payload.itemCount as number,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}
