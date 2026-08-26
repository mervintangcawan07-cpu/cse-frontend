import {
  RefundOperationStatus,
  type Prisma,
  type RefundOperation,
} from "@prisma/client";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  IdempotencyDomainError,
  IdempotencyService,
} from "@/lib/accounting/idempotencyService";
import {
  validateSudoTicket,
} from "@/lib/auth/sudoMode";
import {
  prisma,
} from "@/lib/prisma";
import {
  buildPayMongoRefundCreatePayload,
  type PayMongoCreateRefundReason,
} from "@/lib/payment/refundExecutionContract";
import {
  orchestrateRefundSubmission,
  RefundExecutionOrchestratorError,
  type RefundExecutionOrchestratorDependencies,
} from "@/lib/payment/refundExecutionOrchestrator";
import {
  prepareRefundExecution,
  type RefundExecutionPreparationDependencies,
} from "@/lib/payment/refundExecutionPreparation";
import {
  checkRefundExecutionRateLimit,
} from "@/lib/payment/refundExecutionRateLimit";
import {
  resolveRefundExecutionRateLimitConfig,
} from "@/lib/payment/refundExecutionRateLimitConfig";
import {
  createRefundExecutionDistributedLimiter,
} from "@/lib/payment/refundExecutionRateLimitProvider";
import {
  RefundExecutionSecurityError,
  validateRefundExecutionSecurity,
} from "@/lib/payment/refundExecutionSecurityContract";
import {
  RefundExecutionDomainError,
  reserveRefundOperationInTransaction,
} from "@/lib/payment/refundOperationService";
import {
  RefundOperationLifecycleError,
} from "@/lib/payment/refundOperationLifecycleService";
import {
  submitPayMongoRefund,
} from "@/lib/payment/refundProviderSubmission";
import {
  REFUND_REASONS,
  type RefundReason,
} from "@/lib/payment/refundPolicy";
import {
  RefundService,
} from "@/lib/payment/refundService";
import {
  requireAdminAuth,
  type AuthenticatedUser,
} from "@/lib/serverAuth";
import {
  requireSudo,
} from "@/middleware/requireSudo";

export const runtime = "nodejs";

const OPERATION_TYPE =
  "REFUND_EXECUTION" as const;

const preparationDependencies:
  RefundExecutionPreparationDependencies = {
    async findTransaction(transactionId) {
      return prisma.transaction.findUnique({
        where: {
          id: transactionId,
        },
        select: {
          id: true,
          userId: true,
          checkoutSessionId: true,
          grossAmountCentavos: true,
          feeAmountCentavos: true,
          status: true,
          planType: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });
    },

    fetchPayMongoCheckoutSession(
      checkoutSessionId,
      secretKey
    ) {
      return RefundService.fetchPayMongoCheckoutSession(
        checkoutSessionId,
        secretKey
      );
    },

    resolvePaidPaymentFromCheckout(checkout) {
      return RefundService.resolvePaidPaymentFromCheckout(
        checkout
      );
    },

    fetchAllRefundsStrict(
      paymentId,
      secretKey
    ) {
      return RefundService.fetchAllRefundsStrict(
        paymentId,
        secretKey
      );
    },
  };

const orchestrationDependencies:
  RefundExecutionOrchestratorDependencies = {
    async runInTransaction<T>(
      work: (
        tx: Prisma.TransactionClient
      ) => Promise<T>
    ): Promise<T> {
      return prisma.$transaction(
        async (tx) =>
          work(tx)
      );
    },

    submitProvider:
      submitPayMongoRefund,
  };

function isRefundReason(
  value: unknown
): value is RefundReason {
  return (
    typeof value === "string" &&
    REFUND_REASONS.includes(
      value as RefundReason
    )
  );
}

function isPayMongoCreateRefundReason(
  value: unknown
): value is PayMongoCreateRefundReason {
  return (
    value === "duplicate" ||
    value === "fraudulent" ||
    value === "others"
  );
}

function noStoreJson(
  body: Record<string, unknown>,
  status: number,
  extraHeaders:
    Record<string, string> = {}
): NextResponse {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
        ...extraHeaders,
      },
    }
  );
}

function getOperationHttpStatus(
  status: RefundOperationStatus
): number {
  switch (status) {
    case RefundOperationStatus.SUCCEEDED:
      return 200;

    case RefundOperationStatus.PENDING:
    case RefundOperationStatus.PROCESSING:
      return 202;

    case RefundOperationStatus.FAILED:
    case RefundOperationStatus.REJECTED:
      return 422;

    case RefundOperationStatus.RESERVED:
    case RefundOperationStatus.SUBMITTING:
    case RefundOperationStatus.UNKNOWN:
    case RefundOperationStatus.MANUAL_REVIEW_REQUIRED:
    default:
      return 409;
  }
}

function refundOperationResponse(
  operation: RefundOperation,
  options: {
    idempotentReplay: boolean;
    providerSubmittedThisRequest: boolean;
  }
): NextResponse {
  const requiresManualReview =
    operation.status ===
      RefundOperationStatus.UNKNOWN ||
    operation.status ===
      RefundOperationStatus.MANUAL_REVIEW_REQUIRED;

  const headers:
    Record<string, string> = {};

  if (options.idempotentReplay) {
    headers["X-Idempotent-Replay"] =
      "true";
  }

  return noStoreJson(
    {
      success:
        operation.status ===
        RefundOperationStatus.SUCCEEDED,

      idempotentReplay:
        options.idempotentReplay,

      providerSubmittedThisRequest:
        options.providerSubmittedThisRequest,

      requiresManualReview,

      operation: {
        id:
          operation.id,

        transactionId:
          operation.transactionId,

        status:
          operation.status,

        refundId:
          operation.refundId,

        providerStatus:
          operation.providerStatus,

        attemptCount:
          operation.attemptCount,
      },
    },
    getOperationHttpStatus(
      operation.status
    ),
    headers
  );
}

function getSudoVerification(
  request: NextRequest
) {
  const token =
    request.headers.get(
      "x-sudo-token"
    ) ||
    request.cookies.get(
      "cse_sudo_token"
    )?.value ||
    "";

  return validateSudoTicket(
    token
  );
}

async function findExistingRefundOperation(
  actorId: string,
  idempotencyKey: string,
  requestHash: string
): Promise<RefundOperation | null> {
  const existingRecord =
    await IdempotencyService
      .findAuthoritativeIdempotencyRecord(
        prisma,
        actorId,
        OPERATION_TYPE,
        idempotencyKey
      );

  if (!existingRecord) {
    return null;
  }

  if (
    existingRecord.requestHash !==
    requestHash
  ) {
    throw new IdempotencyDomainError(
      "REFUND_IDEMPOTENCY_PAYLOAD_MISMATCH",
      "This Idempotency-Key was already used with a different refund request.",
      409
    );
  }

  const operation =
    await prisma.refundOperation.findUnique({
      where: {
        id:
          existingRecord.resourceId,
      },
    });

  if (!operation) {
    throw new RefundExecutionDomainError(
      "REFUND_IDEMPOTENCY_RESOURCE_MISSING",
      "Refund idempotency state is inconsistent. Manual review is required.",
      500
    );
  }

  if (
    operation.actorId !== actorId ||
    operation.idempotencyKey !==
      idempotencyKey ||
    operation.requestHash !==
      requestHash
  ) {
    throw new RefundExecutionDomainError(
      "REFUND_IDEMPOTENCY_RESOURCE_MISMATCH",
      "Refund idempotency resource integrity check failed.",
      500
    );
  }

  return operation;
}

function buildProviderPayload(
  operation: RefundOperation
) {
  if (
    !isRefundReason(
      operation.reason
    )
  ) {
    throw new RefundExecutionDomainError(
      "REFUND_OPERATION_REASON_INVALID",
      "Stored refund reason is invalid. Manual review is required.",
      500
    );
  }

  if (
    !isPayMongoCreateRefundReason(
      operation.paymongoReason
    )
  ) {
    throw new RefundExecutionDomainError(
      "REFUND_OPERATION_PROVIDER_REASON_INVALID",
      "Stored provider refund reason is invalid. Manual review is required.",
      500
    );
  }

  return buildPayMongoRefundCreatePayload({
    paymentId:
      operation.paymentId,

    amountCentavos:
      operation.amountCentavos,

    paymongoReason:
      operation.paymongoReason,

    internalReason:
      operation.reason,

    transactionId:
      operation.transactionId,
  });
}

function handleExecutionError(
  error: unknown
): NextResponse {
  if (
    error instanceof
    RefundExecutionSecurityError
  ) {
    const headers:
      Record<string, string> = {};

    if (
      error.retryAfterSeconds &&
      error.retryAfterSeconds > 0
    ) {
      headers["Retry-After"] =
        String(
          error.retryAfterSeconds
        );
    }

    return noStoreJson(
      {
        error:
          error.message,
        code:
          error.code,
      },
      error.status,
      headers
    );
  }

  if (
    error instanceof
      IdempotencyDomainError ||
    error instanceof
      RefundExecutionDomainError ||
    error instanceof
      RefundOperationLifecycleError ||
    error instanceof
      RefundExecutionOrchestratorError
  ) {
    return noStoreJson(
      {
        error:
          error.message,
        code:
          error.code,
      },
      error.status
    );
  }

  console.error(
    "[ADMIN_REFUND_EXECUTION_ERROR]",
    error
  );

  return noStoreJson(
    {
      error:
        "Failed to execute refund.",
      code:
        "REFUND_EXECUTION_INTERNAL_ERROR",
    },
    500
  );
}

async function executeAuthenticatedRefund(
  request: NextRequest,
  user: AuthenticatedUser
): Promise<NextResponse> {
  const sudoVerification =
    getSudoVerification(
      request
    );

  /**
   * Explicit production gate.
   *
   * The route cannot create a PayMongo refund until this
   * exact flag is intentionally enabled.
   */
  if (
    process.env
      .REFUND_EXECUTION_ENABLED !==
    "YES"
  ) {
    return noStoreJson(
      {
        error:
          "Refund execution is disabled.",
        code:
          "REFUND_EXECUTION_DISABLED",
      },
      503
    );
  }

  const idempotencyKey =
    IdempotencyService
      .parseAndValidateIdempotencyKey(
        request
      );

  /**
   * Preserve the security contract's required ordering:
   * Idempotency-Key is rejected before the distributed
   * limiter is invoked.
   */
  if (!idempotencyKey) {
    validateRefundExecutionSecurity({
      authenticatedUser:
        user,

      sudoVerification,

      idempotencyKey,

      rateLimit: {
        status:
          "UNAVAILABLE",

        reason:
          "RATE_LIMIT_NOT_CHECKED",
      },
    });

    throw new Error(
      "Unreachable refund security state."
    );
  }

  const rateLimitConfig =
    resolveRefundExecutionRateLimitConfig({
      UPSTASH_REDIS_REST_URL:
        process.env
          .UPSTASH_REDIS_REST_URL,

      UPSTASH_REDIS_REST_TOKEN:
        process.env
          .UPSTASH_REDIS_REST_TOKEN,

      VERCEL_ENV:
        process.env
          .VERCEL_ENV,

      NODE_ENV:
        process.env
          .NODE_ENV,
    });

  const limiter =
    rateLimitConfig
      ? createRefundExecutionDistributedLimiter(
          rateLimitConfig
        )
      : null;

  const rateLimit =
    await checkRefundExecutionRateLimit({
      limiter,

      identifier:
        user.id,
    });

  const security =
    validateRefundExecutionSecurity({
      authenticatedUser:
        user,

      sudoVerification,

      idempotencyKey,

      rateLimit,
    });

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return noStoreJson(
      {
        error:
          "Invalid JSON body payload.",
        code:
          "REFUND_EXECUTION_INVALID_JSON",
      },
      400
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return noStoreJson(
      {
        error:
          "Refund execution body must be an object.",
        code:
          "REFUND_EXECUTION_BODY_INVALID",
      },
      400
    );
  }

  const input =
    body as
      Record<string, unknown>;

  const transactionId =
    typeof input.transactionId ===
      "string"
      ? input.transactionId.trim()
      : "";

  const reason =
    input.reason;

  if (!transactionId) {
    return noStoreJson(
      {
        error:
          "transactionId is required.",
        code:
          "REFUND_EXECUTION_TRANSACTION_REQUIRED",
      },
      400
    );
  }

  if (
    !isRefundReason(
      reason
    )
  ) {
    return noStoreJson(
      {
        error:
          "Invalid refund reason.",
        code:
          "REFUND_EXECUTION_REASON_INVALID",
        allowedReasons:
          [...REFUND_REASONS],
      },
      400
    );
  }

  /**
   * Only client intent is hashed.
   *
   * Payment ID, amount, fee, provider reason, and refund
   * history are authoritative server/provider-derived values.
   */
  const requestHash =
    IdempotencyService
      .hashCanonicalPayload({
        transactionId,
        reason,
      });

  /**
   * Resolve a durable replay BEFORE fresh provider preflight.
   *
   * Once a previous operation has reached PayMongo, a fresh
   * refund-history check may legitimately see that refund.
   * The original same-key operation must remain replayable
   * without accidentally creating a new refund.
   */
  let operation =
    await findExistingRefundOperation(
      security.actorId,
      security.idempotencyKey,
      requestHash
    );

  let idempotentReplay =
    operation !== null;

  if (!operation) {
    const secretKey =
      process.env
        .PAYMONGO_SECRET_KEY;

    const preparation =
      await prepareRefundExecution(
        preparationDependencies,
        {
          transactionId,
          reason,
          secretKey,
        }
      );

    if (!preparation.ok) {
      return noStoreJson(
        {
          ...preparation.body,
          code:
            preparation.code,
        },
        preparation.status
      );
    }

    if (
      !preparation.policy.allowed
    ) {
      return noStoreJson(
        {
          error:
            preparation.policy.message,

          code:
            preparation.policy.code,

          policy:
            preparation.policy,
        },
        422
      );
    }

    const amountCentavos =
      preparation.policy
        .customerRefundCentavos;

    if (
      !Number.isSafeInteger(
        amountCentavos
      ) ||
      amountCentavos <= 0 ||
      amountCentavos >
        preparation
          .remainingRefundableCentavos
    ) {
      throw new RefundExecutionDomainError(
        "REFUND_EXECUTION_AMOUNT_INVALID",
        "Authoritative refund amount is invalid. Manual review is required.",
        409
      );
    }

    const reservation =
      await prisma.$transaction(
        async (tx) =>
          reserveRefundOperationInTransaction(
            tx,
            {
              actorId:
                security.actorId,

              idempotencyKey:
                security.idempotencyKey,

              requestHash,

              transactionId,

              paymentId:
                preparation.paymentId,

              amountCentavos,

              reason,

              paymongoReason:
                preparation.policy
                  .paymongoReason,
            }
          )
      );

    operation =
      reservation.operation;

    if (
      reservation.kind ===
      "REPLAY"
    ) {
      idempotentReplay =
        true;
    }
  }

  if (
    idempotentReplay &&
    operation.status ===
      RefundOperationStatus.RESERVED
  ) {
    /**
     * A replayed RESERVED operation has not yet safely crossed
     * the provider-submission boundary.
     *
     * Re-run authoritative preparation before allowing its first
     * PayMongo POST so a stale reservation cannot execute after
     * the payment or refund state has changed.
     */
    const replaySecretKey =
      process.env
        .PAYMONGO_SECRET_KEY;

    const replayPreparation =
      await prepareRefundExecution(
        preparationDependencies,
        {
          transactionId,
          reason,
          secretKey:
            replaySecretKey,
        }
      );

    if (!replayPreparation.ok) {
      return noStoreJson(
        {
          ...replayPreparation.body,
          code:
            replayPreparation.code,
        },
        replayPreparation.status
      );
    }

    if (
      !replayPreparation.policy.allowed
    ) {
      return noStoreJson(
        {
          error:
            replayPreparation.policy
              .message,

          code:
            replayPreparation.policy
              .code,

          policy:
            replayPreparation.policy,
        },
        422
      );
    }

    const replayAmountCentavos =
      replayPreparation.policy
        .customerRefundCentavos;

    if (
      !Number.isSafeInteger(
        replayAmountCentavos
      ) ||
      replayAmountCentavos <= 0 ||
      replayAmountCentavos >
        replayPreparation
          .remainingRefundableCentavos
    ) {
      throw new RefundExecutionDomainError(
        "REFUND_EXECUTION_AMOUNT_INVALID",
        "Authoritative refund amount is invalid. Manual review is required.",
        409
      );
    }

    if (
      operation.transactionId !==
        transactionId ||
      operation.paymentId !==
        replayPreparation.paymentId ||
      operation.amountCentavos !==
        replayAmountCentavos ||
      operation.reason !==
        reason ||
      operation.paymongoReason !==
        replayPreparation.policy
          .paymongoReason
    ) {
      throw new RefundExecutionDomainError(
        "REFUND_RESERVED_OPERATION_STALE",
        "Reserved refund operation no longer matches the authoritative refund decision. Manual review is required.",
        409
      );
    }
  }
  /**
   * Never automatically submit an operation that has already
   * left RESERVED.
   *
   * In particular:
   * - SUBMITTING is not blindly retried
   * - UNKNOWN is not blindly retried
   * - MANUAL_REVIEW_REQUIRED is not blindly retried
   * - completed operations are never re-posted
   */
  if (
    operation.status !==
    RefundOperationStatus.RESERVED
  ) {
    return refundOperationResponse(
      operation,
      {
        idempotentReplay:
          true,

        providerSubmittedThisRequest:
          false,
      }
    );
  }

  const secretKey =
    String(
      process.env
        .PAYMONGO_SECRET_KEY ||
        ""
    ).trim();

  if (!secretKey) {
    return noStoreJson(
      {
        error:
          "Payment provider configuration unavailable.",
        code:
          "PAYMONGO_CONFIGURATION_UNAVAILABLE",
      },
      503
    );
  }

  const payload =
    buildProviderPayload(
      operation
    );

  const result =
    await orchestrateRefundSubmission(
      orchestrationDependencies,
      {
        prepare: {
          operationId:
            operation.id,

          actorId:
            operation.actorId,

          requestHash:
            operation.requestHash,

          paymentId:
            operation.paymentId,

          amountCentavos:
            operation.amountCentavos,

          paymongoIdempotencyKey:
            operation
              .paymongoIdempotencyKey,
        },

        provider: {
          secretKey,

          paymongoIdempotencyKey:
            operation
              .paymongoIdempotencyKey,

          paymentId:
            operation.paymentId,

          amountCentavos:
            operation.amountCentavos,

          payload,

          fetchImpl:
            fetch,
        },
      }
    );

  if (
    result.kind ===
    "ALREADY_STARTED"
  ) {
    return refundOperationResponse(
      result.operation,
      {
        idempotentReplay:
          true,

        providerSubmittedThisRequest:
          false,
      }
    );
  }

  return refundOperationResponse(
    result.operation,
    {
      idempotentReplay,

      providerSubmittedThisRequest:
        true,
    }
  );
}

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    /**
     * Authentication deliberately occurs BEFORE sudo.
     * API routes bypass proxy authentication.
     */
    const {
      user,
      errorResponse,
    } =
      await requireAdminAuth(
        request
      );

    if (errorResponse) {
      return errorResponse;
    }

    if (!user) {
      return noStoreJson(
        {
          error:
            "Unauthorized.",
          code:
            "REFUND_EXECUTION_AUTH_REQUIRED",
        },
        401
      );
    }

    /**
     * Reuse the existing sudo middleware only after primary
     * admin authentication has succeeded.
     *
     * requireSudo validates/logs the ticket but does not expose
     * the verified ticket to its handler, so the authenticated
     * execution function revalidates it for identity binding.
     */
    const sudoProtected =
      requireSudo(
        async (
          sudoRequest:
            NextRequest
        ) =>
          executeAuthenticatedRefund(
            sudoRequest,
            user
          )
      );

    return await sudoProtected(
      request
    );
  } catch (error) {
    return handleExecutionError(
      error
    );
  }
}
