/**
 * Synthetic Regression Suite:
 * GovStudyX Refund Execution Safety
 *
 * STRICTLY STATIC / IN-MEMORY / MOCKED.
 *
 * This script:
 * - does not import the refund execution route
 * - does not import src/lib/prisma.ts
 * - performs no database access
 * - constructs no Redis client
 * - performs no real PayMongo request
 * - blocks unexpected global fetch()
 */

import fs from "node:fs";
import path from "node:path";

import {
  RefundOperationStatus,
} from "@prisma/client";

import {
  buildPayMongoRefundCreatePayload,
  derivePayMongoRefundIdempotencyKey,
} from "../lib/payment/refundExecutionContract";

import {
  RefundExecutionOrchestratorError,
  orchestrateRefundSubmission,
} from "../lib/payment/refundExecutionOrchestrator";

import {
  checkRefundExecutionRateLimit,
} from "../lib/payment/refundExecutionRateLimit";

import {
  resolveRefundExecutionRateLimitConfig,
} from "../lib/payment/refundExecutionRateLimitConfig";

import {
  RefundExecutionSecurityError,
  validateRefundExecutionSecurity,
} from "../lib/payment/refundExecutionSecurityContract";

import {
  RefundLifecycleTransitionError,
  transitionRefundOperationStatus,
} from "../lib/payment/refundOperationStateMachine";

import {
  PAYMONGO_REFUND_CREATE_URL,
  submitPayMongoRefund,
  type PayMongoRefundSubmissionResult,
} from "../lib/payment/refundProviderSubmission";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(
  condition: unknown,
  testName: string,
  detail?: string
): void {
  totalTests += 1;

  if (condition) {
    passedTests += 1;
    console.log(`  PASS: ${testName}`);
    return;
  }

  failedTests += 1;
  console.error(
    `  FAIL: ${testName}${detail ? ` - ${detail}` : ""}`
  );
}

function captureSecurityError(
  input: Parameters<
    typeof validateRefundExecutionSecurity
  >[0]
): RefundExecutionSecurityError | null {
  try {
    validateRefundExecutionSecurity(input);
    return null;
  } catch (error) {
    return error instanceof RefundExecutionSecurityError
      ? error
      : null;
  }
}

function responseJson(
  status: number,
  body: unknown
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "content-type":
          "application/json",
      },
    }
  );
}

const PAYMENT_ID =
  "pay_synthetic_refund_001";

const TRANSACTION_ID =
  "txn_synthetic_refund_001";

const ACTOR_ID =
  "admin-synthetic-001";

const AMOUNT_CENTAVOS =
  12345;

const REQUEST_HASH =
  "a".repeat(64);

const OPERATION_ID =
  "refund-operation-synthetic-001";

const PROVIDER_KEY =
  derivePayMongoRefundIdempotencyKey(
    OPERATION_ID,
    REQUEST_HASH
  );

const PAYLOAD =
  buildPayMongoRefundCreatePayload({
    paymentId:
      PAYMENT_ID,

    amountCentavos:
      AMOUNT_CENTAVOS,

    paymongoReason:
      "duplicate",

    internalReason:
      "DUPLICATE_PAYMENT",

    transactionId:
      TRANSACTION_ID,
  });

const FIXED_NOW =
  new Date(
    "2026-08-26T10:00:00.000Z"
  );

function createSyntheticOperation(
  status:
    RefundOperationStatus =
      RefundOperationStatus.RESERVED
): any {
  return {
    id:
      OPERATION_ID,

    transactionId:
      TRANSACTION_ID,

    actorId:
      ACTOR_ID,

    idempotencyKey:
      "client-refund-key-001",

    requestHash:
      REQUEST_HASH,

    paymongoIdempotencyKey:
      PROVIDER_KEY,

    paymentId:
      PAYMENT_ID,

    amountCentavos:
      AMOUNT_CENTAVOS,

    reason:
      "DUPLICATE_PAYMENT",

    paymongoReason:
      "duplicate",

    status,

    refundId:
      null,

    providerStatus:
      null,

    attemptCount:
      status ===
      RefundOperationStatus.RESERVED
        ? 0
        : 1,

    lastAttemptAt:
      null,

    submittedAt:
      null,

    lastHttpStatus:
      null,

    lastErrorCode:
      null,

    lastErrorMessage:
      null,

    completedAt:
      null,

    createdAt:
      FIXED_NOW,

    updatedAt:
      FIXED_NOW,
  };
}

function createLifecycleTransaction(
  operation: any
): any {
  return {
    $queryRaw:
      async () => [
        {
          lock_result:
            "1",
        },
      ],

    refundOperation: {
      findUnique:
        async (
          args: any
        ) => {
          if (
            args?.where?.id !==
            operation.id
          ) {
            return null;
          }

          return {
            ...operation,
          };
        },

      updateMany:
        async (
          args: any
        ) => {
          const where =
            args?.where || {};

          const data =
            args?.data || {};

          if (
            where.id !==
            operation.id
          ) {
            return {
              count: 0,
            };
          }

          if (
            where.status !==
              undefined &&
            where.status !==
              operation.status
          ) {
            return {
              count: 0,
            };
          }

          if (
            data.status !==
            undefined
          ) {
            operation.status =
              data.status;
          }

          if (
            data.attemptCount &&
            typeof data.attemptCount
              .increment ===
              "number"
          ) {
            operation.attemptCount +=
              data.attemptCount
                .increment;
          }

          const directFields = [
            "lastAttemptAt",
            "submittedAt",
            "lastHttpStatus",
            "lastErrorCode",
            "lastErrorMessage",
            "refundId",
            "providerStatus",
            "completedAt",
          ];

          for (
            const field
            of directFields
          ) {
            if (
              Object.prototype
                .hasOwnProperty.call(
                  data,
                  field
                )
            ) {
              operation[field] =
                data[field];
            }
          }

          operation.updatedAt =
            FIXED_NOW;

          return {
            count: 1,
          };
        },
    },
  };
}

function createOrchestrationInput(
  operation: any,
  fetchImpl:
    typeof fetch
) {
  return {
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

      now:
        FIXED_NOW,
    },

    provider: {
      secretKey:
        "sk_synthetic_only",

      paymongoIdempotencyKey:
        operation
          .paymongoIdempotencyKey,

      paymentId:
        operation.paymentId,

      amountCentavos:
        operation.amountCentavos,

      payload:
        buildPayMongoRefundCreatePayload({
          paymentId:
            operation.paymentId,

          amountCentavos:
            operation
              .amountCentavos,

          paymongoReason:
            operation
              .paymongoReason,

          internalReason:
            operation.reason,

          transactionId:
            operation
              .transactionId,
        }),

      fetchImpl,
    },

    resultNow:
      FIXED_NOW,
  };
}

async function main(): Promise<void> {
  console.log(
    "=== REFUND EXECUTION SYNTHETIC SAFETY SUITE ==="
  );

  const originalFetch =
    globalThis.fetch;

  let unexpectedGlobalFetchAttempts =
    0;

  const blockedGlobalFetch =
    (async () => {
      unexpectedGlobalFetchAttempts +=
        1;

      throw new Error(
        "Unexpected global HTTP request blocked by synthetic refund test."
      );
    }) as typeof fetch;

  globalThis.fetch =
    blockedGlobalFetch;

  try {
    // ============================================================
    // 1. Actual route static safety contract
    // ============================================================

    console.log(
      "\n--- Route static safety contract ---"
    );

    const routePath =
      path.join(
        process.cwd(),
        "src",
        "app",
        "api",
        "admin",
        "accounting",
        "refunds",
        "execute",
        "route.ts"
      );

    const route =
      fs.readFileSync(
        routePath,
        "utf8"
      );

    const authPosition =
      route.indexOf(
        "await requireAdminAuth("
      );

    const sudoPosition =
      route.indexOf(
        "requireSudo(",
        authPosition
      );

    assert(
      authPosition >= 0 &&
        sudoPosition >
          authPosition,
      "Route authenticates admin before sudo wrapper"
    );

    const gatePosition =
      route.indexOf(
        "REFUND_EXECUTION_ENABLED"
      );

    const idempotencyParsePosition =
      route.indexOf(
        ".parseAndValidateIdempotencyKey("
      );

    assert(
      gatePosition >= 0 &&
        idempotencyParsePosition >
          gatePosition &&
        route
          .slice(
            gatePosition,
            gatePosition + 300
          )
          .includes('"YES"'),
      "Execution remains protected by explicit YES gate"
    );

    assert(
      route.includes(
        "validateRefundExecutionSecurity"
      ) &&
        route.includes(
          "checkRefundExecutionRateLimit"
        ),
      "Route wires refund security contract and distributed rate limit"
    );

    const hashPosition =
      route.indexOf(
        ".hashCanonicalPayload({"
      );

    const hashEnd =
      route.indexOf(
        "});",
        hashPosition
      );

    const hashBlock =
      hashPosition >= 0 &&
      hashEnd > hashPosition
        ? route.slice(
            hashPosition,
            hashEnd + 3
          )
        : "";

    assert(
      hashBlock.includes(
        "transactionId"
      ) &&
        hashBlock.includes(
          "reason"
        ) &&
        !hashBlock.includes(
          "paymentId"
        ) &&
        !hashBlock.includes(
          "amountCentavos"
        ) &&
        !hashBlock.includes(
          "paymongoReason"
        ),
      "Canonical client-intent hash contains transactionId + reason only"
    );

    assert(
      !/\binput\.(?:amount|amountCentavos|paymentId|paymongoReason)\b/.test(
        route
      ),
      "Route does not accept financial/provider refund values from request body"
    );

    const existingReplayPosition =
      route.indexOf(
        "await findExistingRefundOperation("
      );

    const firstPreparationPosition =
      route.indexOf(
        "await prepareRefundExecution("
      );

    const secondPreparationPosition =
      route.indexOf(
        "await prepareRefundExecution(",
        firstPreparationPosition + 1
      );

    assert(
      existingReplayPosition >= 0 &&
        firstPreparationPosition >
          existingReplayPosition,
      "Durable same-key replay lookup occurs before fresh authoritative preflight"
    );

    assert(
      firstPreparationPosition >= 0 &&
        secondPreparationPosition >
          firstPreparationPosition,
      "Route contains separate fresh and replayed-RESERVED authoritative preflights"
    );

    const replayGuardPosition =
      route.indexOf(
        "idempotentReplay &&"
      );

    const staleGuardPosition =
      route.indexOf(
        "REFUND_RESERVED_OPERATION_STALE"
      );

    const nonReservedPosition =
      route.indexOf(
        "operation.status !==",
        staleGuardPosition
      );

    const orchestrationPosition =
      route.indexOf(
        "await orchestrateRefundSubmission("
      );

    assert(
      replayGuardPosition >= 0 &&
        staleGuardPosition >
          replayGuardPosition &&
        nonReservedPosition >
          staleGuardPosition &&
        orchestrationPosition >
          nonReservedPosition,
      "RESERVED replay revalidation and non-RESERVED stop occur before orchestration"
    );

    assert(
      !/await\s+fetch\s*\(/.test(
        route
      ),
      "Execution route contains no direct provider fetch"
    );

    const forbiddenAccountingSymbols = [
      "LedgerService",
      "postBalancedDoubleEntry",
      "processSingleRefundUnderLock",
      "partnerReward",
      "financialLedgerEntry.create",
      "partnerCommission.update",
      "referralReward.update",
    ];

    assert(
      forbiddenAccountingSymbols.every(
        (symbol) =>
          !route.includes(symbol)
      ),
      "Execution route contains no accounting/referral mutation path"
    );

    // ============================================================
    // 2. Security contract
    // ============================================================

    console.log(
      "\n--- Security contract ---"
    );

    const validSecurityInput = {
      authenticatedUser: {
        id:
          ACTOR_ID,
        role:
          "ADMIN",
      },

      sudoVerification: {
        valid:
          true,
        ticket: {
          userId:
            ACTOR_ID,
          role:
            "ADMIN",
        },
      },

      idempotencyKey:
        " client-key-safe ",

      rateLimit: {
        status:
          "ALLOWED" as const,
      },
    };

    let error =
      captureSecurityError({
        ...validSecurityInput,
        authenticatedUser:
          null,
      });

    assert(
      error?.code ===
        "REFUND_EXECUTION_AUTH_REQUIRED" &&
        error.status === 401,
      "Missing authentication fails closed"
    );

    error =
      captureSecurityError({
        ...validSecurityInput,
        authenticatedUser: {
          id:
            ACTOR_ID,
          role:
            "USER",
        },
      });

    assert(
      error?.code ===
        "REFUND_EXECUTION_ADMIN_REQUIRED" &&
        error.status === 403,
      "Non-admin actor cannot execute refund"
    );

    error =
      captureSecurityError({
        ...validSecurityInput,
        sudoVerification: {
          valid:
            false,
        },
      });

    assert(
      error?.code ===
        "REFUND_EXECUTION_SUDO_REQUIRED" &&
        error.status === 403,
      "Invalid sudo fails closed"
    );

    error =
      captureSecurityError({
        ...validSecurityInput,
        sudoVerification: {
          valid:
            true,
          ticket: {
            userId:
              ACTOR_ID,
            role:
              "USER",
          },
        },
      });

    assert(
      error?.code ===
        "REFUND_EXECUTION_SUDO_ROLE_INVALID" &&
        error.status === 403,
      "Non-admin sudo ticket fails closed"
    );

    error =
      captureSecurityError({
        ...validSecurityInput,
        sudoVerification: {
          valid:
            true,
          ticket: {
            userId:
              "other-admin",
            role:
              "ADMIN",
          },
        },
      });

    assert(
      error?.code ===
        "REFUND_EXECUTION_SUDO_IDENTITY_MISMATCH" &&
        error.status === 403,
      "Sudo identity must match authenticated admin"
    );

    error =
      captureSecurityError({
        ...validSecurityInput,
        idempotencyKey:
          null,
      });

    assert(
      error?.code ===
        "REFUND_EXECUTION_IDEMPOTENCY_REQUIRED" &&
        error.status === 400,
      "Missing Idempotency-Key is rejected"
    );

    error =
      captureSecurityError({
        ...validSecurityInput,
        idempotencyKey:
          "x".repeat(129),
      });

    assert(
      error?.code ===
        "REFUND_EXECUTION_IDEMPOTENCY_INVALID" &&
        error.status === 400,
      "Oversized Idempotency-Key is rejected"
    );

    error =
      captureSecurityError({
        ...validSecurityInput,
        rateLimit: {
          status:
            "UNAVAILABLE",
          reason:
            "SYNTHETIC",
        },
      });

    assert(
      error?.code ===
        "REFUND_EXECUTION_RATE_LIMIT_UNAVAILABLE" &&
        error.status === 503,
      "Unavailable distributed rate limiter fails closed"
    );

    error =
      captureSecurityError({
        ...validSecurityInput,
        rateLimit: {
          status:
            "DENIED",
          retryAfterSeconds:
            37,
        },
      });

    assert(
      error?.code ===
        "REFUND_EXECUTION_RATE_LIMITED" &&
        error.status === 429 &&
        error.retryAfterSeconds ===
          37,
      "Denied rate limit returns 429 with retry metadata"
    );

    const validatedSecurity =
      validateRefundExecutionSecurity(
        validSecurityInput
      );

    assert(
      validatedSecurity.actorId ===
        ACTOR_ID &&
        validatedSecurity.idempotencyKey ===
          "client-key-safe",
      "Valid security input returns normalized actor and key"
    );

    // ============================================================
    // 3. Rate limit adapter/config
    // ============================================================

    console.log(
      "\n--- Fail-closed rate limit ---"
    );

    const noLimiter =
      await checkRefundExecutionRateLimit({
        limiter:
          null,
        identifier:
          ACTOR_ID,
        nowMs:
          1000,
      });

    assert(
      noLimiter.status ===
        "UNAVAILABLE",
      "Missing distributed limiter returns UNAVAILABLE"
    );

    const throwingLimiter =
      await checkRefundExecutionRateLimit({
        limiter: {
          limit:
            async () => {
              throw new Error(
                "synthetic limiter failure"
              );
            },
        },

        identifier:
          ACTOR_ID,

        nowMs:
          1000,
      });

    assert(
      throwingLimiter.status ===
        "UNAVAILABLE",
      "Thrown limiter call returns UNAVAILABLE"
    );

    const malformedLimiter =
      await checkRefundExecutionRateLimit({
        limiter: {
          limit:
            async () =>
              ({
                success:
                  true,
              } as any),
        },

        identifier:
          ACTOR_ID,

        nowMs:
          1000,
      });

    assert(
      malformedLimiter.status ===
        "UNAVAILABLE",
      "Malformed limiter result fails closed"
    );

    const deniedLimiter =
      await checkRefundExecutionRateLimit({
        limiter: {
          limit:
            async () => ({
              success:
                false,
              limit:
                3,
              remaining:
                0,
              reset:
                3500,
            }),
        },

        identifier:
          ACTOR_ID,

        nowMs:
          1000,
      });

    assert(
      deniedLimiter.status ===
        "DENIED" &&
        deniedLimiter
          .retryAfterSeconds ===
          3,
      "Denied limiter calculates retry-after"
    );

    const allowedLimiter =
      await checkRefundExecutionRateLimit({
        limiter: {
          limit:
            async () => ({
              success:
                true,
              limit:
                3,
              remaining:
                2,
              reset:
                3500,
            }),
        },

        identifier:
          ACTOR_ID,

        nowMs:
          1000,
      });

    assert(
      allowedLimiter.status ===
        "ALLOWED",
      "Valid distributed limiter permits execution"
    );

    assert(
      resolveRefundExecutionRateLimitConfig(
        {}
      ) === null,
      "Missing rate-limit configuration resolves to null"
    );

    const explicitConfig =
      resolveRefundExecutionRateLimitConfig({
        UPSTASH_REDIS_REST_URL:
          "https://synthetic.example.test",

        UPSTASH_REDIS_REST_TOKEN:
          "synthetic-token",

        VERCEL_ENV:
          "production",
      });

    assert(
      explicitConfig?.namespace ===
        "production" &&
        explicitConfig.url ===
          "https://synthetic.example.test" &&
        explicitConfig.token ===
          "synthetic-token",
      "Explicit rate-limit configuration resolves without environment fallback"
    );

    // ============================================================
    // 4. Lifecycle state machine
    // ============================================================

    console.log(
      "\n--- Refund lifecycle state machine ---"
    );

    assert(
      transitionRefundOperationStatus(
        RefundOperationStatus.RESERVED,
        "START_SUBMISSION"
      ) ===
        RefundOperationStatus.SUBMITTING,
      "RESERVED transitions to SUBMITTING"
    );

    assert(
      transitionRefundOperationStatus(
        RefundOperationStatus.SUBMITTING,
        "AMBIGUOUS_RESULT"
      ) ===
        RefundOperationStatus.UNKNOWN,
      "Ambiguous submission transitions to UNKNOWN"
    );

    assert(
      transitionRefundOperationStatus(
        RefundOperationStatus.SUBMITTING,
        "PROVIDER_SUCCEEDED"
      ) ===
        RefundOperationStatus.SUCCEEDED,
      "Provider success transitions to SUCCEEDED"
    );

    let unknownRestartBlocked =
      false;

    try {
      transitionRefundOperationStatus(
        RefundOperationStatus.UNKNOWN,
        "START_SUBMISSION"
      );
    } catch (stateError) {
      unknownRestartBlocked =
        stateError instanceof
        RefundLifecycleTransitionError;
    }

    assert(
      unknownRestartBlocked,
      "UNKNOWN cannot transition back to SUBMITTING"
    );

    // ============================================================
    // 5. Deterministic provider contract
    // ============================================================

    console.log(
      "\n--- Provider execution contract ---"
    );

    const providerKeyAgain =
      derivePayMongoRefundIdempotencyKey(
        OPERATION_ID,
        REQUEST_HASH
      );

    const providerKeyDifferentHash =
      derivePayMongoRefundIdempotencyKey(
        OPERATION_ID,
        "b".repeat(64)
      );

    assert(
      PROVIDER_KEY ===
        providerKeyAgain &&
        PROVIDER_KEY !==
          providerKeyDifferentHash,
      "Provider idempotency key is deterministic and request-bound"
    );

    assert(
      PAYLOAD.data.attributes
        .payment_id ===
        PAYMENT_ID &&
        PAYLOAD.data.attributes
          .amount ===
          AMOUNT_CENTAVOS &&
        PAYLOAD.data.attributes
          .reason ===
          "duplicate" &&
        PAYLOAD.data.attributes
          .notes.includes(
            TRANSACTION_ID
          ) &&
        PAYLOAD.data.attributes
          .notes.includes(
            "DUPLICATE_PAYMENT"
          ),
      "Provider payload is deterministic from authoritative values"
    );

    // ============================================================
    // 6. PayMongo adapter with injected fetch only
    // ============================================================

    console.log(
      "\n--- Mocked PayMongo adapter ---"
    );

    let successFetchCalls =
      0;

    let successUrl:
      any =
        null;

    let successInit:
      any =
        null;

    const successFetch =
      (async (
        input: any,
        init?: any
      ) => {
        successFetchCalls +=
          1;

        successUrl =
          input;

        successInit =
          init;

        return responseJson(
          200,
          {
            data: {
              id:
                "ref_synthetic_001",

              type:
                "refund",

              attributes: {
                amount:
                  AMOUNT_CENTAVOS,

                currency:
                  "PHP",

                payment_id:
                  PAYMENT_ID,

                status:
                  "pending",
              },
            },
          }
        );
      }) as typeof fetch;

    const successResult =
      await submitPayMongoRefund({
        secretKey:
          "sk_synthetic_only",

        paymongoIdempotencyKey:
          PROVIDER_KEY,

        paymentId:
          PAYMENT_ID,

        amountCentavos:
          AMOUNT_CENTAVOS,

        payload:
          PAYLOAD,

        fetchImpl:
          successFetch,

        timeoutMs:
          1000,
      });

    assert(
      successFetchCalls ===
        1 &&
        successResult.kind ===
          "PROVIDER_RESULT" &&
        successResult.lifecycleEvent ===
          "PROVIDER_PENDING",
      "Provider adapter performs exactly one injected POST on valid response"
    );

    const successHeaders =
      new Headers(
        successInit?.headers
      );

    assert(
      String(successUrl) ===
        PAYMONGO_REFUND_CREATE_URL &&
        successInit?.method ===
          "POST" &&
        successHeaders.get(
          "Idempotency-Key"
        ) === PROVIDER_KEY &&
        successInit?.body ===
          JSON.stringify(
            PAYLOAD
          ),
      "Provider adapter sends exact URL, POST method, provider key, and deterministic body"
    );

    let networkCalls =
      0;

    const networkFailureFetch =
      (async () => {
        networkCalls +=
          1;

        throw new Error(
          "synthetic network ambiguity"
        );
      }) as typeof fetch;

    const networkResult =
      await submitPayMongoRefund({
        secretKey:
          "sk_synthetic_only",

        paymongoIdempotencyKey:
          PROVIDER_KEY,

        paymentId:
          PAYMENT_ID,

        amountCentavos:
          AMOUNT_CENTAVOS,

        payload:
          PAYLOAD,

        fetchImpl:
          networkFailureFetch,

        timeoutMs:
          1000,
      });

    assert(
      networkCalls === 1 &&
        networkResult.kind ===
          "AMBIGUOUS" &&
        networkResult.lifecycleEvent ===
          "AMBIGUOUS_RESULT",
      "Network ambiguity produces UNKNOWN-class result with no adapter retry"
    );

    let serverErrorCalls =
      0;

    const serverErrorFetch =
      (async () => {
        serverErrorCalls +=
          1;

        return responseJson(
          503,
          {
            errors: [
              {
                code:
                  "synthetic_503",
                detail:
                  "synthetic",
              },
            ],
          }
        );
      }) as typeof fetch;

    const serverErrorResult =
      await submitPayMongoRefund({
        secretKey:
          "sk_synthetic_only",

        paymongoIdempotencyKey:
          PROVIDER_KEY,

        paymentId:
          PAYMENT_ID,

        amountCentavos:
          AMOUNT_CENTAVOS,

        payload:
          PAYLOAD,

        fetchImpl:
          serverErrorFetch,

        timeoutMs:
          1000,
      });

    assert(
      serverErrorCalls ===
        1 &&
        serverErrorResult.kind ===
          "AMBIGUOUS",
      "Provider 5xx is ambiguous and is not automatically retried"
    );

    const authErrorResult =
      await submitPayMongoRefund({
        secretKey:
          "sk_synthetic_only",

        paymongoIdempotencyKey:
          PROVIDER_KEY,

        paymentId:
          PAYMENT_ID,

        amountCentavos:
          AMOUNT_CENTAVOS,

        payload:
          PAYLOAD,

        fetchImpl:
          (async () =>
            responseJson(
              401,
              {
                errors: [
                  {
                    code:
                      "synthetic_auth",
                  },
                ],
              }
            )) as typeof fetch,

        timeoutMs:
          1000,
      });

    assert(
      authErrorResult.kind ===
        "MANUAL_REVIEW",
      "Provider auth failure requires manual review"
    );

    const rejectedResult =
      await submitPayMongoRefund({
        secretKey:
          "sk_synthetic_only",

        paymongoIdempotencyKey:
          PROVIDER_KEY,

        paymentId:
          PAYMENT_ID,

        amountCentavos:
          AMOUNT_CENTAVOS,

        payload:
          PAYLOAD,

        fetchImpl:
          (async () =>
            responseJson(
              422,
              {
                errors: [
                  {
                    code:
                      "synthetic_validation",
                  },
                ],
              }
            )) as typeof fetch,

        timeoutMs:
          1000,
      });

    assert(
      rejectedResult.kind ===
        "REJECTED" &&
        rejectedResult
          .lifecycleEvent ===
          "DEFINITIVE_REJECTION",
      "Known provider validation failure is definitive rejection"
    );

    const malformedSuccess =
      await submitPayMongoRefund({
        secretKey:
          "sk_synthetic_only",

        paymongoIdempotencyKey:
          PROVIDER_KEY,

        paymentId:
          PAYMENT_ID,

        amountCentavos:
          AMOUNT_CENTAVOS,

        payload:
          PAYLOAD,

        fetchImpl:
          (async () =>
            responseJson(
              200,
              {
                data: {
                  unexpected:
                    true,
                },
              }
            )) as typeof fetch,

        timeoutMs:
          1000,
      });

    assert(
      malformedSuccess.kind ===
        "MANUAL_REVIEW",
      "Malformed successful provider response fails closed"
    );

    const mismatchedPayment =
      await submitPayMongoRefund({
        secretKey:
          "sk_synthetic_only",

        paymongoIdempotencyKey:
          PROVIDER_KEY,

        paymentId:
          PAYMENT_ID,

        amountCentavos:
          AMOUNT_CENTAVOS,

        payload:
          PAYLOAD,

        fetchImpl:
          (async () =>
            responseJson(
              200,
              {
                data: {
                  id:
                    "ref_synthetic_002",

                  type:
                    "refund",

                  attributes: {
                    amount:
                      AMOUNT_CENTAVOS,

                    currency:
                      "PHP",

                    payment_id:
                      "pay_wrong",

                    status:
                      "pending",
                  },
                },
              }
            )) as typeof fetch,

        timeoutMs:
          1000,
      });

    assert(
      mismatchedPayment.kind ===
        "MANUAL_REVIEW",
      "Provider payment mismatch fails closed"
    );

    const unknownProviderStatus =
      await submitPayMongoRefund({
        secretKey:
          "sk_synthetic_only",

        paymongoIdempotencyKey:
          PROVIDER_KEY,

        paymentId:
          PAYMENT_ID,

        amountCentavos:
          AMOUNT_CENTAVOS,

        payload:
          PAYLOAD,

        fetchImpl:
          (async () =>
            responseJson(
              200,
              {
                data: {
                  id:
                    "ref_synthetic_003",

                  type:
                    "refund",

                  attributes: {
                    amount:
                      AMOUNT_CENTAVOS,

                    currency:
                      "PHP",

                    payment_id:
                      PAYMENT_ID,

                    status:
                      "future_status",
                  },
                },
              }
            )) as typeof fetch,

        timeoutMs:
          1000,
      });

    assert(
      unknownProviderStatus.kind ===
        "MANUAL_REVIEW",
      "Unknown provider lifecycle status fails closed"
    );

    // ============================================================
    // 7. Orchestrator / no-second-POST invariant
    // ============================================================

    console.log(
      "\n--- Orchestrator no-second-POST invariant ---"
    );

    const ambiguousOperation =
      createSyntheticOperation(
        RefundOperationStatus.RESERVED
      );

    const ambiguousTx =
      createLifecycleTransaction(
        ambiguousOperation
      );

    let transactionDepth =
      0;

    let transactionCalls =
      0;

    let providerCalls =
      0;

    let providerCalledInsideTransaction =
      false;

    const ambiguousResult:
      PayMongoRefundSubmissionResult = {
        kind:
          "AMBIGUOUS",

        lifecycleEvent:
          "AMBIGUOUS_RESULT",

        httpStatus:
          null,

        errorCode:
          "SYNTHETIC_AMBIGUOUS",

        errorMessage:
          "Synthetic ambiguous result.",
      };

    const runInTransaction =
      async <T>(
        work:
          (
            tx: any
          ) => Promise<T>
      ): Promise<T> => {
        transactionCalls +=
          1;

        transactionDepth +=
          1;

        try {
          return await work(
            ambiguousTx
          );
        } finally {
          transactionDepth -=
            1;
        }
      };

    const submitProvider =
      async (): Promise<
        PayMongoRefundSubmissionResult
      > => {
        providerCalls +=
          1;

        if (
          transactionDepth > 0
        ) {
          providerCalledInsideTransaction =
            true;
        }

        return ambiguousResult;
      };

    const orchestrationInput =
      createOrchestrationInput(
        ambiguousOperation,
        blockedGlobalFetch
      );

    const firstSubmission =
      await orchestrateRefundSubmission(
        {
          runInTransaction,
          submitProvider,
        },
        orchestrationInput
      );

    assert(
      firstSubmission.kind ===
        "SUBMITTED" &&
        providerCalls === 1 &&
        transactionCalls === 2 &&
        ambiguousOperation.status ===
          RefundOperationStatus.UNKNOWN &&
        ambiguousOperation
          .attemptCount ===
          1,
      "First RESERVED orchestration submits once and persists ambiguity as UNKNOWN"
    );

    assert(
      providerCalledInsideTransaction ===
        false,
      "Provider submission occurs outside database transaction boundary"
    );

    const transactionCallsBeforeReplay =
      transactionCalls;

    const secondSubmission =
      await orchestrateRefundSubmission(
        {
          runInTransaction,
          submitProvider,
        },
        orchestrationInput
      );

    assert(
      secondSubmission.kind ===
        "ALREADY_STARTED" &&
        providerCalls === 1 &&
        transactionCalls ===
          transactionCallsBeforeReplay +
            1 &&
        ambiguousOperation.status ===
          RefundOperationStatus.UNKNOWN &&
        ambiguousOperation
          .attemptCount ===
          1,
      "Same operation after ambiguous result cannot issue a second provider POST"
    );

    const alreadyAdvancedStatuses = [
      RefundOperationStatus.SUBMITTING,
      RefundOperationStatus.PENDING,
      RefundOperationStatus.PROCESSING,
      RefundOperationStatus.UNKNOWN,
      RefundOperationStatus.MANUAL_REVIEW_REQUIRED,
      RefundOperationStatus.SUCCEEDED,
      RefundOperationStatus.FAILED,
      RefundOperationStatus.REJECTED,
    ];

    for (
      const status
      of alreadyAdvancedStatuses
    ) {
      const operation =
        createSyntheticOperation(
          status
        );

      const tx =
        createLifecycleTransaction(
          operation
        );

      let localProviderCalls =
        0;

      const localRunInTransaction =
        async <T>(
          work:
            (
              transaction:
                any
            ) => Promise<T>
        ): Promise<T> =>
          work(tx);

      const result =
        await orchestrateRefundSubmission(
          {
            runInTransaction:
              localRunInTransaction,

            submitProvider:
              async () => {
                localProviderCalls +=
                  1;

                return ambiguousResult;
              },
          },

          createOrchestrationInput(
            operation,
            blockedGlobalFetch
          )
        );

      assert(
        result.kind ===
          "ALREADY_STARTED" &&
          localProviderCalls ===
            0,
        `${status} operation cannot trigger automatic provider submission`
      );
    }

    const mismatchedOperation =
      createSyntheticOperation(
        RefundOperationStatus.RESERVED
      );

    const mismatchedTx =
      createLifecycleTransaction(
        mismatchedOperation
      );

    let mismatchTransactionCalls =
      0;

    let mismatchProviderCalls =
      0;

    const mismatchedInput =
      createOrchestrationInput(
        mismatchedOperation,
        blockedGlobalFetch
      );

    mismatchedInput.provider
      .amountCentavos +=
      1;

    let mismatchError:
      RefundExecutionOrchestratorError
      | null =
        null;

    try {
      await orchestrateRefundSubmission(
        {
          runInTransaction:
            async <T>(
              work:
                (
                  tx:
                    any
                ) => Promise<T>
            ): Promise<T> => {
              mismatchTransactionCalls +=
                1;

              return work(
                mismatchedTx
              );
            },

          submitProvider:
            async () => {
              mismatchProviderCalls +=
                1;

              return ambiguousResult;
            },
        },
        mismatchedInput
      );
    } catch (caught) {
      if (
        caught instanceof
        RefundExecutionOrchestratorError
      ) {
        mismatchError =
          caught;
      }
    }

    assert(
      mismatchError?.code ===
        "REFUND_ORCHESTRATION_AMOUNT_MISMATCH" &&
        mismatchTransactionCalls ===
          0 &&
        mismatchProviderCalls ===
          0,
      "Orchestrator rejects amount mismatch before transaction or provider boundary"
    );

    // ============================================================
    // 8. Absolute network guard
    // ============================================================

    assert(
      unexpectedGlobalFetchAttempts ===
        0,
      "Synthetic suite made zero unexpected global HTTP requests",
      `attempts=${unexpectedGlobalFetchAttempts}`
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }

  console.log(
    "\n============================================================"
  );

  console.log(
    `RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`
  );

  console.log(
    "============================================================"
  );

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "Fatal synthetic refund test error:",
    error instanceof Error
      ? error.message
      : "unknown error"
  );

  process.exit(1);
});
