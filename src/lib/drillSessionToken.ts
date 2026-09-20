// Relative Path: src/lib/drillSessionToken.ts
import { createHmac, randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";

export const DRILL_SESSION_TOKEN_TTL = "4h";

export interface SignDrillSessionTokenInput {
  userId: string;
  questionIds: string[];
  drillMode?: "ELIMINATION";
}

export interface SignDrillSessionTokenResult {
  drillSessionToken: string;
  sessionId: string;
}

export interface VerifiedDrillSessionToken {
  tokenPurpose: "DRILL_SESSION";
  tokenVersion: 1;
  userId: string;
  sessionId: string;
  questionIds: string[];
  drillMode: "ELIMINATION";
  itemCount: number;
  iat: number;
  exp: number;
}

export type VerifyDrillSessionTokenResult =
  | { valid: true; claims: VerifiedDrillSessionToken }
  | { valid: false; reason: "MISSING_TOKEN" | "EXPIRED" | "USER_MISMATCH" | "INVALID_SIGNATURE" | "MALFORMED" };

/**
 * Derives a domain-separated HMAC-SHA256 signing key from root JWT_SECRET.
 * Salt: "govstudyx:drill-session:v1" ensures separation from auth and exam tokens.
 */
function getDrillSessionSigningKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "Critical Configuration Error: Required environment variable JWT_SECRET is not configured."
    );
  }
  const derived = createHmac("sha256", secret)
    .update("govstudyx:drill-session:v1")
    .digest();
  return new Uint8Array(derived);
}

/**
 * Issues a cryptographically signed Drill Session token binding:
 * - authenticated userId
 * - unique sessionId
 * - exact list of issued questionIds
 * - drillMode ("ELIMINATION")
 * - 4h expiration
 */
export async function signDrillSessionToken(
  input: SignDrillSessionTokenInput
): Promise<SignDrillSessionTokenResult> {
  const { userId, questionIds, drillMode = "ELIMINATION" } = input;

  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Invalid userId: must be a non-empty string.");
  }

  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new Error("Invalid questionIds: must be a non-empty array of question IDs.");
  }

  const seenIds = new Set<string>();
  for (const qid of questionIds) {
    if (typeof qid !== "string" || !qid.trim()) {
      throw new Error("Invalid questionId: every question ID must be a non-empty string.");
    }
    seenIds.add(qid);
  }

  const sessionId = randomUUID();
  const signingKey = getDrillSessionSigningKey();

  const payload = {
    tokenPurpose: "DRILL_SESSION" as const,
    tokenVersion: 1 as const,
    userId: userId.trim(),
    sessionId,
    questionIds: Array.from(seenIds),
    drillMode,
    itemCount: seenIds.size,
  };

  const drillSessionToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(DRILL_SESSION_TOKEN_TTL)
    .setSubject(userId.trim())
    .setJti(sessionId)
    .sign(signingKey);

  return {
    drillSessionToken,
    sessionId,
  };
}

/**
 * Cryptographically verifies and validates a Drill Session token.
 */
export async function verifyDrillSessionToken(
  token: string | null | undefined,
  expectedUserId: string
): Promise<VerifyDrillSessionTokenResult> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return { valid: false, reason: "MISSING_TOKEN" };
  }

  try {
    const signingKey = getDrillSessionSigningKey();
    const { payload } = await jwtVerify(token.trim(), signingKey, {
      algorithms: ["HS256"],
    });

    if (
      payload.tokenPurpose !== "DRILL_SESSION" ||
      payload.tokenVersion !== 1 ||
      payload.drillMode !== "ELIMINATION" ||
      !Array.isArray(payload.questionIds) ||
      typeof payload.userId !== "string" ||
      typeof payload.sessionId !== "string"
    ) {
      return { valid: false, reason: "MALFORMED" };
    }

    if (payload.userId !== expectedUserId.trim()) {
      return { valid: false, reason: "USER_MISMATCH" };
    }

    const claims: VerifiedDrillSessionToken = {
      tokenPurpose: payload.tokenPurpose,
      tokenVersion: payload.tokenVersion,
      userId: payload.userId,
      sessionId: payload.sessionId,
      questionIds: payload.questionIds as string[],
      drillMode: payload.drillMode as "ELIMINATION",
      itemCount: Number(payload.itemCount) || (payload.questionIds as string[]).length,
      iat: Number(payload.iat),
      exp: Number(payload.exp),
    };

    return { valid: true, claims };
  } catch (error: any) {
    if (error?.code === "ERR_JWT_EXPIRED") {
      return { valid: false, reason: "EXPIRED" };
    }
    if (error?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || error?.code === "ERR_JWS_INVALID") {
      return { valid: false, reason: "INVALID_SIGNATURE" };
    }
    return { valid: false, reason: "MALFORMED" };
  }
}

