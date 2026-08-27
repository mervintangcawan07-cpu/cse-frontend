// Pure refund-history safety predicates.
//
// IMPORTANT:
// - no Prisma imports
// - no network access
// - no environment access
// - no financial mutations

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as UnknownRecord;
}

/**
 * Recognizes only the exact PayMongo response observed when List Refunds
 * rejects payment_id for a Payment with no refund resource history.
 *
 * Multiple errors intentionally fail closed.
 */
export function isExactPayMongoPaymentIdListRejection(
  httpStatus: number,
  payload: unknown
): boolean {
  if (httpStatus !== 400) {
    return false;
  }

  const root = asRecord(payload);

  if (
    !root ||
    !Array.isArray(root.errors) ||
    root.errors.length !== 1
  ) {
    return false;
  }

  const error = asRecord(root.errors[0]);

  if (
    !error ||
    error.code !== "parameter_invalid"
  ) {
    return false;
  }

  const source = asRecord(error.source);

  return (
    source?.pointer ===
    "data.attributes.payment_id"
  );
}

/**
 * Verifies that an already-authoritative PayMongo Payment resource
 * explicitly reports an empty embedded refunds array.
 *
 * Missing/malformed/non-empty refund history always fails closed.
 */
export function hasVerifiedEmptyEmbeddedRefundHistory(
  paymentId: string,
  payment: unknown
): boolean {
  if (
    !paymentId ||
    !paymentId.startsWith("pay_")
  ) {
    return false;
  }

  const resource = asRecord(payment);

  if (
    !resource ||
    resource.id !== paymentId ||
    resource.type !== "payment"
  ) {
    return false;
  }

  const attributes = asRecord(
    resource.attributes
  );

  if (
    !attributes ||
    attributes.status !== "paid"
  ) {
    return false;
  }

  return (
    Array.isArray(attributes.refunds) &&
    attributes.refunds.length === 0
  );
}
