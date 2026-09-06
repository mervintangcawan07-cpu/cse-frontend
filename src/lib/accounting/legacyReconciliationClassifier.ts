// Relative Path: src/lib/accounting/legacyReconciliationClassifier.ts
import type { ReconciliationRecord } from "@prisma/client";

const POSTGRESQL_INTEGER_MAX = 2_147_483_647;
const LEGACY_MATCHED_NOTE = "Matched with verified ledger entries.";
const LEGACY_MISSING_NOTE = "Missing balanced payment ledger entries.";
const LEGACY_MISMATCH_PATTERN =
  /^Amount mismatch: Expected (0|[1-9][0-9]*), got (0|[1-9][0-9]*)$/;

export type LegacyReconciliationAutoAdoptableReason =
  | "HISTORICAL_MATCHED_PROVEN"
  | "HISTORICAL_MISSING_PROVEN"
  | "HISTORICAL_MISMATCHED_PROVEN";

export type LegacyReconciliationManualReviewReason =
  | "NON_HISTORICAL_RECORD_ID"
  | "MANUALLY_RESOLVED_STATUS"
  | "RECONCILED_BY_PRESENT"
  | "RECONCILED_AT_PRESENT"
  | "UNSUPPORTED_HISTORICAL_STATUS"
  | "MALFORMED_HISTORICAL_MATCHED_PAYLOAD"
  | "MALFORMED_HISTORICAL_MISSING_PAYLOAD"
  | "MALFORMED_HISTORICAL_MISMATCHED_PAYLOAD"
  | "HISTORICAL_MISMATCH_INTEGER_INVALID"
  | "HISTORICAL_MISMATCH_DISCREPANCY_INCONSISTENT";

export type LegacyReconciliationIdentityConflictReason =
  | "FINALIZATION_EFFECT_PRESENT"
  | "SOURCE_TYPE_MISMATCH"
  | "SOURCE_ID_MISMATCH"
  | "MATCHED_TRANSACTION_ID_MISMATCH";

export type LegacyReconciliationReasonCode =
  | LegacyReconciliationAutoAdoptableReason
  | LegacyReconciliationManualReviewReason
  | LegacyReconciliationIdentityConflictReason;

export type LegacyReconciliationClassification =
  | {
      readonly outcome: "AUTO_ADOPTABLE";
      readonly reason: LegacyReconciliationAutoAdoptableReason;
    }
  | {
      readonly outcome: "MANUAL_REVIEW_REQUIRED";
      readonly reason: LegacyReconciliationManualReviewReason;
    }
  | {
      readonly outcome: "IDENTITY_CONFLICT";
      readonly reason: LegacyReconciliationIdentityConflictReason;
    };

function identityConflict(
  reason: LegacyReconciliationIdentityConflictReason
): LegacyReconciliationClassification {
  return { outcome: "IDENTITY_CONFLICT", reason };
}

function manualReview(
  reason: LegacyReconciliationManualReviewReason
): LegacyReconciliationClassification {
  return { outcome: "MANUAL_REVIEW_REQUIRED", reason };
}

function autoAdoptable(
  reason: LegacyReconciliationAutoAdoptableReason
): LegacyReconciliationClassification {
  return { outcome: "AUTO_ADOPTABLE", reason };
}

function isPostgresqlInteger(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= 0 &&
    value <= POSTGRESQL_INTEGER_MAX
  );
}

function parseCanonicalPostgresqlInteger(value: string): number | null {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) return null;
  const parsed = Number(value);
  return isPostgresqlInteger(parsed) ? parsed : null;
}

export function classifyLegacyReconciliationRecord(
  record: ReconciliationRecord,
  expectedTransactionId: string
): LegacyReconciliationClassification {
  if (record.finalizationEffectId !== null) {
    return identityConflict("FINALIZATION_EFFECT_PRESENT");
  }
  if (record.sourceType !== "INTERNAL_TRANSACTION") {
    return identityConflict("SOURCE_TYPE_MISMATCH");
  }
  if (record.sourceId !== expectedTransactionId) {
    return identityConflict("SOURCE_ID_MISMATCH");
  }
  if (record.matchedTransactionId !== expectedTransactionId) {
    return identityConflict("MATCHED_TRANSACTION_ID_MISMATCH");
  }

  if (record.id !== "rec_" + expectedTransactionId) {
    return manualReview("NON_HISTORICAL_RECORD_ID");
  }
  if (record.status === "MANUALLY_RESOLVED") {
    return manualReview("MANUALLY_RESOLVED_STATUS");
  }
  if (record.reconciledBy !== null) {
    return manualReview("RECONCILED_BY_PRESENT");
  }
  if (record.reconciledAt !== null) {
    return manualReview("RECONCILED_AT_PRESENT");
  }

  if (record.status === "MATCHED") {
    if (
      record.discrepancyCentavos !== 0 ||
      record.discrepancyNotes !== LEGACY_MATCHED_NOTE
    ) {
      return manualReview("MALFORMED_HISTORICAL_MATCHED_PAYLOAD");
    }
    return autoAdoptable("HISTORICAL_MATCHED_PROVEN");
  }

  if (record.status === "MISSING") {
    if (
      record.discrepancyCentavos !== 0 ||
      record.discrepancyNotes !== LEGACY_MISSING_NOTE
    ) {
      return manualReview("MALFORMED_HISTORICAL_MISSING_PAYLOAD");
    }
    return autoAdoptable("HISTORICAL_MISSING_PROVEN");
  }

  if (record.status === "MISMATCHED") {
    if (record.discrepancyNotes === null) {
      return manualReview("MALFORMED_HISTORICAL_MISMATCHED_PAYLOAD");
    }
    const match = LEGACY_MISMATCH_PATTERN.exec(record.discrepancyNotes);
    if (!match || match[0] !== record.discrepancyNotes) {
      return manualReview("MALFORMED_HISTORICAL_MISMATCHED_PAYLOAD");
    }

    const expected = parseCanonicalPostgresqlInteger(match[1]);
    const got = parseCanonicalPostgresqlInteger(match[2]);
    if (
      expected === null ||
      got === null ||
      !isPostgresqlInteger(record.discrepancyCentavos)
    ) {
      return manualReview("HISTORICAL_MISMATCH_INTEGER_INVALID");
    }
    if (record.discrepancyCentavos !== Math.abs(got - expected)) {
      return manualReview("HISTORICAL_MISMATCH_DISCREPANCY_INCONSISTENT");
    }
    return autoAdoptable("HISTORICAL_MISMATCHED_PROVEN");
  }

  return manualReview("UNSUPPORTED_HISTORICAL_STATUS");
}
