// Relative Path: src/lib/payment/refundOperationStateMachine.ts

import { RefundOperationStatus } from "@prisma/client";

export type RefundLifecycleEvent =
  | "START_SUBMISSION"
  | "PROVIDER_PENDING"
  | "PROVIDER_PROCESSING"
  | "PROVIDER_SUCCEEDED"
  | "PROVIDER_FAILED"
  | "AMBIGUOUS_RESULT"
  | "DEFINITIVE_REJECTION"
  | "REQUIRE_MANUAL_REVIEW";

export class RefundLifecycleTransitionError extends Error {
  public readonly code = "REFUND_INVALID_STATE_TRANSITION";
  public readonly currentStatus: RefundOperationStatus;
  public readonly event: RefundLifecycleEvent;

  constructor(
    currentStatus: RefundOperationStatus,
    event: RefundLifecycleEvent
  ) {
    super(
      `Invalid refund lifecycle transition: ${currentStatus} + ${event}`
    );

    this.name = "RefundLifecycleTransitionError";
    this.currentStatus = currentStatus;
    this.event = event;

    Object.setPrototypeOf(
      this,
      RefundLifecycleTransitionError.prototype
    );
  }
}

/**
 * Explicit refund lifecycle transition table.
 *
 * UNKNOWN intentionally cannot transition back to SUBMITTING here.
 * A future same-key retry must first pass the separate recovery policy:
 * authoritative lookup + provider idempotency-window verification.
 */
const TRANSITIONS: Record<
  RefundOperationStatus,
  Partial<Record<RefundLifecycleEvent, RefundOperationStatus>>
> = {
  [RefundOperationStatus.RESERVED]: {
    START_SUBMISSION:
      RefundOperationStatus.SUBMITTING,

    REQUIRE_MANUAL_REVIEW:
      RefundOperationStatus.MANUAL_REVIEW_REQUIRED,
  },

  [RefundOperationStatus.SUBMITTING]: {
    PROVIDER_PENDING:
      RefundOperationStatus.PENDING,

    PROVIDER_PROCESSING:
      RefundOperationStatus.PROCESSING,

    PROVIDER_SUCCEEDED:
      RefundOperationStatus.SUCCEEDED,

    PROVIDER_FAILED:
      RefundOperationStatus.FAILED,

    AMBIGUOUS_RESULT:
      RefundOperationStatus.UNKNOWN,

    DEFINITIVE_REJECTION:
      RefundOperationStatus.REJECTED,

    REQUIRE_MANUAL_REVIEW:
      RefundOperationStatus.MANUAL_REVIEW_REQUIRED,
  },

  [RefundOperationStatus.PENDING]: {
    PROVIDER_PENDING:
      RefundOperationStatus.PENDING,

    PROVIDER_PROCESSING:
      RefundOperationStatus.PROCESSING,

    PROVIDER_SUCCEEDED:
      RefundOperationStatus.SUCCEEDED,

    PROVIDER_FAILED:
      RefundOperationStatus.FAILED,

    REQUIRE_MANUAL_REVIEW:
      RefundOperationStatus.MANUAL_REVIEW_REQUIRED,
  },

  [RefundOperationStatus.PROCESSING]: {
    PROVIDER_PROCESSING:
      RefundOperationStatus.PROCESSING,

    PROVIDER_SUCCEEDED:
      RefundOperationStatus.SUCCEEDED,

    PROVIDER_FAILED:
      RefundOperationStatus.FAILED,

    REQUIRE_MANUAL_REVIEW:
      RefundOperationStatus.MANUAL_REVIEW_REQUIRED,
  },

  [RefundOperationStatus.UNKNOWN]: {
    AMBIGUOUS_RESULT:
      RefundOperationStatus.UNKNOWN,

    PROVIDER_PENDING:
      RefundOperationStatus.PENDING,

    PROVIDER_PROCESSING:
      RefundOperationStatus.PROCESSING,

    PROVIDER_SUCCEEDED:
      RefundOperationStatus.SUCCEEDED,

    PROVIDER_FAILED:
      RefundOperationStatus.FAILED,

    REQUIRE_MANUAL_REVIEW:
      RefundOperationStatus.MANUAL_REVIEW_REQUIRED,
  },

  [RefundOperationStatus.SUCCEEDED]: {
    // Provider/webhook replay is idempotent.
    PROVIDER_SUCCEEDED:
      RefundOperationStatus.SUCCEEDED,
  },

  [RefundOperationStatus.FAILED]: {
    // Provider/webhook replay is idempotent.
    PROVIDER_FAILED:
      RefundOperationStatus.FAILED,
  },

  [RefundOperationStatus.REJECTED]: {
    // Repeating the same definitive local result is idempotent.
    DEFINITIVE_REJECTION:
      RefundOperationStatus.REJECTED,
  },

  [RefundOperationStatus.MANUAL_REVIEW_REQUIRED]: {
    REQUIRE_MANUAL_REVIEW:
      RefundOperationStatus.MANUAL_REVIEW_REQUIRED,
  },
};

export function transitionRefundOperationStatus(
  currentStatus: RefundOperationStatus,
  event: RefundLifecycleEvent
): RefundOperationStatus {
  const nextStatus =
    TRANSITIONS[currentStatus]?.[event];

  if (!nextStatus) {
    throw new RefundLifecycleTransitionError(
      currentStatus,
      event
    );
  }

  return nextStatus;
}

/**
 * completedAt is reserved for provider/local terminal outcomes.
 *
 * MANUAL_REVIEW_REQUIRED is intentionally NOT considered completed,
 * because operator investigation is still outstanding.
 */
export function shouldCompleteRefundOperation(
  status: RefundOperationStatus
): boolean {
  return (
    status === RefundOperationStatus.SUCCEEDED ||
    status === RefundOperationStatus.FAILED ||
    status === RefundOperationStatus.REJECTED
  );
}

export function isRefundOperationUnresolved(
  status: RefundOperationStatus
): boolean {
  return (
    status === RefundOperationStatus.RESERVED ||
    status === RefundOperationStatus.SUBMITTING ||
    status === RefundOperationStatus.PENDING ||
    status === RefundOperationStatus.PROCESSING ||
    status === RefundOperationStatus.UNKNOWN ||
    status ===
      RefundOperationStatus.MANUAL_REVIEW_REQUIRED
  );
}
