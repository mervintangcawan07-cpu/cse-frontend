// Relative Path: src/lib/payment/refundExecutionSecurityContract.ts

export interface RefundExecutionAdminIdentity {
  id: string;
  role: string;
}

export interface RefundExecutionSudoTicket {
  userId: string;
  role: string;
}

export interface RefundExecutionSudoVerification {
  valid: boolean;
  ticket?: RefundExecutionSudoTicket;
  reason?: string;
}

export type RefundExecutionRateLimitDecision =
  | {
      status: "ALLOWED";
    }
  | {
      status: "DENIED";
      retryAfterSeconds?: number;
    }
  | {
      status: "UNAVAILABLE";
      reason?: string;
    };

export interface ValidateRefundExecutionSecurityInput {
  authenticatedUser:
    | RefundExecutionAdminIdentity
    | null
    | undefined;

  sudoVerification:
    | RefundExecutionSudoVerification
    | null
    | undefined;

  idempotencyKey:
    | string
    | null
    | undefined;

  rateLimit:
    | RefundExecutionRateLimitDecision
    | null
    | undefined;
}

export interface ValidatedRefundExecutionSecurity {
  actorId: string;
  idempotencyKey: string;
}

export class RefundExecutionSecurityError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly retryAfterSeconds?: number;

  constructor(
    code: string,
    message: string,
    status: number,
    retryAfterSeconds?: number
  ) {
    super(message);

    this.name =
      "RefundExecutionSecurityError";

    this.code = code;
    this.status = status;
    this.retryAfterSeconds =
      retryAfterSeconds;

    Object.setPrototypeOf(
      this,
      RefundExecutionSecurityError.prototype
    );
  }
}

function normalizeRequiredIdentity(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeIdempotencyKey(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

/**
 * Pure authorization contract for refund execution.
 *
 * Required order:
 *
 * 1. authenticated administrator
 * 2. valid sudo ticket
 * 3. sudo ADMIN role
 * 4. sudo userId === authenticated admin ID
 * 5. mandatory client Idempotency-Key
 * 6. fail-closed distributed rate-limit decision
 *
 * This function performs no database access, network call,
 * environment access, token validation, or provider submission.
 */
export function validateRefundExecutionSecurity(
  input: ValidateRefundExecutionSecurityInput
): ValidatedRefundExecutionSecurity {
  const actorId =
    normalizeRequiredIdentity(
      input?.authenticatedUser?.id
    );

  if (!actorId) {
    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_AUTH_REQUIRED",
      "Authentication is required for refund execution.",
      401
    );
  }

  if (
    input.authenticatedUser?.role !==
    "ADMIN"
  ) {
    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_ADMIN_REQUIRED",
      "Administrator privileges are required for refund execution.",
      403
    );
  }

  const sudo =
    input.sudoVerification;

  if (
    !sudo?.valid ||
    !sudo.ticket
  ) {
    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_SUDO_REQUIRED",
      "Valid sudo re-authentication is required for refund execution.",
      403
    );
  }

  if (
    sudo.ticket.role !==
    "ADMIN"
  ) {
    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_SUDO_ROLE_INVALID",
      "Sudo ticket is not authorized for administrator refund execution.",
      403
    );
  }

  const sudoUserId =
    normalizeRequiredIdentity(
      sudo.ticket.userId
    );

  if (
    !sudoUserId ||
    sudoUserId !== actorId
  ) {
    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_SUDO_IDENTITY_MISMATCH",
      "Sudo identity does not match the authenticated administrator.",
      403
    );
  }

  const idempotencyKey =
    normalizeIdempotencyKey(
      input.idempotencyKey
    );

  if (!idempotencyKey) {
    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_IDEMPOTENCY_REQUIRED",
      "Idempotency-Key is required for refund execution.",
      400
    );
  }

  if (
    idempotencyKey.length > 128
  ) {
    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_IDEMPOTENCY_INVALID",
      "Idempotency-Key is invalid for refund execution.",
      400
    );
  }

  const rateLimit =
    input.rateLimit;

  if (
    !rateLimit ||
    rateLimit.status ===
      "UNAVAILABLE"
  ) {
    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_RATE_LIMIT_UNAVAILABLE",
      "Refund execution is temporarily unavailable because its distributed safety limiter cannot be verified.",
      503
    );
  }

  if (
    rateLimit.status ===
    "DENIED"
  ) {
    const retryAfterSeconds =
      Number.isSafeInteger(
        rateLimit.retryAfterSeconds
      ) &&
      (rateLimit.retryAfterSeconds ??
        0) > 0
        ? rateLimit.retryAfterSeconds
        : undefined;

    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_RATE_LIMITED",
      "Too many refund execution attempts.",
      429,
      retryAfterSeconds
    );
  }

  if (
    rateLimit.status !==
    "ALLOWED"
  ) {
    throw new RefundExecutionSecurityError(
      "REFUND_EXECUTION_RATE_LIMIT_INVALID",
      "Refund execution rate-limit state is invalid.",
      503
    );
  }

  return {
    actorId,
    idempotencyKey,
  };
}
