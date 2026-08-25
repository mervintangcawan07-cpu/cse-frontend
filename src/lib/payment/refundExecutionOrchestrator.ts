// Relative Path: src/lib/payment/refundExecutionOrchestrator.ts

import type {
  Prisma,
  RefundOperation,
} from "@prisma/client";

import type {
  PrepareRefundSubmissionInput,
} from "@/lib/payment/refundOperationLifecycleService";

import {
  applyRefundSubmissionResultInTransaction,
  prepareRefundSubmissionInTransaction,
} from "@/lib/payment/refundOperationLifecycleService";

import type {
  PayMongoRefundSubmissionResult,
  SubmitPayMongoRefundInput,
} from "@/lib/payment/refundProviderSubmission";

export type RefundTransactionRunner = <T>(
  work: (
    tx: Prisma.TransactionClient
  ) => Promise<T>
) => Promise<T>;

export interface RefundExecutionOrchestratorDependencies {
  runInTransaction:
    RefundTransactionRunner;

  submitProvider:
    (
      input: SubmitPayMongoRefundInput
    ) => Promise<PayMongoRefundSubmissionResult>;
}

export interface RefundExecutionOrchestratorInput {
  prepare:
    PrepareRefundSubmissionInput;

  provider:
    SubmitPayMongoRefundInput;

  resultNow?: Date;
}

export type RefundExecutionOrchestratorResult =
  | {
      kind: "ALREADY_STARTED";
      operation: RefundOperation;
      providerResult: null;
    }
  | {
      kind: "SUBMITTED";
      operation: RefundOperation;
      providerResult:
        PayMongoRefundSubmissionResult;
    };

export class RefundExecutionOrchestratorError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(
    code: string,
    message: string,
    status: number = 400
  ) {
    super(message);

    this.name =
      "RefundExecutionOrchestratorError";

    this.code = code;
    this.status = status;

    Object.setPrototypeOf(
      this,
      RefundExecutionOrchestratorError.prototype
    );
  }
}

function validateOrchestrationInput(
  input: RefundExecutionOrchestratorInput
): void {
  if (
    !input ||
    !input.prepare ||
    !input.provider
  ) {
    throw new RefundExecutionOrchestratorError(
      "REFUND_ORCHESTRATION_INPUT_REQUIRED",
      "Refund orchestration input is required."
    );
  }

  const providerSecret =
    String(
      input.provider.secretKey || ""
    ).trim();

  if (!providerSecret) {
    throw new RefundExecutionOrchestratorError(
      "REFUND_ORCHESTRATION_SECRET_REQUIRED",
      "Refund provider configuration is unavailable."
    );
  }

  if (
    typeof input.provider.fetchImpl !==
    "function"
  ) {
    throw new RefundExecutionOrchestratorError(
      "REFUND_ORCHESTRATION_FETCH_REQUIRED",
      "Refund provider transport is unavailable."
    );
  }

  if (
    input.prepare.paymentId !==
    input.provider.paymentId
  ) {
    throw new RefundExecutionOrchestratorError(
      "REFUND_ORCHESTRATION_PAYMENT_MISMATCH",
      "Prepared refund and provider submission reference different payments.",
      409
    );
  }

  if (
    input.prepare.amountCentavos !==
    input.provider.amountCentavos
  ) {
    throw new RefundExecutionOrchestratorError(
      "REFUND_ORCHESTRATION_AMOUNT_MISMATCH",
      "Prepared refund and provider submission reference different amounts.",
      409
    );
  }

  if (
    input.prepare
      .paymongoIdempotencyKey !==
    input.provider
      .paymongoIdempotencyKey
  ) {
    throw new RefundExecutionOrchestratorError(
      "REFUND_ORCHESTRATION_PROVIDER_KEY_MISMATCH",
      "Prepared refund and provider submission use different provider idempotency keys.",
      409
    );
  }

  const attributes =
    input.provider.payload?.data
      ?.attributes;

  if (
    !attributes ||
    attributes.payment_id !==
      input.prepare.paymentId ||
    attributes.amount !==
      input.prepare.amountCentavos
  ) {
    throw new RefundExecutionOrchestratorError(
      "REFUND_ORCHESTRATION_PAYLOAD_MISMATCH",
      "Provider refund payload does not match the prepared durable operation.",
      409
    );
  }
}

function unexpectedProviderFailure():
  PayMongoRefundSubmissionResult {
  return {
    kind:
      "MANUAL_REVIEW",

    lifecycleEvent:
      "REQUIRE_MANUAL_REVIEW",

    httpStatus:
      null,

    errorCode:
      "REFUND_PROVIDER_ADAPTER_EXCEPTION",

    errorMessage:
      "Refund provider submission raised an unexpected exception. Manual review is required.",
  };
}

/**
 * Transaction-separated refund submission orchestration.
 *
 * Critical invariant:
 *
 * 1. transaction #1 marks RESERVED -> SUBMITTING and COMMITs
 * 2. provider HTTP occurs OUTSIDE any database transaction
 * 3. transaction #2 records the provider result
 *
 * This function owns no PrismaClient and reads no environment variables.
 */
export async function orchestrateRefundSubmission(
  dependencies:
    RefundExecutionOrchestratorDependencies,

  input:
    RefundExecutionOrchestratorInput
): Promise<RefundExecutionOrchestratorResult> {
  validateOrchestrationInput(
    input
  );

  if (
    !dependencies ||
    typeof dependencies.runInTransaction !==
      "function" ||
    typeof dependencies.submitProvider !==
      "function"
  ) {
    throw new RefundExecutionOrchestratorError(
      "REFUND_ORCHESTRATION_DEPENDENCY_INVALID",
      "Refund orchestration dependencies are invalid.",
      500
    );
  }

  /**
   * TRANSACTION #1
   *
   * This transaction must fully return before submitProvider()
   * is invoked.
   */
  const preparation =
    await dependencies.runInTransaction(
      async (tx) =>
        prepareRefundSubmissionInTransaction(
          tx,
          input.prepare
        )
    );

  if (
    preparation.kind ===
    "ALREADY_STARTED"
  ) {
    return {
      kind:
        "ALREADY_STARTED",

      operation:
        preparation.operation,

      providerResult:
        null,
    };
  }

  /**
   * EXTERNAL PROVIDER BOUNDARY
   *
   * There is deliberately no transaction client here.
   */
  let providerResult:
    PayMongoRefundSubmissionResult;

  try {
    providerResult =
      await dependencies.submitProvider(
        input.provider
      );
  } catch {
    /**
     * The adapter normally converts transport ambiguity into a
     * structured result. An unexpected thrown exception therefore
     * fails closed to manual review and is never blindly retried.
     */
    providerResult =
      unexpectedProviderFailure();
  }

  /**
   * TRANSACTION #2
   *
   * Persist the provider observation only after the provider call
   * has completely returned.
   */
  const operation =
    await dependencies.runInTransaction(
      async (tx) =>
        applyRefundSubmissionResultInTransaction(
          tx,
          {
            operationId:
              preparation.operation.id,

            result:
              providerResult,

            now:
              input.resultNow,
          }
        )
    );

  return {
    kind:
      "SUBMITTED",

    operation,
    providerResult,
  };
}
