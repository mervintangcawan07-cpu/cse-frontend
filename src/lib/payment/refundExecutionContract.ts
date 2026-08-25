// Relative Path: src/lib/payment/refundExecutionContract.ts

import crypto from "crypto";
import { RefundOperationStatus } from "@prisma/client";
import type { RefundReason } from "@/lib/payment/refundPolicy";

/**
 * PayMongo Create Refund currently accepts these provider-side reason values.
 *
 * This is intentionally narrower than the broader Refund resource representation.
 */
export type PayMongoCreateRefundReason =
  | "duplicate"
  | "fraudulent"
  | "others";

export type KnownPayMongoRefundStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed";

export interface BuildRefundCreatePayloadInput {
  paymentId: string;
  amountCentavos: number;
  paymongoReason: PayMongoCreateRefundReason;
  internalReason: RefundReason;
  transactionId: string;
}

export interface PayMongoRefundCreatePayload {
  data: {
    attributes: {
      amount: number;
      payment_id: string;
      reason: PayMongoCreateRefundReason;
      notes: string;
    };
  };
}

/**
 * Creates a stable provider idempotency key for one durable RefundOperation.
 *
 * Invariants:
 * - deterministic for the same operation/request
 * - contains no user PII
 * - short enough for provider header limits
 * - must be reused for every controlled retry of this operation
 */
export function derivePayMongoRefundIdempotencyKey(
  operationId: string,
  requestHash: string
): string {
  const normalizedOperationId = operationId.trim();
  const normalizedRequestHash = requestHash.trim().toLowerCase();

  if (!normalizedOperationId) {
    throw new Error("REFUND_OPERATION_ID_REQUIRED");
  }

  if (!/^[a-f0-9]{64}$/.test(normalizedRequestHash)) {
    throw new Error("REFUND_REQUEST_HASH_INVALID");
  }

  const digest = crypto
    .createHash("sha256")
    .update(`${normalizedOperationId}:${normalizedRequestHash}`)
    .digest("hex");

  return `gsx-refund-${digest}`;
}

/**
 * Builds the exact deterministic PayMongo Create Refund payload.
 *
 * Never place timestamps or other changing data in notes because retries using
 * the same provider idempotency key must use the same request parameters.
 */
export function buildPayMongoRefundCreatePayload(
  input: BuildRefundCreatePayloadInput
): PayMongoRefundCreatePayload {
  const paymentId = input.paymentId.trim();
  const transactionId = input.transactionId.trim();

  if (!paymentId.startsWith("pay_")) {
    throw new Error("REFUND_PAYMENT_ID_INVALID");
  }

  if (
    !Number.isSafeInteger(input.amountCentavos) ||
    input.amountCentavos <= 0
  ) {
    throw new Error("REFUND_AMOUNT_INVALID");
  }

  if (!transactionId) {
    throw new Error("REFUND_TRANSACTION_ID_REQUIRED");
  }

  const notes =
    `GovStudyX refund; transaction=${transactionId}; ` +
    `reason=${input.internalReason}`;

  return {
    data: {
      attributes: {
        amount: input.amountCentavos,
        payment_id: paymentId,
        reason: input.paymongoReason,
        notes,
      },
    },
  };
}

/**
 * Converts a provider refund lifecycle state into our durable local state.
 *
 * Unknown future provider statuses fail closed into MANUAL_REVIEW_REQUIRED
 * rather than being guessed as success or failure.
 */
export function mapPayMongoRefundStatus(
  providerStatus: unknown
): RefundOperationStatus {
  switch (providerStatus) {
    case "pending":
      return RefundOperationStatus.PENDING;

    case "processing":
      return RefundOperationStatus.PROCESSING;

    case "succeeded":
      return RefundOperationStatus.SUCCEEDED;

    case "failed":
      return RefundOperationStatus.FAILED;

    default:
      return RefundOperationStatus.MANUAL_REVIEW_REQUIRED;
  }
}
