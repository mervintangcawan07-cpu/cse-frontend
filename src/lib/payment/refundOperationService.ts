// Relative Path: src/lib/payment/refundOperationService.ts

import crypto from "crypto";
import {
  Prisma,
  RefundOperationStatus,
} from "@prisma/client";
import {
  IdempotencyService,
} from "@/lib/accounting/idempotencyService";
import {
  REFUND_REASONS,
  type RefundReason,
} from "@/lib/payment/refundPolicy";
import {
  derivePayMongoRefundIdempotencyKey,
  type PayMongoCreateRefundReason,
} from "@/lib/payment/refundExecutionContract";

const OPERATION_TYPE = "REFUND_EXECUTION" as const;

export const ACTIVE_REFUND_OPERATION_STATUSES: RefundOperationStatus[] = [
  RefundOperationStatus.RESERVED,
  RefundOperationStatus.SUBMITTING,
  RefundOperationStatus.PENDING,
  RefundOperationStatus.PROCESSING,
  RefundOperationStatus.UNKNOWN,
  RefundOperationStatus.MANUAL_REVIEW_REQUIRED,
];

export class RefundExecutionDomainError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(
    code: string,
    message: string,
    status: number = 400
  ) {
    super(message);
    this.name = "RefundExecutionDomainError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(
      this,
      RefundExecutionDomainError.prototype
    );
  }
}

export interface ReserveRefundOperationInput {
  actorId: string;
  idempotencyKey: string;
  requestHash: string;

  transactionId: string;
  paymentId: string;
  amountCentavos: number;

  reason: RefundReason;
  paymongoReason: PayMongoCreateRefundReason;
}

function normalizeAndValidateReservationInput(
  input: ReserveRefundOperationInput
): ReserveRefundOperationInput {
  const actorId = String(input.actorId || "").trim();
  const idempotencyKey =
    String(input.idempotencyKey || "").trim();

  const requestHash =
    String(input.requestHash || "")
      .trim()
      .toLowerCase();

  const transactionId =
    String(input.transactionId || "").trim();

  const paymentId =
    String(input.paymentId || "").trim();

  const reason =
    String(input.reason || "").trim() as RefundReason;

  const paymongoReason =
    String(input.paymongoReason || "")
      .trim() as PayMongoCreateRefundReason;

  if (!actorId) {
    throw new RefundExecutionDomainError(
      "REFUND_ACTOR_REQUIRED",
      "Refund actor is required.",
      400
    );
  }

  if (
    idempotencyKey.length < 1 ||
    idempotencyKey.length > 128
  ) {
    throw new RefundExecutionDomainError(
      "REFUND_IDEMPOTENCY_KEY_INVALID",
      "Refund Idempotency-Key is invalid.",
      400
    );
  }

  if (!/^[a-f0-9]{64}$/.test(requestHash)) {
    throw new RefundExecutionDomainError(
      "REFUND_REQUEST_HASH_INVALID",
      "Refund request hash is invalid.",
      400
    );
  }

  if (!transactionId) {
    throw new RefundExecutionDomainError(
      "REFUND_TRANSACTION_REQUIRED",
      "Refund transactionId is required.",
      400
    );
  }

  if (!paymentId.startsWith("pay_")) {
    throw new RefundExecutionDomainError(
      "REFUND_PAYMENT_ID_INVALID",
      "Refund payment ID is invalid.",
      400
    );
  }

  if (
    !Number.isSafeInteger(input.amountCentavos) ||
    input.amountCentavos <= 0
  ) {
    throw new RefundExecutionDomainError(
      "REFUND_AMOUNT_INVALID",
      "Refund amount must be a positive integer centavo amount.",
      400
    );
  }

  if (!REFUND_REASONS.includes(reason)) {
    throw new RefundExecutionDomainError(
      "REFUND_REASON_INVALID",
      "Refund reason is invalid.",
      400
    );
  }

  if (
    paymongoReason !== "duplicate" &&
    paymongoReason !== "fraudulent" &&
    paymongoReason !== "others"
  ) {
    throw new RefundExecutionDomainError(
      "REFUND_PAYMONGO_REASON_INVALID",
      "PayMongo refund reason is invalid.",
      400
    );
  }

  return {
    actorId,
    idempotencyKey,
    requestHash,
    transactionId,
    paymentId,
    amountCentavos: input.amountCentavos,
    reason,
    paymongoReason,
  };
}

/**
 * Acquires the transaction-wide refund-operation lock.
 *
 * Lock order for refund reservation is always:
 *
 * 1. refund transaction lock
 * 2. actor/idempotency lock
 *
 * Keeping this order deterministic prevents lock-order inversion.
 */
async function acquireRefundTransactionLock(
  tx: Prisma.TransactionClient,
  transactionId: string
): Promise<void> {
  const lockKey = `refund-operation:${transactionId}`;

  await tx.$queryRaw(
    Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${lockKey}, 0)
      )::text AS lock_result
    `
  );
}

/**
 * Creates or replays the durable local RefundOperation reservation.
 *
 * IMPORTANT:
 * - caller must supply an already-open Prisma transaction
 * - this function performs NO PayMongo request
 * - this function contains NO top-level prisma client
 * - FinancialIdempotencyKey.resourceId points to RefundOperation.id
 */
export async function reserveRefundOperationInTransaction(
  tx: Prisma.TransactionClient,
  rawInput: ReserveRefundOperationInput
) {
  const input =
    normalizeAndValidateReservationInput(rawInput);

  // Level 1: prevent parallel refund reservations for the same
  // purchase transaction even when different client keys are used.
  await acquireRefundTransactionLock(
    tx,
    input.transactionId
  );

  // Level 2: authoritative actor/request replay protection.
  await IdempotencyService.acquireIdempotencyLock(
    tx,
    input.actorId,
    OPERATION_TYPE,
    input.idempotencyKey
  );

  const existingIdempotency =
    await IdempotencyService
      .findAuthoritativeIdempotencyRecord(
        tx,
        input.actorId,
        OPERATION_TYPE,
        input.idempotencyKey
      );

  if (existingIdempotency) {
    if (
      existingIdempotency.requestHash !==
      input.requestHash
    ) {
      throw new RefundExecutionDomainError(
        "REFUND_IDEMPOTENCY_PAYLOAD_MISMATCH",
        "This Idempotency-Key was already used with a different refund request.",
        409
      );
    }

    const existingOperation =
      await tx.refundOperation.findUnique({
        where: {
          id: existingIdempotency.resourceId,
        },
      });

    if (!existingOperation) {
      throw new RefundExecutionDomainError(
        "REFUND_IDEMPOTENCY_RESOURCE_MISSING",
        "Refund idempotency state is inconsistent. Manual review is required.",
        500
      );
    }

    if (
      existingOperation.actorId !== input.actorId ||
      existingOperation.idempotencyKey !==
        input.idempotencyKey ||
      existingOperation.requestHash !==
        input.requestHash
    ) {
      throw new RefundExecutionDomainError(
        "REFUND_IDEMPOTENCY_RESOURCE_MISMATCH",
        "Refund idempotency resource integrity check failed.",
        500
      );
    }

    return {
      kind: "REPLAY" as const,
      operation: existingOperation,
    };
  }

  /**
   * This should be impossible when RefundOperation and
   * FinancialIdempotencyKey are created atomically.
   *
   * Fail closed instead of silently attaching a new financial
   * idempotency record to an orphan lifecycle record.
   */
  const orphanOperation =
    await tx.refundOperation.findFirst({
      where: {
        actorId: input.actorId,
        idempotencyKey: input.idempotencyKey,
      },
    });

  if (orphanOperation) {
    throw new RefundExecutionDomainError(
      "REFUND_ORPHAN_OPERATION",
      "Refund operation exists without its authoritative idempotency record. Manual review is required.",
      500
    );
  }

  /**
   * Different client keys must not create concurrent external
   * refund attempts against the same transaction.
   *
   * SUCCEEDED / FAILED / REJECTED are intentionally excluded.
   * A later request may be permitted only after a new authoritative
   * refund-policy preflight has determined that another refund is valid.
   */
  const activeOperation =
    await tx.refundOperation.findFirst({
      where: {
        transactionId: input.transactionId,
        status: {
          in: ACTIVE_REFUND_OPERATION_STATUSES,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

  if (activeOperation) {
    throw new RefundExecutionDomainError(
      "REFUND_OPERATION_IN_PROGRESS",
      "Another refund operation for this transaction is still active or requires manual review.",
      409
    );
  }

  /**
   * Generate the operation ID before INSERT so the provider
   * idempotency key can be derived and stored atomically in the
   * same local transaction.
   *
   * RefundOperation.id is a String, so an explicit UUID is valid
   * even though the Prisma schema also defines a cuid() default.
   */
  const operationId = crypto.randomUUID();

  const paymongoIdempotencyKey =
    derivePayMongoRefundIdempotencyKey(
      operationId,
      input.requestHash
    );

  const operation =
    await tx.refundOperation.create({
      data: {
        id: operationId,

        transactionId: input.transactionId,
        actorId: input.actorId,
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,

        paymongoIdempotencyKey,

        paymentId: input.paymentId,

        amountCentavos: input.amountCentavos,
        reason: input.reason,
        paymongoReason: input.paymongoReason,

        status: RefundOperationStatus.RESERVED,
      },
    });

  await IdempotencyService.recordFinancialIdempotency(
    tx,
    {
      actorId: input.actorId,
      operationType: OPERATION_TYPE,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,

      // Intentionally points to LOCAL lifecycle resource,
      // not the future PayMongo refund ID.
      resourceId: operation.id,
    }
  );

  return {
    kind: "CREATED" as const,
    operation,
  };
}
