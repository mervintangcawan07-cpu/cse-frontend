// Relative Path: src/lib/payment/refundPolicy.ts
// Pure refund-policy calculation only.
// NO database access, NO PayMongo requests, NO financial mutations.

export const REFUND_REASONS = [
  "SERVICE_NOT_DELIVERED",
  "ACTIVATION_FAILURE",
  "DUPLICATE_PAYMENT",
  "INCORRECT_CHARGE",
  "UNAUTHORIZED_CHARGE",
  "CUSTOMER_CANCELLATION",
  "CHANGE_OF_MIND",
  "OTHER",
] as const;

export type RefundReason = (typeof REFUND_REASONS)[number];

export type SupportedRefundPaymentMethod =
  | "card"
  | "gcash"
  | "paymaya"
  | "qrph";

export type RefundPolicyCode =
  | "APPROVED_FULL"
  | "APPROVED_NET_DISCRETIONARY"
  | "INVALID_FINANCIAL_INPUT"
  | "NO_REFUNDABLE_BALANCE"
  | "UNSUPPORTED_PAYMENT_METHOD"
  | "PRIOR_REFUND_REQUIRES_MANUAL_REVIEW"
  | "UNAUTHORIZED_REQUIRES_MANUAL_REVIEW"
  | "PARTIAL_REFUND_UNSUPPORTED"
  | "MAYA_PARTIAL_NOT_YET_AVAILABLE"
  | "NON_POSITIVE_NET_REFUND";

export interface RefundPolicyInput {
  reason: RefundReason;
  paymentMethod: string;

  // All monetary values are integer centavos.
  originalPaymentCentavos: number;
  originalProcessingFeeCentavos: number;
  cumulativeRefundedCentavos: number;

  // Required only when evaluating a Maya partial refund.
  paymentCreatedAt?: Date;
  now?: Date;
}

export interface RefundPolicyDecision {
  allowed: boolean;
  code: RefundPolicyCode;
  message: string;

  reason: RefundReason;
  reasonClass: "PROTECTED" | "DISCRETIONARY";
  paymentMethod: SupportedRefundPaymentMethod | null;

  originalPaymentCentavos: number;
  originalProcessingFeeCentavos: number;
  cumulativeRefundedCentavos: number;
  remainingRefundableCentavos: number;

  customerRefundCentavos: number;
  deductedOriginalProcessingFeeCentavos: number;

  // We currently do not deduct any estimated/unknown refund-processing fee.
  refundProcessingFeeDeductionCentavos: 0;

  // Useful for the admin preview/accounting explanation.
  merchantAbsorbedOriginalProcessingFeeCentavos: number;

  isPartialRefund: boolean;
  paymongoReason:
    | "duplicate"
    | "fraudulent"
    | "requested_by_customer"
    | "others";
}

const PROTECTED_REASONS = new Set<RefundReason>([
  "SERVICE_NOT_DELIVERED",
  "ACTIVATION_FAILURE",
  "DUPLICATE_PAYMENT",
  "INCORRECT_CHARGE",
  "UNAUTHORIZED_CHARGE",
]);

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function normalizePaymentMethod(
  raw: string
): SupportedRefundPaymentMethod | null {
  const value = String(raw || "").trim().toLowerCase();

  if (value === "card") return "card";
  if (value === "gcash") return "gcash";
  if (value === "paymaya" || value === "maya") return "paymaya";
  if (value === "qrph" || value === "qr_ph" || value === "qr-ph") {
    return "qrph";
  }

  return null;
}

function paymongoReasonFor(
  reason: RefundReason
):
  | "duplicate"
  | "fraudulent"
  | "requested_by_customer"
  | "others" {
  if (reason === "DUPLICATE_PAYMENT") return "duplicate";
  if (reason === "UNAUTHORIZED_CHARGE") return "fraudulent";

  if (
    reason === "CUSTOMER_CANCELLATION" ||
    reason === "CHANGE_OF_MIND"
  ) {
    return "requested_by_customer";
  }

  return "others";
}

function manilaCalendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function calculateRefundPolicy(
  input: RefundPolicyInput
): RefundPolicyDecision {
  const paymentMethod = normalizePaymentMethod(input.paymentMethod);
  const reasonClass: RefundPolicyDecision["reasonClass"] =
    PROTECTED_REASONS.has(input.reason)
      ? "PROTECTED"
      : "DISCRETIONARY";

  const base = {
    reason: input.reason,
    reasonClass,
    paymentMethod,
    originalPaymentCentavos: input.originalPaymentCentavos,
    originalProcessingFeeCentavos: input.originalProcessingFeeCentavos,
    cumulativeRefundedCentavos: input.cumulativeRefundedCentavos,
    refundProcessingFeeDeductionCentavos: 0 as const,
    paymongoReason: paymongoReasonFor(input.reason),
  };

  if (
    !isNonNegativeInteger(input.originalPaymentCentavos) ||
    input.originalPaymentCentavos <= 0 ||
    !isNonNegativeInteger(input.originalProcessingFeeCentavos) ||
    !isNonNegativeInteger(input.cumulativeRefundedCentavos) ||
    input.originalProcessingFeeCentavos > input.originalPaymentCentavos ||
    input.cumulativeRefundedCentavos > input.originalPaymentCentavos
  ) {
    return {
      ...base,
      allowed: false,
      code: "INVALID_FINANCIAL_INPUT",
      message: "Refund calculation received invalid centavo amounts.",
      remainingRefundableCentavos: 0,
      customerRefundCentavos: 0,
      deductedOriginalProcessingFeeCentavos: 0,
      merchantAbsorbedOriginalProcessingFeeCentavos: 0,
      isPartialRefund: false,
    };
  }

  const remainingRefundableCentavos =
    input.originalPaymentCentavos - input.cumulativeRefundedCentavos;

  if (remainingRefundableCentavos <= 0) {
    return {
      ...base,
      allowed: false,
      code: "NO_REFUNDABLE_BALANCE",
      message: "This payment has no remaining refundable balance.",
      remainingRefundableCentavos,
      customerRefundCentavos: 0,
      deductedOriginalProcessingFeeCentavos: 0,
      merchantAbsorbedOriginalProcessingFeeCentavos:
        input.originalProcessingFeeCentavos,
      isPartialRefund: false,
    };
  }

  if (input.reason === "UNAUTHORIZED_CHARGE") {
    return {
      ...base,
      allowed: false,
      code: "UNAUTHORIZED_REQUIRES_MANUAL_REVIEW",
      message:
        "Unauthorized or fraudulent charges require manual review before a refund can be created so any existing PayMongo dispute or chargeback can be checked first.",
      remainingRefundableCentavos,
      customerRefundCentavos: 0,
      deductedOriginalProcessingFeeCentavos: 0,
      merchantAbsorbedOriginalProcessingFeeCentavos:
        input.originalProcessingFeeCentavos,
      isPartialRefund: false,
    };
  }

  if (!paymentMethod) {
    return {
      ...base,
      allowed: false,
      code: "UNSUPPORTED_PAYMENT_METHOD",
      message:
        "The PayMongo payment method is unknown or unsupported. Manual review is required.",
      remainingRefundableCentavos,
      customerRefundCentavos: 0,
      deductedOriginalProcessingFeeCentavos: 0,
      merchantAbsorbedOriginalProcessingFeeCentavos:
        input.originalProcessingFeeCentavos,
      isPartialRefund: false,
    };
  }

  let customerRefundCentavos: number;
  let deductedOriginalProcessingFeeCentavos = 0;

  if (reasonClass === "PROTECTED") {
    // Merchant/platform-fault and protected cases return the full
    // remaining customer-paid amount. GovStudyX absorbs processing costs.
    customerRefundCentavos = remainingRefundableCentavos;
  } else {
    // Fee-deducted discretionary refunds are intentionally restricted to
    // payments with no prior successful refund, avoiding ambiguous allocation
    // of the original processing fee across multiple refund events.
    if (input.cumulativeRefundedCentavos > 0) {
      return {
        ...base,
        allowed: false,
        code: "PRIOR_REFUND_REQUIRES_MANUAL_REVIEW",
        message:
          "A discretionary fee-deducted refund cannot be automatically calculated after an earlier successful refund.",
        remainingRefundableCentavos,
        customerRefundCentavos: 0,
        deductedOriginalProcessingFeeCentavos: 0,
        merchantAbsorbedOriginalProcessingFeeCentavos:
          input.originalProcessingFeeCentavos,
        isPartialRefund: false,
      };
    }

    deductedOriginalProcessingFeeCentavos =
      input.originalProcessingFeeCentavos;

    customerRefundCentavos =
      remainingRefundableCentavos -
      deductedOriginalProcessingFeeCentavos;

    if (customerRefundCentavos <= 0) {
      return {
        ...base,
        allowed: false,
        code: "NON_POSITIVE_NET_REFUND",
        message:
          "The calculated discretionary refund is not a positive amount after the actual original processing fee.",
        remainingRefundableCentavos,
        customerRefundCentavos: 0,
        deductedOriginalProcessingFeeCentavos,
        merchantAbsorbedOriginalProcessingFeeCentavos: 0,
        isPartialRefund: false,
      };
    }
  }

  const isPartialRefund =
    customerRefundCentavos < remainingRefundableCentavos;

  if (isPartialRefund && paymentMethod === "qrph") {
    return {
      ...base,
      allowed: false,
      code: "PARTIAL_REFUND_UNSUPPORTED",
      message:
        "QR Ph supports full refunds only. A fee-deducted partial refund cannot be submitted through PayMongo.",
      remainingRefundableCentavos,
      customerRefundCentavos,
      deductedOriginalProcessingFeeCentavos,
      merchantAbsorbedOriginalProcessingFeeCentavos:
        reasonClass === "PROTECTED"
          ? input.originalProcessingFeeCentavos
          : 0,
      isPartialRefund,
    };
  }

  if (isPartialRefund && paymentMethod === "paymaya") {
    if (!input.paymentCreatedAt) {
      return {
        ...base,
        allowed: false,
        code: "MAYA_PARTIAL_NOT_YET_AVAILABLE",
        message:
          "Maya partial-refund eligibility cannot be confirmed without the authoritative payment creation time.",
        remainingRefundableCentavos,
        customerRefundCentavos,
        deductedOriginalProcessingFeeCentavos,
        merchantAbsorbedOriginalProcessingFeeCentavos:
          reasonClass === "PROTECTED"
            ? input.originalProcessingFeeCentavos
            : 0,
        isPartialRefund,
      };
    }

    const now = input.now ?? new Date();

    if (
      manilaCalendarDate(input.paymentCreatedAt) ===
      manilaCalendarDate(now)
    ) {
      return {
        ...base,
        allowed: false,
        code: "MAYA_PARTIAL_NOT_YET_AVAILABLE",
        message:
          "Maya allows only a full refund on the payment date. Partial refunds become available from 12:00 AM the following day.",
        remainingRefundableCentavos,
        customerRefundCentavos,
        deductedOriginalProcessingFeeCentavos,
        merchantAbsorbedOriginalProcessingFeeCentavos:
          reasonClass === "PROTECTED"
            ? input.originalProcessingFeeCentavos
            : 0,
        isPartialRefund,
      };
    }
  }

  return {
    ...base,
    allowed: true,
    code:
      reasonClass === "PROTECTED" || !isPartialRefund
        ? "APPROVED_FULL"
        : "APPROVED_NET_DISCRETIONARY",
    message:
      reasonClass === "PROTECTED"
        ? "Full remaining customer payment is refundable; GovStudyX absorbs the original processing fee."
        : "Discretionary refund may deduct only the actual original PayMongo processing fee.",
    remainingRefundableCentavos,
    customerRefundCentavos,
    deductedOriginalProcessingFeeCentavos,
    merchantAbsorbedOriginalProcessingFeeCentavos:
      reasonClass === "PROTECTED"
        ? input.originalProcessingFeeCentavos
        : 0,
    isPartialRefund,
  };
}
