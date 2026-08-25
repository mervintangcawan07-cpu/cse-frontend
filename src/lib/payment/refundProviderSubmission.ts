// Relative Path: src/lib/payment/refundProviderSubmission.ts

import type {
  PayMongoRefundCreatePayload,
} from "@/lib/payment/refundExecutionContract";
import type {
  RefundLifecycleEvent,
} from "@/lib/payment/refundOperationStateMachine";

export const PAYMONGO_REFUND_CREATE_URL =
  "https://api.paymongo.com/v1/refunds";

export interface PayMongoCreatedRefundResource {
  id: string;
  type: "refund";
  attributes: {
    amount: number;
    currency?: string;
    payment_id: string;
    status: string;
    reason?: string;
    notes?: string | null;
    [key: string]: unknown;
  };
}

export type PayMongoRefundSubmissionResult =
  | {
      kind: "PROVIDER_RESULT";
      lifecycleEvent:
        | "PROVIDER_PENDING"
        | "PROVIDER_PROCESSING"
        | "PROVIDER_SUCCEEDED"
        | "PROVIDER_FAILED";
      httpStatus: number;
      refund: PayMongoCreatedRefundResource;
    }
  | {
      kind: "REJECTED";
      lifecycleEvent: "DEFINITIVE_REJECTION";
      httpStatus: number;
      errorCode: string | null;
      errorMessage: string | null;
    }
  | {
      kind: "AMBIGUOUS";
      lifecycleEvent: "AMBIGUOUS_RESULT";
      httpStatus: number | null;
      errorCode: string;
      errorMessage: string;
    }
  | {
      kind: "MANUAL_REVIEW";
      lifecycleEvent: "REQUIRE_MANUAL_REVIEW";
      httpStatus: number | null;
      errorCode: string;
      errorMessage: string;
    };

export interface SubmitPayMongoRefundInput {
  secretKey: string;
  paymongoIdempotencyKey: string;

  paymentId: string;
  amountCentavos: number;

  payload: PayMongoRefundCreatePayload;

  /**
   * Dependency injection is mandatory.
   * Production may later pass global fetch explicitly.
   * Tests pass a mock and therefore cannot contact PayMongo.
   */
  fetchImpl: typeof fetch;

  timeoutMs?: number;
}

function cleanProviderText(
  value: unknown,
  maxLength: number
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, maxLength);
}

function extractProviderError(
  body: any
): {
  errorCode: string | null;
  errorMessage: string | null;
} {
  const firstError =
    Array.isArray(body?.errors) && body.errors.length > 0
      ? body.errors[0]
      : null;

  return {
    errorCode: cleanProviderText(
      firstError?.code ?? body?.code,
      128
    ),

    errorMessage: cleanProviderText(
      firstError?.detail ??
        firstError?.message ??
        body?.message,
      1000
    ),
  };
}

function lifecycleEventForProviderStatus(
  status: string
): RefundLifecycleEvent | null {
  switch (status) {
    case "pending":
      return "PROVIDER_PENDING";

    case "processing":
      return "PROVIDER_PROCESSING";

    case "succeeded":
      return "PROVIDER_SUCCEEDED";

    case "failed":
      return "PROVIDER_FAILED";

    default:
      return null;
  }
}

function validateInput(
  input: SubmitPayMongoRefundInput
): void {
  const secretKey =
    String(input.secretKey || "").trim();

  const providerKey =
    String(
      input.paymongoIdempotencyKey || ""
    ).trim();

  const paymentId =
    String(input.paymentId || "").trim();

  if (!secretKey) {
    throw new Error(
      "REFUND_PAYMONGO_SECRET_REQUIRED"
    );
  }

  if (
    providerKey.length < 1 ||
    providerKey.length > 255
  ) {
    throw new Error(
      "REFUND_PROVIDER_IDEMPOTENCY_KEY_INVALID"
    );
  }

  if (!paymentId.startsWith("pay_")) {
    throw new Error(
      "REFUND_PAYMENT_ID_INVALID"
    );
  }

  if (
    !Number.isSafeInteger(input.amountCentavos) ||
    input.amountCentavos <= 0
  ) {
    throw new Error(
      "REFUND_AMOUNT_INVALID"
    );
  }

  if (typeof input.fetchImpl !== "function") {
    throw new Error(
      "REFUND_FETCH_IMPLEMENTATION_REQUIRED"
    );
  }

  const attributes =
    input.payload?.data?.attributes;

  if (
    attributes?.payment_id !== paymentId ||
    attributes?.amount !==
      input.amountCentavos
  ) {
    throw new Error(
      "REFUND_PROVIDER_PAYLOAD_MISMATCH"
    );
  }

  const timeoutMs =
    input.timeoutMs ?? 10000;

  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    timeoutMs > 30000
  ) {
    throw new Error(
      "REFUND_PROVIDER_TIMEOUT_INVALID"
    );
  }
}

function ambiguousResult(
  httpStatus: number | null,
  errorCode: string,
  errorMessage: string
): PayMongoRefundSubmissionResult {
  return {
    kind: "AMBIGUOUS",
    lifecycleEvent: "AMBIGUOUS_RESULT",
    httpStatus,
    errorCode,
    errorMessage,
  };
}

function manualReviewResult(
  httpStatus: number | null,
  errorCode: string,
  errorMessage: string
): PayMongoRefundSubmissionResult {
  return {
    kind: "MANUAL_REVIEW",
    lifecycleEvent: "REQUIRE_MANUAL_REVIEW",
    httpStatus,
    errorCode,
    errorMessage,
  };
}

/**
 * Sends exactly one PayMongo Create Refund request.
 *
 * This function:
 * - never generates the provider idempotency key
 * - never retries automatically
 * - never reads environment variables
 * - never writes the database
 * - requires fetch dependency injection
 *
 * Recovery of UNKNOWN is deliberately handled elsewhere.
 */
export async function submitPayMongoRefund(
  input: SubmitPayMongoRefundInput
): Promise<PayMongoRefundSubmissionResult> {
  validateInput(input);

  const secretKey =
    input.secretKey.trim();

  const providerKey =
    input.paymongoIdempotencyKey.trim();

  const paymentId =
    input.paymentId.trim();

  const timeoutMs =
    input.timeoutMs ?? 10000;

  const authorization =
    Buffer.from(
      `${secretKey}:`
    ).toString("base64");

  let response: Response;

  try {
    response = await input.fetchImpl(
      PAYMONGO_REFUND_CREATE_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${authorization}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",

          "Idempotency-Key":
            providerKey,
        },

        body:
          JSON.stringify(input.payload),

        signal:
          AbortSignal.timeout(timeoutMs),
      }
    );
  } catch {
    /**
     * A transport failure is ambiguous:
     * PayMongo may have accepted the request before the
     * connection failed.
     *
     * Never issue a fresh-key automatic retry here.
     */
    return ambiguousResult(
      null,
      "PAYMONGO_REFUND_NETWORK_AMBIGUOUS",
      "The PayMongo refund submission result is unknown because the network request did not complete cleanly."
    );
  }

  const body =
    await response.json().catch(
      () => null
    );

  if (!response.ok) {
    const providerError =
      extractProviderError(body);

    /**
     * These responses can occur after the provider may have
     * begun processing, or are transient concurrency/rate/server
     * conditions. Fail closed into UNKNOWN.
     */
    if (
      response.status === 408 ||
      response.status === 409 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      return ambiguousResult(
        response.status,
        providerError.errorCode ??
          "PAYMONGO_REFUND_HTTP_AMBIGUOUS",

        providerError.errorMessage ??
          "PayMongo returned an ambiguous or transient refund response."
      );
    }

    /**
     * Authentication/authorization/configuration failures should
     * be investigated rather than represented as a customer/payment
     * refund rejection.
     */
    if (
      response.status === 401 ||
      response.status === 403
    ) {
      return manualReviewResult(
        response.status,
        providerError.errorCode ??
          "PAYMONGO_REFUND_AUTH_ERROR",

        providerError.errorMessage ??
          "PayMongo rejected the refund credentials or permissions."
      );
    }

    /**
     * Known request/payment validation failures are definitive:
     * no refund resource was returned.
     */
    if (
      response.status === 400 ||
      response.status === 402 ||
      response.status === 404 ||
      response.status === 422
    ) {
      return {
        kind: "REJECTED",
        lifecycleEvent:
          "DEFINITIVE_REJECTION",
        httpStatus: response.status,
        errorCode:
          providerError.errorCode,
        errorMessage:
          providerError.errorMessage,
      };
    }

    return manualReviewResult(
      response.status,
      providerError.errorCode ??
        "PAYMONGO_REFUND_UNCLASSIFIED_HTTP",

      providerError.errorMessage ??
        "PayMongo returned an unclassified refund error response."
    );
  }

  const refund =
    body?.data as
      | PayMongoCreatedRefundResource
      | undefined;

  /**
   * A successful HTTP status without a trustworthy refund
   * resource is financially ambiguous. Do not guess.
   */
  if (
    !refund ||
    typeof refund.id !== "string" ||
    !refund.id.startsWith("ref_") ||
    refund.type !== "refund" ||
    !refund.attributes
  ) {
    return manualReviewResult(
      response.status,
      "PAYMONGO_REFUND_INVALID_SUCCESS_RESPONSE",
      "PayMongo returned a successful HTTP status without a valid refund resource."
    );
  }

  if (
    refund.attributes.payment_id !==
    paymentId
  ) {
    return manualReviewResult(
      response.status,
      "PAYMONGO_REFUND_PAYMENT_MISMATCH",
      "PayMongo returned a refund resource for a different payment."
    );
  }

  if (
    refund.attributes.amount !==
    input.amountCentavos
  ) {
    return manualReviewResult(
      response.status,
      "PAYMONGO_REFUND_AMOUNT_MISMATCH",
      "PayMongo returned a refund resource with an unexpected amount."
    );
  }

  if (
    refund.attributes.currency &&
    String(
      refund.attributes.currency
    ).toUpperCase() !== "PHP"
  ) {
    return manualReviewResult(
      response.status,
      "PAYMONGO_REFUND_CURRENCY_MISMATCH",
      "PayMongo returned a refund resource with an unexpected currency."
    );
  }

  const providerStatus =
    String(
      refund.attributes.status || ""
    )
      .trim()
      .toLowerCase();

  const lifecycleEvent =
    lifecycleEventForProviderStatus(
      providerStatus
    );

  if (!lifecycleEvent) {
    return manualReviewResult(
      response.status,
      "PAYMONGO_REFUND_UNKNOWN_STATUS",
      "PayMongo returned an unknown refund lifecycle status."
    );
  }

  return {
    kind: "PROVIDER_RESULT",
    lifecycleEvent:
      lifecycleEvent as
        | "PROVIDER_PENDING"
        | "PROVIDER_PROCESSING"
        | "PROVIDER_SUCCEEDED"
        | "PROVIDER_FAILED",
    httpStatus: response.status,
    refund,
  };
}
