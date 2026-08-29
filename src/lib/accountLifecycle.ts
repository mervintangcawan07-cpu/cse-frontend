export type AccountSessionFailureCode =
  | "INVALID_TOKEN"
  | "INVALID_USER_ID"
  | "INVALID_SESSION_ID"
  | "USER_NOT_FOUND"
  | "TERMINAL_ANONYMIZED"
  | "BANNED"
  | "CLOSURE_PENDING"
  | "SESSION_REVOKED"
  | "SESSION_MISMATCH";

export type AccountSessionDecision =
  | { allowed: true; userId: string; sessionId: string }
  | { allowed: false; code: AccountSessionFailureCode };

export interface ExistingAccountState {
  anonymizedAt: Date | null;
  anonymizationVersion: number | null;
  isBanned: boolean;
  deletedAt: Date | null;
  activeSessionId: string | null;
}

export interface AccountSessionInput {
  userId: unknown;
  presentedSessionId: unknown;
  user: ExistingAccountState | null;
}

export interface TokenSessionClaims {
  userId?: unknown;
  sessionId?: unknown;
  activeSessionId?: unknown;
}

export interface AccountSessionDependencies<
  TUser extends ExistingAccountState
> {
  verifyToken(token: string): Promise<TokenSessionClaims | null>;
  findUserById(userId: string): Promise<TUser | null>;
}

export type AuthenticatedAccountSession<
  TUser extends ExistingAccountState
> =
  | { allowed: true; user: TUser; userId: string; sessionId: string }
  | { allowed: false; code: AccountSessionFailureCode };

export type AccountAuthorizationRequirement = "USER" | "ADMIN" | "PRO";

export interface AccountAuthorizationState {
  role: "USER" | "ADMIN";
  isPaid: boolean;
  paidUntil?: Date | null;
}

export function isValidIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim()
  );
}

/**
 * Supports the two existing JWT claim names while rejecting ambiguous or
 * malformed claims. New login tokens intentionally contain both with the same
 * value; older tokens may contain only activeSessionId.
 */
export function getPresentedSessionId(
  claims: TokenSessionClaims
): string | null {
  const hasSessionId = claims.sessionId !== undefined;
  const hasActiveSessionId = claims.activeSessionId !== undefined;

  if (!hasSessionId && !hasActiveSessionId) return null;

  if (hasSessionId && !isValidIdentifier(claims.sessionId)) return null;
  if (
    hasActiveSessionId &&
    !isValidIdentifier(claims.activeSessionId)
  ) {
    return null;
  }

  if (
    hasSessionId &&
    hasActiveSessionId &&
    claims.sessionId !== claims.activeSessionId
  ) {
    return null;
  }

  return (claims.sessionId ?? claims.activeSessionId) as string;
}

export function isAccountOperational(
  user: Pick<
    ExistingAccountState,
    "anonymizedAt" | "anonymizationVersion" | "isBanned" | "deletedAt"
  >
): boolean {
  return (
    user.anonymizedAt === null &&
    user.anonymizationVersion === null &&
    user.isBanned === false &&
    user.deletedAt === null
  );
}

export function isAccountAuthorizedFor(
  user: AccountAuthorizationState,
  requirement: AccountAuthorizationRequirement,
  now = Date.now()
): boolean {
  if (requirement === "USER") return true;
  if (requirement === "ADMIN") return user.role === "ADMIN";

  return (
    user.role === "ADMIN" ||
    (user.isPaid && (!user.paidUntil || user.paidUntil.getTime() > now))
  );
}

export function evaluateAccountSession(
  input: AccountSessionInput
): AccountSessionDecision {
  if (!isValidIdentifier(input.userId)) {
    return { allowed: false, code: "INVALID_USER_ID" };
  }

  if (!isValidIdentifier(input.presentedSessionId)) {
    return { allowed: false, code: "INVALID_SESSION_ID" };
  }

  if (!input.user) {
    return { allowed: false, code: "USER_NOT_FOUND" };
  }

  if (
    input.user.anonymizedAt !== null ||
    input.user.anonymizationVersion !== null
  ) {
    return { allowed: false, code: "TERMINAL_ANONYMIZED" };
  }

  if (input.user.isBanned) {
    return { allowed: false, code: "BANNED" };
  }

  if (input.user.deletedAt !== null) {
    return { allowed: false, code: "CLOSURE_PENDING" };
  }

  if (!isValidIdentifier(input.user.activeSessionId)) {
    return { allowed: false, code: "SESSION_REVOKED" };
  }

  if (input.user.activeSessionId !== input.presentedSessionId) {
    return { allowed: false, code: "SESSION_MISMATCH" };
  }

  return {
    allowed: true,
    userId: input.userId,
    sessionId: input.presentedSessionId,
  };
}

export async function authenticateExistingAccountSession<
  TUser extends ExistingAccountState
>(
  token: string,
  dependencies: AccountSessionDependencies<TUser>
): Promise<AuthenticatedAccountSession<TUser>> {
  const payload = await dependencies.verifyToken(token);
  if (!payload) return { allowed: false, code: "INVALID_TOKEN" };
  if (!isValidIdentifier(payload.userId)) {
    return { allowed: false, code: "INVALID_USER_ID" };
  }

  const presentedSessionId = getPresentedSessionId(payload);
  if (!presentedSessionId) {
    return { allowed: false, code: "INVALID_SESSION_ID" };
  }

  const user = await dependencies.findUserById(payload.userId);
  const decision = evaluateAccountSession({
    userId: payload.userId,
    presentedSessionId,
    user,
  });

  if (!decision.allowed) return decision;
  if (!user) return { allowed: false, code: "USER_NOT_FOUND" };

  return {
    allowed: true,
    user,
    userId: decision.userId,
    sessionId: decision.sessionId,
  };
}
