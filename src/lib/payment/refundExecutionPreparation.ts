import { hasVerifiedEmptyEmbeddedRefundHistory } from "@/lib/payment/refundHistorySafety";
// Relative Path: src/lib/payment/refundExecutionPreparation.ts

import {
  calculateRefundPolicy,
  type RefundPolicyDecision,
  type RefundReason,
} from "@/lib/payment/refundPolicy";

import type {
  PayMongoCheckoutSessionResource,
  PayMongoPaymentResource,
  PayMongoRefundResource,
} from "@/lib/payment/refundService";

export interface RefundExecutionPreparationTransaction {
  id: string;
  userId: string;
  checkoutSessionId: string;
  grossAmountCentavos: number | null;
  feeAmountCentavos: number | null;
  status: string;
  planType: string | null;
  createdAt: Date;
  user: {
    name: string | null;
    email: string | null;
  } | null;
}

export interface RefundExecutionPreparationDependencies {
  findTransaction(
    transactionId: string
  ): Promise<RefundExecutionPreparationTransaction | null>;

  fetchPayMongoCheckoutSession(
    checkoutSessionId: string,
    secretKey: string
  ): Promise<PayMongoCheckoutSessionResource | null>;

  resolvePaidPaymentFromCheckout(
    checkout: PayMongoCheckoutSessionResource
  ): PayMongoPaymentResource | null;

  fetchAllRefundsStrict(
    paymentId: string,
    secretKey: string
  ): Promise<PayMongoRefundResource[]>;
}

export interface PrepareRefundExecutionInput {
  transactionId: string;
  reason: RefundReason;
  secretKey: string | null | undefined;
}

export type RefundExecutionPreparationFailureCode =
  | "TRANSACTION_NOT_FOUND"
  | "TRANSACTION_STATE_INVALID"
  | "PAYMONGO_CONFIGURATION_UNAVAILABLE"
  | "CHECKOUT_UNAVAILABLE"
  | "CHECKOUT_OWNERSHIP_MISMATCH"
  | "PAID_PAYMENT_NOT_FOUND"
  | "PAYMENT_AMOUNT_INVALID"
  | "PAYMENT_AMOUNT_MISMATCH"
  | "PAYMENT_FEE_INVALID"
  | "PAYMENT_FEE_MISMATCH"
  | "REFUND_HISTORY_UNAVAILABLE"
  | "ACTIVE_REFUND_EXISTS"
  | "SUCCEEDED_REFUND_AMOUNT_INVALID"
  | "CUMULATIVE_REFUND_EXCEEDS_PAYMENT";

export interface RefundExecutionPreparationFailure {
  ok: false;
  code: RefundExecutionPreparationFailureCode;
  status: number;
  body: Record<string, unknown>;
}

export interface RefundExecutionPreparationSuccess {
  ok: true;

  transaction: RefundExecutionPreparationTransaction;

  payment: PayMongoPaymentResource;
  paymentId: string;
  paymentMethod: string;

  paymentAmountCentavos: number;
  authoritativeFeeCentavos: number;
  storedFeeCentavos: number;

  netSettlementCentavos: number | null;

  cumulativeRefundedCentavos: number;
  remainingRefundableCentavos: number;
  successfulRefundCount: number;

  paymentCreatedAt?: Date;

  policy: RefundPolicyDecision;
}

export type RefundExecutionPreparationResult =
  | RefundExecutionPreparationFailure
  | RefundExecutionPreparationSuccess;

function failure(
  code: RefundExecutionPreparationFailureCode,
  status: number,
  body: Record<string, unknown>
): RefundExecutionPreparationFailure {
  return {
    ok: false,
    code,
    status,
    body,
  };
}

function sumSucceededRefunds(
  refunds: PayMongoRefundResource[]
): number {
  let total = 0;

  for (const refund of refunds) {
    if (
      refund.attributes?.status !==
      "succeeded"
    ) {
      continue;
    }

    const amount =
      refund.attributes?.amount;

    const currency =
      refund.attributes?.currency;

    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      currency !== "PHP"
    ) {
      throw new Error(
        "INVALID_SUCCEEDED_REFUND_AMOUNT"
      );
    }

    total += amount;

    if (!Number.isSafeInteger(total)) {
      throw new Error(
        "REFUND_TOTAL_OVERFLOW"
      );
    }
  }

  return total;
}

/**
 * Performs authoritative, read-only refund preparation.
 *
 * This module:
 * - performs no refund submission
 * - performs no database mutation
 * - performs no ledger/accounting mutation
 * - reads no environment variables
 *
 * transactionId and reason may originate from the request.
 * All financial/provider values are resolved authoritatively
 * through the supplied server-side dependencies.
 */
export async function prepareRefundExecution(
  dependencies: RefundExecutionPreparationDependencies,
  input: PrepareRefundExecutionInput
): Promise<RefundExecutionPreparationResult> {
  const transaction =
    await dependencies.findTransaction(
      input.transactionId
    );

  if (!transaction) {
    return failure(
      "TRANSACTION_NOT_FOUND",
      404,
      {
        error: "Transaction not found.",
      }
    );
  }

  if (
    transaction.status !== "PAID" &&
    transaction.status !== "REFUNDED"
  ) {
    return failure(
      "TRANSACTION_STATE_INVALID",
      409,
      {
        error:
          "Only paid or previously refunded transactions can be evaluated for refund.",
        transactionStatus:
          transaction.status,
      }
    );
  }

  const secretKey =
    typeof input.secretKey === "string"
      ? input.secretKey.trim()
      : "";

  if (!secretKey) {
    return failure(
      "PAYMONGO_CONFIGURATION_UNAVAILABLE",
      503,
      {
        error:
          "Payment provider configuration unavailable.",
      }
    );
  }

  const checkout =
    await dependencies.fetchPayMongoCheckoutSession(
      transaction.checkoutSessionId,
      secretKey
    );

  if (!checkout) {
    return failure(
      "CHECKOUT_UNAVAILABLE",
      502,
      {
        error:
          "Unable to retrieve the authoritative PayMongo Checkout Session.",
      }
    );
  }

  const checkoutOwnerUserId =
    checkout.attributes?.metadata?.userId ??
    checkout.attributes?.metadata?.user_id;

  if (
    !checkoutOwnerUserId ||
    String(checkoutOwnerUserId) !==
      transaction.userId
  ) {
    return failure(
      "CHECKOUT_OWNERSHIP_MISMATCH",
      409,
      {
        error:
          "Checkout ownership verification failed.",
      }
    );
  }

  const payment =
    dependencies.resolvePaidPaymentFromCheckout(
      checkout
    );

  if (!payment) {
    return failure(
      "PAID_PAYMENT_NOT_FOUND",
      409,
      {
        error:
          "No authoritative paid PayMongo Payment was found for this Checkout Session.",
      }
    );
  }

  const paymentAmountCentavos =
    payment.attributes?.amount;

  if (
    typeof paymentAmountCentavos !==
      "number" ||
    !Number.isInteger(
      paymentAmountCentavos
    ) ||
    paymentAmountCentavos <= 0 ||
    payment.attributes?.currency !==
      "PHP"
  ) {
    return failure(
      "PAYMENT_AMOUNT_INVALID",
      409,
      {
        error:
          "Invalid authoritative PayMongo payment amount.",
      }
    );
  }

  if (
    transaction.grossAmountCentavos &&
    transaction.grossAmountCentavos > 0 &&
    transaction.grossAmountCentavos !==
      paymentAmountCentavos
  ) {
    return failure(
      "PAYMENT_AMOUNT_MISMATCH",
      409,
      {
        error:
          "GovStudyX and PayMongo payment amounts do not match. Manual reconciliation is required.",
      }
    );
  }

  const authoritativeFeeCentavos =
    payment.attributes?.fee;

  if (
    typeof authoritativeFeeCentavos !==
      "number" ||
    !Number.isInteger(
      authoritativeFeeCentavos
    ) ||
    authoritativeFeeCentavos < 0 ||
    authoritativeFeeCentavos >
      paymentAmountCentavos
  ) {
    return failure(
      "PAYMENT_FEE_INVALID",
      409,
      {
        error:
          "Authoritative PayMongo processing fee is unavailable or invalid.",
      }
    );
  }

  const storedFeeCentavos =
    transaction.feeAmountCentavos || 0;

  if (
    storedFeeCentavos > 0 &&
    storedFeeCentavos !==
      authoritativeFeeCentavos
  ) {
    return failure(
      "PAYMENT_FEE_MISMATCH",
      409,
      {
        error:
          "GovStudyX and PayMongo processing fees do not match. Manual reconciliation is required.",
      }
    );
  }

  let allRefunds:
    PayMongoRefundResource[];

  try {
    allRefunds =
      await dependencies.fetchAllRefundsStrict(
        payment.id,
        secretKey
      );
  } catch (error) {
    const exactFirstRefundEmptyHistory =
      error instanceof Error &&
      error.message ===
        "REFUND_HISTORY_PAYMENT_ID_LIST_REJECTED" &&
      hasVerifiedEmptyEmbeddedRefundHistory(
        payment.id,
        payment
      );

    if (exactFirstRefundEmptyHistory) {
      allRefunds = [];
    } else {
      const diagnosticCode =
        error instanceof Error &&
        /^REFUND_HISTORY_(?:NETWORK_ERROR|HTTP_\d{3}|INVALID_RESPONSE|INVALID_RESOURCE|PAYMENT_MISMATCH|PAGINATION_INCOMPLETE|INVALID_PAYMENT_ID|MISSING_SECRET|PAYMENT_ID_LIST_REJECTED)$/.test(
          error.message
        )
          ? error.message
          : "REFUND_HISTORY_UNKNOWN_ERROR";

      console.error(
        `[REFUND_EXECUTION_PREPARATION] Refund history verification failed: ${diagnosticCode}`
      );

      return failure(
        "REFUND_HISTORY_UNAVAILABLE",
        502,
        {
          error:
            "Authoritative PayMongo refund history could not be completely verified.",
        }
      );
    }
  }
  const nonFinalRefunds =
    allRefunds.filter((refund) => {
      const status = String(
        refund.attributes?.status || ""
      ).toLowerCase();

      return (
        status !== "succeeded" &&
        status !== "failed"
      );
    });

  if (nonFinalRefunds.length > 0) {
    return failure(
      "ACTIVE_REFUND_EXISTS",
      409,
      {
        error:
          "A PayMongo refund is already pending or processing. Wait for it to reach a final state before creating another refund.",

        activeRefunds:
          nonFinalRefunds.map(
            (refund) => ({
              id: refund.id,
              status:
                refund.attributes
                  ?.status ||
                "unknown",
              amountCentavos:
                refund.attributes
                  ?.amount ?? null,
            })
          ),
      }
    );
  }

  let cumulativeRefundedCentavos:
    number;

  try {
    cumulativeRefundedCentavos =
      sumSucceededRefunds(
        allRefunds
      );
  } catch {
    return failure(
      "SUCCEEDED_REFUND_AMOUNT_INVALID",
      409,
      {
        error:
          "PayMongo refund history contains an invalid financial amount.",
      }
    );
  }

  if (
    cumulativeRefundedCentavos >
    paymentAmountCentavos
  ) {
    return failure(
      "CUMULATIVE_REFUND_EXCEEDS_PAYMENT",
      409,
      {
        error:
          "Cumulative PayMongo refunds exceed the original payment. Manual reconciliation is required.",
      }
    );
  }

  const paymentMethod =
    payment.attributes?.source?.type ||
    "";

  const createdAtSeconds =
    payment.attributes?.created_at;

  const paymentCreatedAt =
    typeof createdAtSeconds ===
      "number" &&
    Number.isFinite(
      createdAtSeconds
    ) &&
    createdAtSeconds > 0
      ? new Date(
          createdAtSeconds * 1000
        )
      : undefined;

  const policy =
    calculateRefundPolicy({
      reason: input.reason,
      paymentMethod,
      originalPaymentCentavos:
        paymentAmountCentavos,
      originalProcessingFeeCentavos:
        authoritativeFeeCentavos,
      cumulativeRefundedCentavos,
      paymentCreatedAt,
    });

  return {
    ok: true,

    transaction,

    payment,
    paymentId: payment.id,
    paymentMethod,

    paymentAmountCentavos,
    authoritativeFeeCentavos,
    storedFeeCentavos,

    netSettlementCentavos:
      typeof payment.attributes
        ?.net_amount === "number"
        ? payment.attributes
            .net_amount
        : null,

    cumulativeRefundedCentavos,

    remainingRefundableCentavos:
      paymentAmountCentavos -
      cumulativeRefundedCentavos,

    successfulRefundCount:
      allRefunds.filter(
        (refund) =>
          refund.attributes
            ?.status ===
          "succeeded"
      ).length,

    paymentCreatedAt,

    policy,
  };
}