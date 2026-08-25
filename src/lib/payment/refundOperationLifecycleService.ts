// Relative Path: src/lib/payment/refundOperationLifecycleService.ts

import {
  Prisma,
  RefundOperationStatus,
  type RefundOperation,
} from "@prisma/client";

import type {
  PayMongoRefundSubmissionResult,
} from "@/lib/payment/refundProviderSubmission";

import {
  shouldCompleteRefundOperation,
  transitionRefundOperationStatus,
} from "@/lib/payment/refundOperationStateMachine";

export class RefundOperationLifecycleError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(
    code: string,
    message: string,
    status: number = 400
  ) {
    super(message);

    this.name =
      "RefundOperationLifecycleError";

    this.code = code;
    this.status = status;

    Object.setPrototypeOf(
      this,
      RefundOperationLifecycleError.prototype
    );
  }
}

export interface PrepareRefundSubmissionInput {
  operationId: string;
  actorId: string;
  requestHash: string;

  paymentId: string;
  amountCentavos: number;

  paymongoIdempotencyKey: string;

  now?: Date;
}

export interface ApplyRefundSubmissionResultInput {
  operationId: string;

  result:
    PayMongoRefundSubmissionResult;

  now?: Date;
}

function normalizeDate(
  rawDate: Date | undefined
): Date {
  const date =
    rawDate === undefined
      ? new Date()
      : rawDate;

  if (
    !(date instanceof Date) ||
    Number.isNaN(date.getTime())
  ) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_TIME_INVALID",
      "Refund lifecycle timestamp is invalid."
    );
  }

  return date;
}

function normalizePrepareInput(
  input: PrepareRefundSubmissionInput
): Required<PrepareRefundSubmissionInput> {
  const operationId =
    String(input.operationId || "").trim();

  const actorId =
    String(input.actorId || "").trim();

  const requestHash =
    String(input.requestHash || "")
      .trim()
      .toLowerCase();

  const paymentId =
    String(input.paymentId || "").trim();

  const paymongoIdempotencyKey =
    String(
      input.paymongoIdempotencyKey || ""
    ).trim();

  if (!operationId) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_ID_REQUIRED",
      "Refund operation ID is required."
    );
  }

  if (!actorId) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_ACTOR_REQUIRED",
      "Refund operation actor is required."
    );
  }

  if (!/^[a-f0-9]{64}$/.test(requestHash)) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_REQUEST_HASH_INVALID",
      "Refund operation request hash is invalid."
    );
  }

  if (!paymentId.startsWith("pay_")) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_PAYMENT_ID_INVALID",
      "Refund operation payment ID is invalid."
    );
  }

  if (
    !Number.isSafeInteger(
      input.amountCentavos
    ) ||
    input.amountCentavos <= 0
  ) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_AMOUNT_INVALID",
      "Refund operation amount is invalid."
    );
  }

  if (
    paymongoIdempotencyKey.length < 1 ||
    paymongoIdempotencyKey.length > 255
  ) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_PROVIDER_KEY_INVALID",
      "Refund provider idempotency key is invalid."
    );
  }

  return {
    operationId,
    actorId,
    requestHash,
    paymentId,
    amountCentavos:
      input.amountCentavos,
    paymongoIdempotencyKey,
    now: normalizeDate(input.now),
  };
}

function validateOperationIntegrity(
  operation: RefundOperation,
  input: Required<PrepareRefundSubmissionInput>
): void {
  const matches =
    operation.actorId ===
      input.actorId &&
    operation.requestHash ===
      input.requestHash &&
    operation.paymentId ===
      input.paymentId &&
    operation.amountCentavos ===
      input.amountCentavos &&
    operation.paymongoIdempotencyKey ===
      input.paymongoIdempotencyKey;

  if (!matches) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_INTEGRITY_MISMATCH",
      "Refund operation does not match the authoritative reserved request.",
      409
    );
  }
}

async function acquireOperationLifecycleLock(
  tx: Prisma.TransactionClient,
  operationId: string
): Promise<void> {
  const lockKey =
    `refund-lifecycle:${operationId}`;

  await tx.$queryRaw(
    Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${lockKey}, 0)
      )::text AS lock_result
    `
  );
}

async function getOperationOrThrow(
  tx: Prisma.TransactionClient,
  operationId: string
): Promise<RefundOperation> {
  const operation =
    await tx.refundOperation.findUnique({
      where: {
        id: operationId,
      },
    });

  if (!operation) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_NOT_FOUND",
      "Refund operation was not found.",
      404
    );
  }

  return operation;
}

/**
 * Marks a RESERVED operation as SUBMITTING.
 *
 * The caller MUST perform the provider HTTP request only when
 * this function returns kind === "STARTED".
 *
 * Any replay or already-advanced state returns ALREADY_STARTED,
 * preventing a second automatic PayMongo POST.
 */
export async function prepareRefundSubmissionInTransaction(
  tx: Prisma.TransactionClient,
  rawInput: PrepareRefundSubmissionInput
): Promise<
  | {
      kind: "STARTED";
      operation: RefundOperation;
    }
  | {
      kind: "ALREADY_STARTED";
      operation: RefundOperation;
    }
> {
  const input =
    normalizePrepareInput(rawInput);

  await acquireOperationLifecycleLock(
    tx,
    input.operationId
  );

  const current =
    await getOperationOrThrow(
      tx,
      input.operationId
    );

  validateOperationIntegrity(
    current,
    input
  );

  if (
    current.status !==
    RefundOperationStatus.RESERVED
  ) {
    return {
      kind: "ALREADY_STARTED",
      operation: current,
    };
  }

  const nextStatus =
    transitionRefundOperationStatus(
      current.status,
      "START_SUBMISSION"
    );

  const updateResult =
    await tx.refundOperation.updateMany({
      where: {
        id: current.id,
        status:
          RefundOperationStatus.RESERVED,
      },

      data: {
        status: nextStatus,

        attemptCount: {
          increment: 1,
        },

        lastAttemptAt:
          input.now,

        submittedAt:
          current.submittedAt ??
          input.now,

        lastHttpStatus:
          null,

        lastErrorCode:
          null,

        lastErrorMessage:
          null,
      },
    });

  if (updateResult.count !== 1) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_CONCURRENT_TRANSITION",
      "Refund operation changed concurrently before submission.",
      409
    );
  }

  const updated =
    await getOperationOrThrow(
      tx,
      input.operationId
    );

  return {
    kind: "STARTED",
    operation: updated,
  };
}

function normalizeProviderStatus(
  status: unknown
): string | null {
  if (typeof status !== "string") {
    return null;
  }

  const normalized =
    status.trim().toLowerCase();

  return normalized || null;
}

/**
 * Applies exactly one provider submission result to durable state.
 *
 * This function performs NO HTTP request.
 * It does NOT invoke accounting/ledger processing.
 */
export async function applyRefundSubmissionResultInTransaction(
  tx: Prisma.TransactionClient,
  input: ApplyRefundSubmissionResultInput
): Promise<RefundOperation> {
  const operationId =
    String(input.operationId || "").trim();

  if (!operationId) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_ID_REQUIRED",
      "Refund operation ID is required."
    );
  }

  const now =
    normalizeDate(input.now);

  await acquireOperationLifecycleLock(
    tx,
    operationId
  );

  const current =
    await getOperationOrThrow(
      tx,
      operationId
    );

  const result =
    input.result;

  if (
    !result ||
    typeof result !== "object"
  ) {
    throw new RefundOperationLifecycleError(
      "REFUND_PROVIDER_RESULT_REQUIRED",
      "Refund provider result is required."
    );
  }

  const nextStatus =
    transitionRefundOperationStatus(
      current.status,
      result.lifecycleEvent
    );

  let refundId =
    current.refundId;

  let providerStatus =
    current.providerStatus;

  let lastHttpStatus:
    | number
    | null =
    result.httpStatus;

  let lastErrorCode:
    | string
    | null =
    null;

  let lastErrorMessage:
    | string
    | null =
    null;

  if (
    result.kind ===
    "PROVIDER_RESULT"
  ) {
    const incomingRefundId =
      String(
        result.refund.id || ""
      ).trim();

    if (
      !incomingRefundId.startsWith(
        "ref_"
      )
    ) {
      throw new RefundOperationLifecycleError(
        "REFUND_OPERATION_REFUND_ID_INVALID",
        "Provider refund ID is invalid."
      );
    }

    if (
      current.refundId &&
      current.refundId !==
        incomingRefundId
    ) {
      throw new RefundOperationLifecycleError(
        "REFUND_OPERATION_REFUND_ID_MISMATCH",
        "Refund operation already references a different provider refund ID.",
        409
      );
    }

    if (
      result.refund.attributes
        .payment_id !==
      current.paymentId
    ) {
      throw new RefundOperationLifecycleError(
        "REFUND_OPERATION_PROVIDER_PAYMENT_MISMATCH",
        "Provider refund payment does not match the durable refund operation.",
        409
      );
    }

    if (
      result.refund.attributes.amount !==
      current.amountCentavos
    ) {
      throw new RefundOperationLifecycleError(
        "REFUND_OPERATION_PROVIDER_AMOUNT_MISMATCH",
        "Provider refund amount does not match the durable refund operation.",
        409
      );
    }

    refundId =
      incomingRefundId;

    providerStatus =
      normalizeProviderStatus(
        result.refund.attributes
          .status
      );

    lastErrorCode = null;
    lastErrorMessage = null;
  } else {
    lastErrorCode =
      result.errorCode;

    lastErrorMessage =
      result.errorMessage;
  }

  const completedAt =
    shouldCompleteRefundOperation(
      nextStatus
    )
      ? current.completedAt ??
        now
      : current.completedAt;

  const updateResult =
    await tx.refundOperation.updateMany({
      where: {
        id: current.id,
        status: current.status,
      },

      data: {
        status: nextStatus,

        refundId,
        providerStatus,

        lastHttpStatus,

        lastErrorCode,
        lastErrorMessage,

        completedAt,
      },
    });

  if (updateResult.count !== 1) {
    throw new RefundOperationLifecycleError(
      "REFUND_OPERATION_CONCURRENT_RESULT",
      "Refund operation changed concurrently while recording the provider result.",
      409
    );
  }

  return getOperationOrThrow(
    tx,
    operationId
  );
}
