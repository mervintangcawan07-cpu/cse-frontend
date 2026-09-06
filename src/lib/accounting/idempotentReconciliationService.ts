// Relative Path: src/lib/accounting/idempotentReconciliationService.ts
/**
 * Dormant internal payment-finalization reconciliation executor (P1-001 / Slice 6C).
 *
 * This service validates one persisted immutable RECONCILIATION effect, confirms
 * every preceding finalization effect is terminal, observes the resulting
 * internal financial/domain evidence, and creates/replays/updates only the
 * ReconciliationRecord for that finalization effect.
 *
 * It never repairs child financial state, never calls external providers, and
 * never mutates PaymentFinalization / PaymentFinalizationEffect lifecycle fields.
 */

import {
  Prisma,
  type FinancialLedgerEntry,
  type PartnerCommission,
  type PaymentFinalizationEffect,
  type ReconciliationRecord,
  type ReferralReward,
  type TaxRecord,
} from "@prisma/client";
import { prisma } from "../prisma";
import {
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
  validateIdentifier,
  validateIsoUtcTimestamp,
  validateTransactionId,
} from "../payment/paymentFinalizationContracts";
import { classifyLegacyReconciliationRecord } from "./legacyReconciliationClassifier";
import type { ReconciliationStatus } from "./types";

const POSTGRESQL_INTEGER_MAX = 2_147_483_647;
const SUPPORTED_INTENT_VERSION = 1;
const SUPPORTED_MANIFEST_VERSION = 1;
const SUPPORTED_MANIFEST_REVISION = 1;
const IDENTIFIER_MAX_LENGTH = 128;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const NOTES_MAX_LENGTH = 1_000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const RECONCILIATION_INTENT_KEYS = [
  "effectType",
  "expectedFeeCentavos",
  "expectedPaymentCentavos",
  "feeKnowledge",
  "intentVersion",
  "sourceType",
  "status",
] as const;

const PAYMENT_INTENT_KEYS = [
  "amountCentavos",
  "creditCategory",
  "debitCategory",
  "effectType",
  "intentVersion",
  "planType",
  "status",
  "userId",
] as const;

const FEE_INTENT_KEYS = [
  "creditCategory",
  "debitCategory",
  "effectType",
  "feeAmountCentavos",
  "feeKnowledge",
  "intentVersion",
  "status",
] as const;

const FEE_NOT_APPLICABLE_INTENT_KEYS = [
  ...FEE_INTENT_KEYS,
  "notApplicableReason",
].sort() as readonly string[];

const REFERRAL_INTENT_KEYS = [
  "currency",
  "effectType",
  "holdingPeriodDays",
  "holdingUntil",
  "intentVersion",
  "inviterId",
  "purchaseAmountCentavos",
  "referralId",
  "referredUserId",
  "rewardAmountCentavos",
  "rewardRateBasisPoints",
  "rewardType",
  "status",
] as const;

const REFERRAL_NOT_APPLICABLE_INTENT_KEYS = [
  ...REFERRAL_INTENT_KEYS,
  "notApplicableReason",
].sort() as readonly string[];

const PARTNER_COMMISSION_INTENT_KEYS = [
  "baseAmountCentavos",
  "calculationBasis",
  "campaignSource",
  "commissionAmountCentavos",
  "commissionModel",
  "commissionRateBasisPoints",
  "currency",
  "effectType",
  "holdingPeriodDays",
  "holdingUntil",
  "intentVersion",
  "partnerCode",
  "partnerId",
  "status",
] as const;

const PARTNER_COMMISSION_NOT_APPLICABLE_INTENT_KEYS = [
  ...PARTNER_COMMISSION_INTENT_KEYS,
  "notApplicableReason",
].sort() as readonly string[];

const PARTNER_LIABILITY_INTENT_KEYS = [
  "amountCentavos",
  "creditCategory",
  "debitCategory",
  "effectType",
  "intentVersion",
  "partnerId",
  "status",
] as const;

const PARTNER_LIABILITY_NOT_APPLICABLE_INTENT_KEYS = [
  ...PARTNER_LIABILITY_INTENT_KEYS,
  "notApplicableReason",
].sort() as readonly string[];

const TAX_INTENT_KEYS = [
  "calculationBasis",
  "creditCategory",
  "debitCategory",
  "effectType",
  "intentVersion",
  "status",
  "taxAmountCentavos",
  "taxConfigId",
  "taxName",
  "taxRateBasisPoints",
  "taxType",
  "taxableAmountCentavos",
] as const;

const TAX_NOT_APPLICABLE_INTENT_KEYS = [
  ...TAX_INTENT_KEYS,
  "notApplicableReason",
].sort() as readonly string[];

const SUPPORTED_PLAN_TYPES = ["1_MONTH", "6_MONTHS", "1_YEAR"] as const;
const V1_TAX_TYPES = [
  "VAT",
  "PERCENTAGE_TAX",
  "WITHHOLDING_TAX",
  "OTHER_TAX",
] as const;
const V1_TAX_BASES = ["CUSTOMER_PAYMENT", "GROSS_SALE"] as const;
const V1_ACTIVE_PARTNER_MODELS = [
  "PERCENTAGE_OF_CUSTOMER_PAYMENT",
  "PERCENTAGE_OF_GROSS",
  "FIXED_PER_PURCHASE",
] as const;
const PERSISTED_PARTNER_MODELS = [
  "PERCENTAGE_OF_GROSS",
  "PERCENTAGE_OF_CUSTOMER_PAYMENT",
  "PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS",
  "FIXED_PER_PURCHASE",
  "FIXED_PER_REFERRAL",
  "CUSTOM_RULE",
] as const;

export interface ExecuteReconciliationEffectParams {
  readonly transactionId: string;
  readonly reconciliationEffectId: string;
  readonly tx?: Prisma.TransactionClient;
}

export type ExecuteReconciliationEffectResult =
  | {
      readonly outcome: "MATCHED";
      readonly record: ReconciliationRecord;
      readonly isReplay: boolean;
    }
  | {
      readonly outcome: "DISCREPANCY";
      readonly record: ReconciliationRecord;
      readonly status: Extract<ReconciliationStatus, "MISSING" | "MISMATCHED" | "DUPLICATE">;
      readonly isReplay: boolean;
    }
  | {
      readonly outcome: "MANUALLY_RESOLVED";
      readonly record: ReconciliationRecord;
      readonly isReplay: true;
    };

export type ReconciliationExecutionErrorCode =
  | "EFFECT_NOT_FOUND"
  | "WRONG_EFFECT_TYPE"
  | "UNSUPPORTED_INTENT_VERSION"
  | "INTENT_HASH_MISMATCH"
  | "MANIFEST_LINKAGE_MISMATCH"
  | "TRANSACTION_IDENTITY_MISMATCH"
  | "INVALID_IMMUTABLE_INTENT"
  | "INVALID_LIFECYCLE"
  | "PREREQUISITE_NOT_TERMINAL"
  | "SIBLING_INTENT_INVALID"
  | "RECONCILIATION_IDENTITY_CONFLICT"
  | "LEGACY_RECONCILIATION_REQUIRES_CLASSIFICATION"
  | "CONCURRENT_IDENTITY_CONFLICT"
  | "DATABASE_EXECUTION_FAILED";

export class ReconciliationExecutionError extends Error {
  public readonly code: ReconciliationExecutionErrorCode;

  constructor(code: ReconciliationExecutionErrorCode, message: string) {
    super(message);
    this.name = "ReconciliationExecutionError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type LoadedReconciliationEffect = Prisma.PaymentFinalizationEffectGetPayload<{
  include: {
    finalization: {
      include: {
        transaction: true;
      };
    };
  };
}>;

interface ParsedReconciliationIntent {
  readonly effectType: "RECONCILIATION";
  readonly intentVersion: 1;
  readonly status: "PENDING";
  readonly expectedPaymentCentavos: number;
  readonly expectedFeeCentavos: number | null;
  readonly feeKnowledge: "UNKNOWN" | "KNOWN";
  readonly sourceType: "INTERNAL_TRANSACTION";
}

interface ParsedPaymentIntent {
  readonly kind: "PAYMENT";
  readonly status: "PENDING";
  readonly amountCentavos: number;
  readonly userId: string;
  readonly planType: "1_MONTH" | "6_MONTHS" | "1_YEAR";
}

interface ParsedFeeIntent {
  readonly kind: "FEE";
  readonly status: "PENDING" | "AWAITING_DATA" | "NOT_APPLICABLE";
  readonly feeKnowledge: "UNKNOWN" | "KNOWN";
  readonly feeAmountCentavos: number | null;
  readonly notApplicableReason: "ZERO_PROVIDER_FEE" | null;
}

interface ParsedReferralIntent {
  readonly kind: "REFERRAL";
  readonly status: "PENDING" | "NOT_APPLICABLE";
  readonly notApplicableReason:
    | "NO_REFERRAL_ATTRIBUTION"
    | "PROGRAM_DISABLED"
    | "ZERO_REWARD_CALCULATED"
    | "REFERRAL_ALREADY_REWARDED"
    | null;
  readonly referralId: string | null;
  readonly inviterId: string | null;
  readonly referredUserId: string;
  readonly purchaseAmountCentavos: number;
  readonly rewardType: "PERCENTAGE" | "FIXED" | null;
  readonly rewardRateBasisPoints: number | null;
  readonly rewardAmountCentavos: number;
  readonly holdingPeriodDays: number | null;
  readonly holdingUntil: string | null;
}

interface ParsedPartnerCommissionIntent {
  readonly kind: "PARTNER_COMMISSION";
  readonly status: "PENDING" | "NOT_APPLICABLE";
  readonly notApplicableReason:
    | "NO_PARTNER_ATTRIBUTION"
    | "INACTIVE_PARTNER"
    | "ZERO_COMMISSION_CALCULATED"
    | null;
  readonly partnerId: string | null;
  readonly partnerCode: string | null;
  readonly commissionModel:
    | "PERCENTAGE_OF_GROSS"
    | "PERCENTAGE_OF_CUSTOMER_PAYMENT"
    | "PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS"
    | "FIXED_PER_PURCHASE"
    | "FIXED_PER_REFERRAL"
    | "CUSTOM_RULE"
    | null;
  readonly commissionRateBasisPoints: number | null;
  readonly calculationBasis: "CUSTOMER_PAYMENT" | "GROSS_PRICE" | "FIXED_AMOUNT" | null;
  readonly baseAmountCentavos: number | null;
  readonly commissionAmountCentavos: number;
  readonly campaignSource: string | null;
  readonly holdingPeriodDays: number | null;
  readonly holdingUntil: string | null;
}

interface ParsedPartnerLiabilityIntent {
  readonly kind: "PARTNER_LIABILITY";
  readonly status: "PENDING" | "NOT_APPLICABLE";
  readonly notApplicableReason: "NO_PARTNER_COMMISSION" | null;
  readonly partnerId: string | null;
  readonly amountCentavos: number;
}

interface ParsedTaxIntent {
  readonly kind: "TAX";
  readonly status: "PENDING" | "NOT_APPLICABLE";
  readonly notApplicableReason: "NO_ACTIVE_TAX_RULES" | "ZERO_TAX_CALCULATED" | null;
  readonly taxConfigId: string | null;
  readonly taxName: string | null;
  readonly taxType: "VAT" | "PERCENTAGE_TAX" | "WITHHOLDING_TAX" | "OTHER_TAX" | null;
  readonly calculationBasis: "CUSTOMER_PAYMENT" | "GROSS_SALE" | null;
  readonly taxableAmountCentavos: number;
  readonly taxRateBasisPoints: number | null;
  readonly taxAmountCentavos: number;
}

type ParsedSiblingIntent =
  | ParsedPaymentIntent
  | ParsedFeeIntent
  | ParsedReferralIntent
  | ParsedPartnerCommissionIntent
  | ParsedPartnerLiabilityIntent
  | ParsedTaxIntent;

type ReconciliationIdentity =
  | { readonly kind: "NONE" }
  | { readonly kind: "EXACT"; readonly record: ReconciliationRecord }
  | { readonly kind: "LEGACY"; readonly record: ReconciliationRecord }
  | { readonly kind: "DUPLICATE" }
  | { readonly kind: "CONFLICT" };

type IssueSeverity = "MISSING" | "MISMATCHED" | "DUPLICATE";

type IssueDomain =
  | "PAYMENT"
  | "FEE"
  | "TAX"
  | "PARTNER_LIABILITY"
  | "REFERRAL"
  | "PARTNER_COMMISSION"
  | "OTHER";

interface ReconciliationIssue {
  readonly severity: IssueSeverity;
  readonly domain: IssueDomain;
  readonly token: string;
  readonly discrepancyCentavos: number;
}

interface EvaluationResult {
  readonly status: Extract<ReconciliationStatus, "MATCHED" | "MISSING" | "MISMATCHED" | "DUPLICATE">;
  readonly discrepancyCentavos: number;
  readonly discrepancyNotes: string;
}

interface ExactPartnerEvidence {
  readonly commissionEffectId: string;
  readonly commission: PartnerCommission;
}

interface ExactTaxEvidence {
  readonly taxEffectId: string;
  readonly taxRecord: TaxRecord;
}

interface LedgerReadState {
  readonly byOperation: readonly FinancialLedgerEntry[];
  readonly byEffect: readonly FinancialLedgerEntry[];
}

function fail(code: ReconciliationExecutionErrorCode, message: string): never {
  throw new ReconciliationExecutionError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  errorCode: ReconciliationExecutionErrorCode = "INVALID_IMMUTABLE_INTENT"
): void {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(errorCode, "Persisted intent does not match the exact supported v1 shape.");
  }
}

function requireInputTransactionIdentifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > IDENTIFIER_MAX_LENGTH ||
    value !== value.trim()
  ) {
    fail(
      "TRANSACTION_IDENTITY_MISMATCH",
      "The requested transactionId is not an exact canonical identifier."
    );
  }

  try {
    const validated = validateTransactionId(value);
    if (validated !== value) throw new Error("non-canonical");
    return validated;
  } catch {
    fail(
      "TRANSACTION_IDENTITY_MISMATCH",
      "The requested transactionId is not an exact canonical identifier."
    );
  }
}

function requireInputEffectIdentifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > IDENTIFIER_MAX_LENGTH ||
    value !== value.trim()
  ) {
    fail("EFFECT_NOT_FOUND", "The requested reconciliation effect was not found.");
  }

  try {
    const validated = validateIdentifier(value, "reconciliationEffectId");
    if (validated !== value) throw new Error("non-canonical");
    return validated;
  } catch {
    fail("EFFECT_NOT_FOUND", "The requested reconciliation effect was not found.");
  }
}

function requireExactIdentifier(
  value: unknown,
  fieldName: string,
  errorCode: ReconciliationExecutionErrorCode = "SIBLING_INTENT_INVALID"
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > IDENTIFIER_MAX_LENGTH ||
    value !== value.trim()
  ) {
    fail(errorCode, `${fieldName} is not an exact persisted identifier.`);
  }
  return value;
}

function requirePositivePostgresInteger(
  value: unknown,
  fieldName: string,
  errorCode: ReconciliationExecutionErrorCode
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > POSTGRESQL_INTEGER_MAX
  ) {
    fail(errorCode, `${fieldName} is not a positive PostgreSQL-compatible integer.`);
  }
  return value;
}

function requireNonNegativePostgresInteger(
  value: unknown,
  fieldName: string,
  errorCode: ReconciliationExecutionErrorCode
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > POSTGRESQL_INTEGER_MAX
  ) {
    fail(errorCode, `${fieldName} is not a nonnegative PostgreSQL-compatible integer.`);
  }
  return value;
}

function requireNonNegativeSafeInteger(
  value: unknown,
  fieldName: string,
  errorCode: ReconciliationExecutionErrorCode
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    fail(errorCode, `${fieldName} must be a nonnegative safe integer.`);
  }
  return value;
}

function requireBasisPoints(
  value: unknown,
  fieldName: string,
  allowNull: boolean,
  errorCode: ReconciliationExecutionErrorCode
): number | null {
  if (value === null && allowNull) return null;
  const bps = requireNonNegativeSafeInteger(value, fieldName, errorCode);
  if (bps > 10_000) {
    fail(errorCode, `${fieldName} exceeds 10000 basis points.`);
  }
  return bps;
}

function requireCanonicalIso(
  value: unknown,
  fieldName: string,
  errorCode: ReconciliationExecutionErrorCode
): string {
  if (typeof value !== "string") {
    fail(errorCode, `${fieldName} must be an ISO UTC timestamp string.`);
  }
  try {
    const normalized = validateIsoUtcTimestamp(value, fieldName, false);
    if (normalized === null || normalized !== value) throw new Error("non-canonical");
    return normalized;
  } catch {
    fail(errorCode, `${fieldName} must be an exact canonical ISO UTC timestamp.`);
  }
}

function validatePersistedHash(
  intent: unknown,
  intentHash: unknown,
  errorCode: ReconciliationExecutionErrorCode
): void {
  if (typeof intentHash !== "string" || !HASH_PATTERN.test(intentHash)) {
    fail(errorCode, "Persisted intent hash is not a lowercase SHA-256 value.");
  }
  let canonical: string;
  try {
    canonical = canonicalizeJson(intent);
  } catch {
    fail(errorCode, "Persisted intent cannot be canonically serialized.");
  }
  if (computeSha256Hash(canonical) !== intentHash) {
    fail(errorCode, "Persisted intent hash does not match its canonical payload.");
  }
}

function parseReconciliationIntent(
  effect: LoadedReconciliationEffect
): ParsedReconciliationIntent {
  if (effect.effectType !== "RECONCILIATION") {
    fail("WRONG_EFFECT_TYPE", "The requested effect is not RECONCILIATION.");
  }
  if (!isRecord(effect.intent)) {
    fail("INVALID_IMMUTABLE_INTENT", "Persisted reconciliation intent must be a JSON object.");
  }

  validatePersistedHash(effect.intent, effect.intentHash, "INTENT_HASH_MISMATCH");

  if (
    effect.intentVersion !== SUPPORTED_INTENT_VERSION ||
    effect.intent.intentVersion !== SUPPORTED_INTENT_VERSION ||
    effect.intentVersion !== effect.intent.intentVersion
  ) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      "Persisted reconciliation effect uses an unsupported intent version."
    );
  }

  requireExactKeys(effect.intent, RECONCILIATION_INTENT_KEYS);

  if (
    effect.intent.effectType !== "RECONCILIATION" ||
    effect.intent.status !== "PENDING" ||
    effect.intent.sourceType !== "INTERNAL_TRANSACTION"
  ) {
    fail("INVALID_IMMUTABLE_INTENT", "Persisted reconciliation intent is invalid.");
  }

  const expectedPaymentCentavos = requirePositivePostgresInteger(
    effect.intent.expectedPaymentCentavos,
    "expectedPaymentCentavos",
    "INVALID_IMMUTABLE_INTENT"
  );

  const feeKnowledge = effect.intent.feeKnowledge;
  if (feeKnowledge !== "UNKNOWN" && feeKnowledge !== "KNOWN") {
    fail("INVALID_IMMUTABLE_INTENT", "feeKnowledge is outside the closed v1 set.");
  }

  let expectedFeeCentavos: number | null = null;
  if (feeKnowledge === "UNKNOWN") {
    if (effect.intent.expectedFeeCentavos !== null) {
      fail("INVALID_IMMUTABLE_INTENT", "UNKNOWN fee knowledge requires a null expected fee.");
    }
  } else {
    expectedFeeCentavos = requireNonNegativePostgresInteger(
      effect.intent.expectedFeeCentavos,
      "expectedFeeCentavos",
      "INVALID_IMMUTABLE_INTENT"
    );
  }

  return {
    effectType: "RECONCILIATION",
    intentVersion: 1,
    status: "PENDING",
    expectedPaymentCentavos,
    expectedFeeCentavos,
    feeKnowledge,
    sourceType: "INTERNAL_TRANSACTION",
  };
}

function validateReconciliationEffectAndParent(
  effect: LoadedReconciliationEffect,
  intent: ParsedReconciliationIntent,
  transactionId: string
): { readonly replayOnly: boolean } {
  if (effect.effectKey !== "reconciliation") {
    fail("MANIFEST_LINKAGE_MISMATCH", "Reconciliation effectKey is invalid.");
  }

  const finalization = effect.finalization;
  if (!finalization || !finalization.transaction) {
    fail("MANIFEST_LINKAGE_MISMATCH", "Reconciliation effect has incomplete parent linkage.");
  }

  if (
    finalization.manifestVersion !== SUPPORTED_MANIFEST_VERSION ||
    finalization.manifestRevision !== SUPPORTED_MANIFEST_REVISION ||
    typeof finalization.manifestHash !== "string" ||
    !HASH_PATTERN.test(finalization.manifestHash) ||
    finalization.currency !== "PHP"
  ) {
    fail("MANIFEST_LINKAGE_MISMATCH", "Payment finalization manifest linkage is invalid.");
  }

  if (
    finalization.transactionId !== transactionId ||
    finalization.transaction.id !== transactionId
  ) {
    fail(
      "TRANSACTION_IDENTITY_MISMATCH",
      "Payment finalization transaction identity does not match the request."
    );
  }

  const expectedOperationKey = buildPaymentFinalizationOperationKey(transactionId, {
    kind: "RECONCILIATION",
  });
  if (effect.operationKey !== expectedOperationKey) {
    fail("MANIFEST_LINKAGE_MISMATCH", "Reconciliation operationKey is invalid.");
  }

  if (
    effect.referralId !== null ||
    effect.partnerId !== null ||
    effect.taxConfigId !== null
  ) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Reconciliation effect contains foreign domain identity columns."
    );
  }

  if (finalization.purchaseAmountCentavos !== intent.expectedPaymentCentavos) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Reconciliation expected payment does not match the finalization snapshot."
    );
  }

  if (finalization.feeKnowledge !== intent.feeKnowledge) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Reconciliation fee knowledge does not match the finalization snapshot."
    );
  }

  if (intent.feeKnowledge === "UNKNOWN") {
    if (
      intent.expectedFeeCentavos !== null ||
      finalization.feeAmountCentavos !== null
    ) {
      fail(
        "MANIFEST_LINKAGE_MISMATCH",
        "Unknown fee reconciliation state disagrees with the finalization snapshot."
      );
    }
  } else if (finalization.feeAmountCentavos !== intent.expectedFeeCentavos) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Known fee reconciliation amount disagrees with the finalization snapshot."
    );
  }

  if (finalization.status === "MANUAL_REVIEW") {
    fail("INVALID_LIFECYCLE", "Payment finalization is in manual review.");
  }

  if (
    effect.status === "AWAITING_DATA" ||
    effect.status === "NOT_APPLICABLE" ||
    effect.status === "MANUAL_REVIEW"
  ) {
    fail("INVALID_LIFECYCLE", "Reconciliation effect lifecycle is invalid.");
  }

  if (
    effect.status !== "PENDING" &&
    effect.status !== "FAILED_RETRYABLE" &&
    effect.status !== "COMPLETE"
  ) {
    fail("INVALID_LIFECYCLE", "Reconciliation effect lifecycle is unsupported.");
  }

  return {
    replayOnly: effect.status === "COMPLETE" || finalization.status === "COMPLETE",
  };
}

function ensureSiblingHashAndVersion(effect: PaymentFinalizationEffect): Record<string, unknown> {
  if (!isRecord(effect.intent)) {
    fail("SIBLING_INTENT_INVALID", "Sibling intent must be a JSON object.");
  }
  validatePersistedHash(effect.intent, effect.intentHash, "SIBLING_INTENT_INVALID");
  if (
    effect.intentVersion !== SUPPORTED_INTENT_VERSION ||
    effect.intent.intentVersion !== SUPPORTED_INTENT_VERSION ||
    effect.intentVersion !== effect.intent.intentVersion
  ) {
    fail("SIBLING_INTENT_INVALID", "Sibling effect uses an unsupported intent version.");
  }
  return effect.intent;
}

function parsePaymentSibling(
  effect: PaymentFinalizationEffect,
  raw: Record<string, unknown>,
  parent: LoadedReconciliationEffect["finalization"]
): ParsedPaymentIntent {
  requireExactKeys(raw, PAYMENT_INTENT_KEYS, "SIBLING_INTENT_INVALID");
  if (
    raw.effectType !== "PAYMENT_LEDGER" ||
    raw.intentVersion !== 1 ||
    raw.status !== "PENDING" ||
    raw.debitCategory !== "CASH_PAYMONGO" ||
    raw.creditCategory !== "REVENUE_PREMIUM"
  ) {
    fail("SIBLING_INTENT_INVALID", "Payment ledger sibling intent is invalid.");
  }

  const amountCentavos = requirePositivePostgresInteger(
    raw.amountCentavos,
    "payment.amountCentavos",
    "SIBLING_INTENT_INVALID"
  );
  const userId = requireExactIdentifier(raw.userId, "payment.userId");
  if (
    typeof raw.planType !== "string" ||
    !SUPPORTED_PLAN_TYPES.some((plan) => plan === raw.planType)
  ) {
    fail("SIBLING_INTENT_INVALID", "Payment planType is outside the closed v1 set.");
  }
  const planType = raw.planType as (typeof SUPPORTED_PLAN_TYPES)[number];

  if (
    amountCentavos !== parent.purchaseAmountCentavos ||
    userId !== parent.transaction.userId ||
    planType !== parent.planType ||
    effect.effectKey !== "payment" ||
    effect.operationKey !==
      buildPaymentFinalizationOperationKey(parent.transactionId, { kind: "PAYMENT" }) ||
    effect.referralId !== null ||
    effect.partnerId !== null ||
    effect.taxConfigId !== null
  ) {
    fail("SIBLING_INTENT_INVALID", "Payment ledger sibling linkage is inconsistent.");
  }

  return { kind: "PAYMENT", status: "PENDING", amountCentavos, userId, planType };
}

function parseFeeSibling(
  effect: PaymentFinalizationEffect,
  raw: Record<string, unknown>,
  parent: LoadedReconciliationEffect["finalization"]
): ParsedFeeIntent {
  const rawStatus = raw.status;
  if (rawStatus === "NOT_APPLICABLE") {
    requireExactKeys(raw, FEE_NOT_APPLICABLE_INTENT_KEYS, "SIBLING_INTENT_INVALID");
  } else {
    requireExactKeys(raw, FEE_INTENT_KEYS, "SIBLING_INTENT_INVALID");
  }

  if (
    raw.effectType !== "PROVIDER_FEE_LEDGER" ||
    raw.intentVersion !== 1 ||
    effect.effectKey !== "fee" ||
    effect.operationKey !==
      buildPaymentFinalizationOperationKey(parent.transactionId, { kind: "FEE" }) ||
    effect.referralId !== null ||
    effect.partnerId !== null ||
    effect.taxConfigId !== null
  ) {
    fail("SIBLING_INTENT_INVALID", "Provider fee sibling linkage is inconsistent.");
  }

  if (rawStatus === "AWAITING_DATA") {
    if (
      raw.feeKnowledge !== "UNKNOWN" ||
      raw.feeAmountCentavos !== null ||
      raw.debitCategory !== null ||
      raw.creditCategory !== null ||
      parent.feeKnowledge !== "UNKNOWN" ||
      parent.feeAmountCentavos !== null
    ) {
      fail("SIBLING_INTENT_INVALID", "Awaiting-data provider fee intent is invalid.");
    }
    return {
      kind: "FEE",
      status: "AWAITING_DATA",
      feeKnowledge: "UNKNOWN",
      feeAmountCentavos: null,
      notApplicableReason: null,
    };
  }

  if (rawStatus === "NOT_APPLICABLE") {
    if (
      raw.feeKnowledge !== "KNOWN" ||
      raw.feeAmountCentavos !== 0 ||
      raw.notApplicableReason !== "ZERO_PROVIDER_FEE" ||
      raw.debitCategory !== null ||
      raw.creditCategory !== null ||
      parent.feeKnowledge !== "KNOWN" ||
      parent.feeAmountCentavos !== 0
    ) {
      fail("SIBLING_INTENT_INVALID", "Not-applicable provider fee intent is invalid.");
    }
    return {
      kind: "FEE",
      status: "NOT_APPLICABLE",
      feeKnowledge: "KNOWN",
      feeAmountCentavos: 0,
      notApplicableReason: "ZERO_PROVIDER_FEE",
    };
  }

  if (rawStatus !== "PENDING") {
    fail("SIBLING_INTENT_INVALID", "Provider fee intent has an unsupported status.");
  }

  const feeAmountCentavos = requirePositivePostgresInteger(
    raw.feeAmountCentavos,
    "fee.feeAmountCentavos",
    "SIBLING_INTENT_INVALID"
  );
  if (
    raw.feeKnowledge !== "KNOWN" ||
    raw.debitCategory !== "EXPENSE_PAYMENT_FEE" ||
    raw.creditCategory !== "CASH_PAYMONGO" ||
    parent.feeKnowledge !== "KNOWN" ||
    parent.feeAmountCentavos !== feeAmountCentavos
  ) {
    fail("SIBLING_INTENT_INVALID", "Active provider fee intent is invalid.");
  }

  return {
    kind: "FEE",
    status: "PENDING",
    feeKnowledge: "KNOWN",
    feeAmountCentavos,
    notApplicableReason: null,
  };
}

function parseReferralSibling(
  effect: PaymentFinalizationEffect,
  raw: Record<string, unknown>,
  parent: LoadedReconciliationEffect["finalization"]
): ParsedReferralIntent {
  const status = raw.status;
  if (status === "NOT_APPLICABLE") {
    requireExactKeys(raw, REFERRAL_NOT_APPLICABLE_INTENT_KEYS, "SIBLING_INTENT_INVALID");
  } else {
    requireExactKeys(raw, REFERRAL_INTENT_KEYS, "SIBLING_INTENT_INVALID");
  }

  if (
    raw.effectType !== "REFERRAL_REWARD" ||
    raw.intentVersion !== 1 ||
    raw.currency !== "PHP" ||
    effect.effectKey !== "referral" ||
    effect.operationKey !==
      buildPaymentFinalizationOperationKey(parent.transactionId, { kind: "REFERRAL" }) ||
    effect.partnerId !== null ||
    effect.taxConfigId !== null
  ) {
    fail("SIBLING_INTENT_INVALID", "Referral sibling linkage is inconsistent.");
  }

  const referredUserId = requireExactIdentifier(raw.referredUserId, "referral.referredUserId");
  const purchaseAmountCentavos = requirePositivePostgresInteger(
    raw.purchaseAmountCentavos,
    "referral.purchaseAmountCentavos",
    "SIBLING_INTENT_INVALID"
  );
  if (
    referredUserId !== parent.transaction.userId ||
    purchaseAmountCentavos !== parent.purchaseAmountCentavos
  ) {
    fail("SIBLING_INTENT_INVALID", "Referral sibling transaction linkage is inconsistent.");
  }

  if (status === "PENDING") {
    const referralId = requireExactIdentifier(raw.referralId, "referral.referralId");
    const inviterId = requireExactIdentifier(raw.inviterId, "referral.inviterId");
    if (effect.referralId !== referralId) {
      fail("SIBLING_INTENT_INVALID", "Referral effect identity column is inconsistent.");
    }
    if (raw.rewardType !== "PERCENTAGE" && raw.rewardType !== "FIXED") {
      fail("SIBLING_INTENT_INVALID", "Referral rewardType is unsupported.");
    }
    const rewardRateBasisPointsValue = requireBasisPoints(
      raw.rewardRateBasisPoints,
      "referral.rewardRateBasisPoints",
      false,
      "SIBLING_INTENT_INVALID"
    );
    if (rewardRateBasisPointsValue === null) {
      fail("SIBLING_INTENT_INVALID", "Referral reward basis points are required.");
    }
    const rewardRateBasisPoints = rewardRateBasisPointsValue;
    const rewardAmountCentavos = requirePositivePostgresInteger(
      raw.rewardAmountCentavos,
      "referral.rewardAmountCentavos",
      "SIBLING_INTENT_INVALID"
    );
    const holdingPeriodDays = requireNonNegativeSafeInteger(
      raw.holdingPeriodDays,
      "referral.holdingPeriodDays",
      "SIBLING_INTENT_INVALID"
    );
    const holdingUntil = requireCanonicalIso(
      raw.holdingUntil,
      "referral.holdingUntil",
      "SIBLING_INTENT_INVALID"
    );

    if (raw.rewardType === "FIXED" && rewardRateBasisPoints !== 0) {
      fail("SIBLING_INTENT_INVALID", "Fixed referral reward must use zero basis points.");
    }
    if (raw.rewardType === "PERCENTAGE") {
      const expected = Math.round(
        (purchaseAmountCentavos * (rewardRateBasisPoints / 100)) / 100
      );
      if (expected !== rewardAmountCentavos) {
        fail("SIBLING_INTENT_INVALID", "Referral percentage arithmetic is inconsistent.");
      }
    }

    const holdingExpected =
      parent.verifiedAt.getTime() + holdingPeriodDays * MILLISECONDS_PER_DAY;
    if (
      !Number.isSafeInteger(holdingExpected) ||
      new Date(holdingExpected).toISOString() !== holdingUntil
    ) {
      fail("SIBLING_INTENT_INVALID", "Referral holding timestamp is inconsistent.");
    }

    return {
      kind: "REFERRAL",
      status: "PENDING",
      notApplicableReason: null,
      referralId,
      inviterId,
      referredUserId,
      purchaseAmountCentavos,
      rewardType: raw.rewardType,
      rewardRateBasisPoints,
      rewardAmountCentavos,
      holdingPeriodDays,
      holdingUntil,
    };
  }

  if (status !== "NOT_APPLICABLE") {
    fail("SIBLING_INTENT_INVALID", "Referral intent has an unsupported status.");
  }

  if (
    raw.notApplicableReason !== "NO_REFERRAL_ATTRIBUTION" &&
    raw.notApplicableReason !== "PROGRAM_DISABLED" &&
    raw.notApplicableReason !== "ZERO_REWARD_CALCULATED" &&
    raw.notApplicableReason !== "REFERRAL_ALREADY_REWARDED"
  ) {
    fail("SIBLING_INTENT_INVALID", "Referral not-applicable reason is unsupported.");
  }
  if (raw.rewardAmountCentavos !== 0 || raw.holdingUntil !== null) {
    fail("SIBLING_INTENT_INVALID", "Not-applicable referral amount/timestamp is invalid.");
  }

  if (raw.notApplicableReason === "NO_REFERRAL_ATTRIBUTION") {
    if (
      raw.referralId !== null ||
      raw.inviterId !== null ||
      raw.rewardType !== null ||
      raw.rewardRateBasisPoints !== null ||
      raw.holdingPeriodDays !== null ||
      effect.referralId !== null
    ) {
      fail("SIBLING_INTENT_INVALID", "No-attribution referral identities are invalid.");
    }
    return {
      kind: "REFERRAL",
      status: "NOT_APPLICABLE",
      notApplicableReason: "NO_REFERRAL_ATTRIBUTION",
      referralId: null,
      inviterId: null,
      referredUserId,
      purchaseAmountCentavos,
      rewardType: null,
      rewardRateBasisPoints: null,
      rewardAmountCentavos: 0,
      holdingPeriodDays: null,
      holdingUntil: null,
    };
  }

  const referralId = requireExactIdentifier(raw.referralId, "referral.referralId");
  const inviterId = requireExactIdentifier(raw.inviterId, "referral.inviterId");
  if (effect.referralId !== referralId) {
    fail("SIBLING_INTENT_INVALID", "Referral effect identity column is inconsistent.");
  }
  if (raw.rewardType !== "PERCENTAGE" && raw.rewardType !== "FIXED") {
    fail("SIBLING_INTENT_INVALID", "Referral rewardType is unsupported.");
  }
  const rewardRateBasisPointsValue = requireBasisPoints(
    raw.rewardRateBasisPoints,
    "referral.rewardRateBasisPoints",
    false,
    "SIBLING_INTENT_INVALID"
  );
  if (rewardRateBasisPointsValue === null) {
    fail("SIBLING_INTENT_INVALID", "Referral reward basis points are required.");
  }
  const rewardRateBasisPoints = rewardRateBasisPointsValue;
  const holdingPeriodDays = requireNonNegativeSafeInteger(
    raw.holdingPeriodDays,
    "referral.holdingPeriodDays",
    "SIBLING_INTENT_INVALID"
  );
  if (raw.rewardType === "FIXED" && rewardRateBasisPoints !== 0) {
    fail("SIBLING_INTENT_INVALID", "Fixed referral reward must use zero basis points.");
  }
  if (
    raw.notApplicableReason === "ZERO_REWARD_CALCULATED" &&
    raw.rewardType === "PERCENTAGE"
  ) {
    const expected = Math.round(
      (purchaseAmountCentavos * (rewardRateBasisPoints / 100)) / 100
    );
    if (expected !== 0) {
      fail("SIBLING_INTENT_INVALID", "Zero referral reward arithmetic is inconsistent.");
    }
  }

  return {
    kind: "REFERRAL",
    status: "NOT_APPLICABLE",
    notApplicableReason: raw.notApplicableReason,
    referralId,
    inviterId,
    referredUserId,
    purchaseAmountCentavos,
    rewardType: raw.rewardType,
    rewardRateBasisPoints,
    rewardAmountCentavos: 0,
    holdingPeriodDays,
    holdingUntil: null,
  };
}

function parsePartnerCommissionSibling(
  effect: PaymentFinalizationEffect,
  raw: Record<string, unknown>,
  parent: LoadedReconciliationEffect["finalization"]
): ParsedPartnerCommissionIntent {
  const status = raw.status;
  if (status === "NOT_APPLICABLE") {
    requireExactKeys(
      raw,
      PARTNER_COMMISSION_NOT_APPLICABLE_INTENT_KEYS,
      "SIBLING_INTENT_INVALID"
    );
  } else {
    requireExactKeys(raw, PARTNER_COMMISSION_INTENT_KEYS, "SIBLING_INTENT_INVALID");
  }

  if (
    raw.effectType !== "PARTNER_COMMISSION" ||
    raw.intentVersion !== 1 ||
    raw.currency !== "PHP" ||
    effect.effectKey !== "partner-commission" ||
    effect.operationKey !==
      buildPaymentFinalizationOperationKey(parent.transactionId, {
        kind: "PARTNER_COMMISSION",
      }) ||
    effect.referralId !== null ||
    effect.taxConfigId !== null
  ) {
    fail("SIBLING_INTENT_INVALID", "Partner commission sibling linkage is inconsistent.");
  }

  const campaignSource =
    raw.campaignSource === null || typeof raw.campaignSource === "string"
      ? raw.campaignSource
      : fail("SIBLING_INTENT_INVALID", "Partner campaignSource must be string or null.");

  if (status === "PENDING") {
    const partnerId = requireExactIdentifier(raw.partnerId, "partner.partnerId");
    const partnerCode = requireExactIdentifier(raw.partnerCode, "partner.partnerCode");
    if (effect.partnerId !== partnerId) {
      fail("SIBLING_INTENT_INVALID", "Partner effect identity column is inconsistent.");
    }
    if (
      typeof raw.commissionModel !== "string" ||
      !V1_ACTIVE_PARTNER_MODELS.some((model) => model === raw.commissionModel)
    ) {
      fail("SIBLING_INTENT_INVALID", "Active partner commission model is unsupported.");
    }
    const commissionModel = raw.commissionModel as (typeof V1_ACTIVE_PARTNER_MODELS)[number];
    const commissionRateBasisPointsValue = requireBasisPoints(
      raw.commissionRateBasisPoints,
      "partner.commissionRateBasisPoints",
      false,
      "SIBLING_INTENT_INVALID"
    );
    if (commissionRateBasisPointsValue === null) {
      fail("SIBLING_INTENT_INVALID", "Partner commission basis points are required.");
    }
    const commissionRateBasisPoints = commissionRateBasisPointsValue;
    const commissionAmountCentavos = requirePositivePostgresInteger(
      raw.commissionAmountCentavos,
      "partner.commissionAmountCentavos",
      "SIBLING_INTENT_INVALID"
    );
    const holdingPeriodDays = requireNonNegativeSafeInteger(
      raw.holdingPeriodDays,
      "partner.holdingPeriodDays",
      "SIBLING_INTENT_INVALID"
    );
    const holdingUntil = requireCanonicalIso(
      raw.holdingUntil,
      "partner.holdingUntil",
      "SIBLING_INTENT_INVALID"
    );

    let calculationBasis: "CUSTOMER_PAYMENT" | "GROSS_PRICE" | "FIXED_AMOUNT";
    let baseAmountCentavos: number | null;
    if (commissionModel === "PERCENTAGE_OF_CUSTOMER_PAYMENT") {
      if (raw.calculationBasis !== "CUSTOMER_PAYMENT") {
        fail("SIBLING_INTENT_INVALID", "Customer-payment partner basis is inconsistent.");
      }
      calculationBasis = "CUSTOMER_PAYMENT";
      baseAmountCentavos = requirePositivePostgresInteger(
        raw.baseAmountCentavos,
        "partner.baseAmountCentavos",
        "SIBLING_INTENT_INVALID"
      );
      if (baseAmountCentavos !== parent.purchaseAmountCentavos) {
        fail("SIBLING_INTENT_INVALID", "Partner payment basis does not match finalization.");
      }
      const expected = Math.round(
        (baseAmountCentavos * (commissionRateBasisPoints / 100)) / 100
      );
      if (expected !== commissionAmountCentavos) {
        fail("SIBLING_INTENT_INVALID", "Partner percentage arithmetic is inconsistent.");
      }
    } else if (commissionModel === "PERCENTAGE_OF_GROSS") {
      if (raw.calculationBasis !== "GROSS_PRICE") {
        fail("SIBLING_INTENT_INVALID", "Gross partner basis is inconsistent.");
      }
      calculationBasis = "GROSS_PRICE";
      baseAmountCentavos = requirePositivePostgresInteger(
        raw.baseAmountCentavos,
        "partner.baseAmountCentavos",
        "SIBLING_INTENT_INVALID"
      );
      const expected = Math.round(
        (baseAmountCentavos * (commissionRateBasisPoints / 100)) / 100
      );
      if (expected !== commissionAmountCentavos) {
        fail("SIBLING_INTENT_INVALID", "Partner gross percentage arithmetic is inconsistent.");
      }
    } else {
      if (
        raw.calculationBasis !== "FIXED_AMOUNT" ||
        raw.baseAmountCentavos !== null ||
        commissionRateBasisPoints !== 0
      ) {
        fail("SIBLING_INTENT_INVALID", "Fixed partner commission inputs are inconsistent.");
      }
      calculationBasis = "FIXED_AMOUNT";
      baseAmountCentavos = null;
    }

    const holdingExpected =
      parent.verifiedAt.getTime() + holdingPeriodDays * MILLISECONDS_PER_DAY;
    if (
      !Number.isSafeInteger(holdingExpected) ||
      new Date(holdingExpected).toISOString() !== holdingUntil
    ) {
      fail("SIBLING_INTENT_INVALID", "Partner holding timestamp is inconsistent.");
    }

    return {
      kind: "PARTNER_COMMISSION",
      status: "PENDING",
      notApplicableReason: null,
      partnerId,
      partnerCode,
      commissionModel,
      commissionRateBasisPoints,
      calculationBasis,
      baseAmountCentavos,
      commissionAmountCentavos,
      campaignSource,
      holdingPeriodDays,
      holdingUntil,
    };
  }

  if (status !== "NOT_APPLICABLE") {
    fail("SIBLING_INTENT_INVALID", "Partner commission intent has an unsupported status.");
  }

  if (
    raw.notApplicableReason !== "NO_PARTNER_ATTRIBUTION" &&
    raw.notApplicableReason !== "INACTIVE_PARTNER" &&
    raw.notApplicableReason !== "ZERO_COMMISSION_CALCULATED"
  ) {
    fail("SIBLING_INTENT_INVALID", "Partner not-applicable reason is unsupported.");
  }
  if (raw.commissionAmountCentavos !== 0 || raw.holdingUntil !== null) {
    fail("SIBLING_INTENT_INVALID", "Not-applicable partner economics are invalid.");
  }

  if (raw.notApplicableReason === "NO_PARTNER_ATTRIBUTION") {
    if (
      raw.partnerId !== null ||
      raw.partnerCode !== null ||
      raw.commissionModel !== null ||
      raw.commissionRateBasisPoints !== null ||
      raw.calculationBasis !== null ||
      raw.baseAmountCentavos !== null ||
      raw.holdingPeriodDays !== null ||
      effect.partnerId !== null
    ) {
      fail("SIBLING_INTENT_INVALID", "No-attribution partner intent is inconsistent.");
    }
    return {
      kind: "PARTNER_COMMISSION",
      status: "NOT_APPLICABLE",
      notApplicableReason: "NO_PARTNER_ATTRIBUTION",
      partnerId: null,
      partnerCode: null,
      commissionModel: null,
      commissionRateBasisPoints: null,
      calculationBasis: null,
      baseAmountCentavos: null,
      commissionAmountCentavos: 0,
      campaignSource,
      holdingPeriodDays: null,
      holdingUntil: null,
    };
  }

  const partnerId = requireExactIdentifier(raw.partnerId, "partner.partnerId");
  const partnerCode = requireExactIdentifier(raw.partnerCode, "partner.partnerCode");
  if (effect.partnerId !== partnerId) {
    fail("SIBLING_INTENT_INVALID", "Partner effect identity column is inconsistent.");
  }

  if (raw.notApplicableReason === "INACTIVE_PARTNER") {
    if (
      typeof raw.commissionModel !== "string" ||
      !PERSISTED_PARTNER_MODELS.some((model) => model === raw.commissionModel) ||
      raw.commissionRateBasisPoints !== null ||
      raw.calculationBasis !== null ||
      raw.baseAmountCentavos !== null ||
      raw.holdingPeriodDays !== null
    ) {
      fail("SIBLING_INTENT_INVALID", "Inactive-partner snapshot is inconsistent.");
    }
    return {
      kind: "PARTNER_COMMISSION",
      status: "NOT_APPLICABLE",
      notApplicableReason: "INACTIVE_PARTNER",
      partnerId,
      partnerCode,
      commissionModel: raw.commissionModel as Exclude<
        ParsedPartnerCommissionIntent["commissionModel"],
        null
      >,
      commissionRateBasisPoints: null,
      calculationBasis: null,
      baseAmountCentavos: null,
      commissionAmountCentavos: 0,
      campaignSource,
      holdingPeriodDays: null,
      holdingUntil: null,
    };
  }

  // ZERO_COMMISSION_CALCULATED preserves active-model calculation inputs.
  if (typeof campaignSource !== "string" || campaignSource.length === 0) {
    fail("SIBLING_INTENT_INVALID", "Zero-commission snapshot requires campaignSource.");
  }
  if (
    typeof raw.commissionModel !== "string" ||
    !V1_ACTIVE_PARTNER_MODELS.some((model) => model === raw.commissionModel)
  ) {
    fail("SIBLING_INTENT_INVALID", "Zero-commission model is outside the active v1 set.");
  }
  const commissionModel = raw.commissionModel as (typeof V1_ACTIVE_PARTNER_MODELS)[number];
  const holdingPeriodDays = requireNonNegativeSafeInteger(
    raw.holdingPeriodDays,
    "partner.holdingPeriodDays",
    "SIBLING_INTENT_INVALID"
  );

  if (commissionModel === "FIXED_PER_PURCHASE") {
    if (
      raw.commissionRateBasisPoints !== 0 ||
      raw.calculationBasis !== "FIXED_AMOUNT" ||
      raw.baseAmountCentavos !== null
    ) {
      fail("SIBLING_INTENT_INVALID", "Zero fixed partner commission inputs are inconsistent.");
    }
    return {
      kind: "PARTNER_COMMISSION",
      status: "NOT_APPLICABLE",
      notApplicableReason: "ZERO_COMMISSION_CALCULATED",
      partnerId,
      partnerCode,
      commissionModel: "FIXED_PER_PURCHASE",
      commissionRateBasisPoints: 0,
      calculationBasis: "FIXED_AMOUNT",
      baseAmountCentavos: null,
      commissionAmountCentavos: 0,
      campaignSource,
      holdingPeriodDays,
      holdingUntil: null,
    };
  }

  const commissionRateBasisPointsValue = requireBasisPoints(
    raw.commissionRateBasisPoints,
    "partner.commissionRateBasisPoints",
    false,
    "SIBLING_INTENT_INVALID"
  );
  if (commissionRateBasisPointsValue === null) {
    fail("SIBLING_INTENT_INVALID", "Zero percentage partner rate is required.");
  }
  const commissionRateBasisPoints = commissionRateBasisPointsValue;
  const expectedBasis =
    commissionModel === "PERCENTAGE_OF_CUSTOMER_PAYMENT"
      ? "CUSTOMER_PAYMENT"
      : "GROSS_PRICE";
  if (raw.calculationBasis !== expectedBasis) {
    fail("SIBLING_INTENT_INVALID", "Zero percentage partner basis is inconsistent.");
  }
  const baseAmountCentavos = requirePositivePostgresInteger(
    raw.baseAmountCentavos,
    "partner.baseAmountCentavos",
    "SIBLING_INTENT_INVALID"
  );
  if (
    commissionModel === "PERCENTAGE_OF_CUSTOMER_PAYMENT" &&
    baseAmountCentavos !== parent.purchaseAmountCentavos
  ) {
    fail("SIBLING_INTENT_INVALID", "Zero partner payment basis does not match finalization.");
  }
  const expectedZero = Math.round(
    (baseAmountCentavos * (commissionRateBasisPoints / 100)) / 100
  );
  if (expectedZero !== 0) {
    fail("SIBLING_INTENT_INVALID", "Zero partner percentage recomputes to non-zero.");
  }

  return {
    kind: "PARTNER_COMMISSION",
    status: "NOT_APPLICABLE",
    notApplicableReason: "ZERO_COMMISSION_CALCULATED",
    partnerId,
    partnerCode,
    commissionModel,
    commissionRateBasisPoints,
    calculationBasis: expectedBasis,
    baseAmountCentavos,
    commissionAmountCentavos: 0,
    campaignSource,
    holdingPeriodDays,
    holdingUntil: null,
  };
}

function parsePartnerLiabilitySibling(
  effect: PaymentFinalizationEffect,
  raw: Record<string, unknown>,
  parent: LoadedReconciliationEffect["finalization"]
): ParsedPartnerLiabilityIntent {
  const status = raw.status;
  if (status === "NOT_APPLICABLE") {
    requireExactKeys(
      raw,
      PARTNER_LIABILITY_NOT_APPLICABLE_INTENT_KEYS,
      "SIBLING_INTENT_INVALID"
    );
  } else {
    requireExactKeys(raw, PARTNER_LIABILITY_INTENT_KEYS, "SIBLING_INTENT_INVALID");
  }

  if (
    raw.effectType !== "PARTNER_LIABILITY_LEDGER" ||
    raw.intentVersion !== 1 ||
    effect.effectKey !== "partner-liability" ||
    effect.operationKey !==
      buildPaymentFinalizationOperationKey(parent.transactionId, {
        kind: "PARTNER_LIABILITY",
      }) ||
    effect.referralId !== null ||
    effect.taxConfigId !== null
  ) {
    fail("SIBLING_INTENT_INVALID", "Partner liability sibling linkage is inconsistent.");
  }

  if (status === "PENDING") {
    const partnerId = requireExactIdentifier(raw.partnerId, "partnerLiability.partnerId");
    const amountCentavos = requirePositivePostgresInteger(
      raw.amountCentavos,
      "partnerLiability.amountCentavos",
      "SIBLING_INTENT_INVALID"
    );
    if (
      effect.partnerId !== partnerId ||
      raw.debitCategory !== "EXPENSE_PARTNER" ||
      raw.creditCategory !== "LIABILITY_PARTNER_PAYABLE"
    ) {
      fail("SIBLING_INTENT_INVALID", "Active partner liability intent is invalid.");
    }
    return {
      kind: "PARTNER_LIABILITY",
      status: "PENDING",
      notApplicableReason: null,
      partnerId,
      amountCentavos,
    };
  }

  if (
    status !== "NOT_APPLICABLE" ||
    raw.notApplicableReason !== "NO_PARTNER_COMMISSION" ||
    raw.amountCentavos !== 0 ||
    raw.debitCategory !== null ||
    raw.creditCategory !== null
  ) {
    fail("SIBLING_INTENT_INVALID", "Not-applicable partner liability intent is invalid.");
  }

  let partnerId: string | null = null;
  if (raw.partnerId !== null) {
    partnerId = requireExactIdentifier(raw.partnerId, "partnerLiability.partnerId");
  }
  if (effect.partnerId !== partnerId) {
    fail("SIBLING_INTENT_INVALID", "Partner liability identity column is inconsistent.");
  }

  return {
    kind: "PARTNER_LIABILITY",
    status: "NOT_APPLICABLE",
    notApplicableReason: "NO_PARTNER_COMMISSION",
    partnerId,
    amountCentavos: 0,
  };
}

function parseTaxSibling(
  effect: PaymentFinalizationEffect,
  raw: Record<string, unknown>,
  parent: LoadedReconciliationEffect["finalization"]
): ParsedTaxIntent {
  const status = raw.status;
  if (status === "NOT_APPLICABLE") {
    requireExactKeys(raw, TAX_NOT_APPLICABLE_INTENT_KEYS, "SIBLING_INTENT_INVALID");
  } else {
    requireExactKeys(raw, TAX_INTENT_KEYS, "SIBLING_INTENT_INVALID");
  }

  if (
    raw.effectType !== "TAX_PROVISION" ||
    raw.intentVersion !== 1 ||
    effect.referralId !== null ||
    effect.partnerId !== null
  ) {
    fail("SIBLING_INTENT_INVALID", "Tax sibling linkage is inconsistent.");
  }

  if (status === "PENDING") {
    const taxConfigId = requireExactIdentifier(raw.taxConfigId, "tax.taxConfigId");
    if (typeof raw.taxName !== "string") {
      fail("SIBLING_INTENT_INVALID", "Tax name must be a string.");
    }
    if (
      typeof raw.taxType !== "string" ||
      !V1_TAX_TYPES.some((taxType) => taxType === raw.taxType)
    ) {
      fail("SIBLING_INTENT_INVALID", "Tax type is outside the v1 set.");
    }
    if (
      raw.calculationBasis !== "CUSTOMER_PAYMENT" &&
      raw.calculationBasis !== "GROSS_SALE"
    ) {
      fail("SIBLING_INTENT_INVALID", "Tax calculation basis is outside the v1 set.");
    }
    const taxableAmountCentavos = requireNonNegativePostgresInteger(
      raw.taxableAmountCentavos,
      "tax.taxableAmountCentavos",
      "SIBLING_INTENT_INVALID"
    );
    const taxRateBasisPoints = requireBasisPoints(
      raw.taxRateBasisPoints,
      "tax.taxRateBasisPoints",
      true,
      "SIBLING_INTENT_INVALID"
    );
    const taxAmountCentavos = requirePositivePostgresInteger(
      raw.taxAmountCentavos,
      "tax.taxAmountCentavos",
      "SIBLING_INTENT_INVALID"
    );

    if (
      effect.taxConfigId !== taxConfigId ||
      effect.effectKey !== `tax:${taxConfigId}` ||
      effect.operationKey !==
        buildPaymentFinalizationOperationKey(parent.transactionId, {
          kind: "TAX",
          taxConfigId,
        }) ||
      raw.debitCategory !== "EXPENSE_TAX" ||
      raw.creditCategory !== "LIABILITY_TAX_PAYABLE"
    ) {
      fail("SIBLING_INTENT_INVALID", "Active tax effect identity is inconsistent.");
    }

    if (
      raw.calculationBasis === "CUSTOMER_PAYMENT" &&
      taxableAmountCentavos !== parent.purchaseAmountCentavos
    ) {
      fail("SIBLING_INTENT_INVALID", "Customer-payment tax base does not match finalization.");
    }
    if (taxRateBasisPoints !== null) {
      const expected = Math.round(
        (taxableAmountCentavos * (taxRateBasisPoints / 100)) / 100
      );
      if (expected !== taxAmountCentavos) {
        fail("SIBLING_INTENT_INVALID", "Tax percentage arithmetic is inconsistent.");
      }
    }

    return {
      kind: "TAX",
      status: "PENDING",
      notApplicableReason: null,
      taxConfigId,
      taxName: raw.taxName,
      taxType: raw.taxType as (typeof V1_TAX_TYPES)[number],
      calculationBasis: raw.calculationBasis,
      taxableAmountCentavos,
      taxRateBasisPoints,
      taxAmountCentavos,
    };
  }

  if (status !== "NOT_APPLICABLE") {
    fail("SIBLING_INTENT_INVALID", "Tax intent has an unsupported status.");
  }

  if (
    raw.notApplicableReason !== "NO_ACTIVE_TAX_RULES" &&
    raw.notApplicableReason !== "ZERO_TAX_CALCULATED"
  ) {
    fail("SIBLING_INTENT_INVALID", "Tax not-applicable reason is unsupported.");
  }

  if (raw.notApplicableReason === "NO_ACTIVE_TAX_RULES") {
    if (
      raw.taxConfigId !== null ||
      raw.taxName !== null ||
      raw.taxType !== null ||
      raw.calculationBasis !== null ||
      raw.taxableAmountCentavos !== 0 ||
      raw.taxRateBasisPoints !== null ||
      raw.taxAmountCentavos !== 0 ||
      raw.debitCategory !== null ||
      raw.creditCategory !== null ||
      effect.taxConfigId !== null ||
      effect.effectKey !== "tax:none" ||
      effect.operationKey !==
        buildPaymentFinalizationOperationKey(parent.transactionId, { kind: "TAX_NONE" })
    ) {
      fail("SIBLING_INTENT_INVALID", "tax:none intent is inconsistent.");
    }
    return {
      kind: "TAX",
      status: "NOT_APPLICABLE",
      notApplicableReason: "NO_ACTIVE_TAX_RULES",
      taxConfigId: null,
      taxName: null,
      taxType: null,
      calculationBasis: null,
      taxableAmountCentavos: 0,
      taxRateBasisPoints: null,
      taxAmountCentavos: 0,
    };
  }

  const taxConfigId = requireExactIdentifier(raw.taxConfigId, "tax.taxConfigId");
  if (typeof raw.taxName !== "string") {
    fail("SIBLING_INTENT_INVALID", "Tax name must be a string.");
  }
  if (
    typeof raw.taxType !== "string" ||
    !V1_TAX_TYPES.some((taxType) => taxType === raw.taxType)
  ) {
    fail("SIBLING_INTENT_INVALID", "Tax type is outside the v1 set.");
  }
  if (
    raw.calculationBasis !== "CUSTOMER_PAYMENT" &&
    raw.calculationBasis !== "GROSS_SALE"
  ) {
    fail("SIBLING_INTENT_INVALID", "Tax calculation basis is outside the v1 set.");
  }
  const taxableAmountCentavos = requireNonNegativePostgresInteger(
    raw.taxableAmountCentavos,
    "tax.taxableAmountCentavos",
    "SIBLING_INTENT_INVALID"
  );
  const taxRateBasisPoints = requireBasisPoints(
    raw.taxRateBasisPoints,
    "tax.taxRateBasisPoints",
    true,
    "SIBLING_INTENT_INVALID"
  );
  if (
    raw.taxAmountCentavos !== 0 ||
    raw.debitCategory !== null ||
    raw.creditCategory !== null ||
    effect.taxConfigId !== taxConfigId ||
    effect.effectKey !== `tax:${taxConfigId}` ||
    effect.operationKey !==
      buildPaymentFinalizationOperationKey(parent.transactionId, {
        kind: "TAX",
        taxConfigId,
      })
  ) {
    fail("SIBLING_INTENT_INVALID", "Zero-tax intent identity is inconsistent.");
  }
  if (
    raw.calculationBasis === "CUSTOMER_PAYMENT" &&
    taxableAmountCentavos !== parent.purchaseAmountCentavos
  ) {
    fail("SIBLING_INTENT_INVALID", "Customer-payment zero-tax base does not match finalization.");
  }
  if (taxRateBasisPoints !== null) {
    const expected = Math.round(
      (taxableAmountCentavos * (taxRateBasisPoints / 100)) / 100
    );
    if (expected !== 0) {
      fail("SIBLING_INTENT_INVALID", "Zero-tax percentage arithmetic is inconsistent.");
    }
  }

  return {
    kind: "TAX",
    status: "NOT_APPLICABLE",
    notApplicableReason: "ZERO_TAX_CALCULATED",
    taxConfigId,
    taxName: raw.taxName,
    taxType: raw.taxType as (typeof V1_TAX_TYPES)[number],
    calculationBasis: raw.calculationBasis,
    taxableAmountCentavos,
    taxRateBasisPoints,
    taxAmountCentavos: 0,
  };
}

function parseSiblingIntent(
  effect: PaymentFinalizationEffect,
  parent: LoadedReconciliationEffect["finalization"]
): ParsedSiblingIntent {
  const raw = ensureSiblingHashAndVersion(effect);

  switch (effect.effectType) {
    case "PAYMENT_LEDGER":
      return parsePaymentSibling(effect, raw, parent);
    case "PROVIDER_FEE_LEDGER":
      return parseFeeSibling(effect, raw, parent);
    case "REFERRAL_REWARD":
      return parseReferralSibling(effect, raw, parent);
    case "PARTNER_COMMISSION":
      return parsePartnerCommissionSibling(effect, raw, parent);
    case "PARTNER_LIABILITY_LEDGER":
      return parsePartnerLiabilitySibling(effect, raw, parent);
    case "TAX_PROVISION":
      return parseTaxSibling(effect, raw, parent);
    case "RECONCILIATION":
      fail("SIBLING_INTENT_INVALID", "A second reconciliation sibling is not supported.");
    default:
      fail("SIBLING_INTENT_INVALID", "Sibling effect type is outside the closed v1 set.");
  }
}

function validateSiblingTopology(
  siblings: readonly PaymentFinalizationEffect[]
): void {
  const counts = new Map<string, number>();
  for (const sibling of siblings) {
    counts.set(sibling.effectType, (counts.get(sibling.effectType) ?? 0) + 1);
  }

  const requireCount = (effectType: string, expected: number): void => {
    if ((counts.get(effectType) ?? 0) !== expected) {
      fail(
        "SIBLING_INTENT_INVALID",
        `Finalization requires exactly ${expected} ${effectType} sibling effect(s).`
      );
    }
  };

  requireCount("PAYMENT_LEDGER", 1);
  requireCount("PROVIDER_FEE_LEDGER", 1);
  requireCount("REFERRAL_REWARD", 1);
  requireCount("PARTNER_COMMISSION", 1);
  requireCount("PARTNER_LIABILITY_LEDGER", 1);
  requireCount("RECONCILIATION", 0);

  const taxEffects = siblings.filter((effect) => effect.effectType === "TAX_PROVISION");
  if (taxEffects.length < 1) {
    fail("SIBLING_INTENT_INVALID", "Finalization requires at least one TAX_PROVISION sibling.");
  }

  const taxNoneEffects = taxEffects.filter((effect) => effect.effectKey === "tax:none");
  if (taxNoneEffects.length > 0 && (taxNoneEffects.length !== 1 || taxEffects.length !== 1)) {
    fail(
      "SIBLING_INTENT_INVALID",
      "tax:none must be the sole TAX_PROVISION effect when present."
    );
  }
}

function validateParsedSiblingRelationships(
  siblings: readonly PaymentFinalizationEffect[],
  parsed: ReadonlyMap<string, ParsedSiblingIntent>
): void {
  const commissionEffect = siblings.find(
    (effect) => effect.effectType === "PARTNER_COMMISSION"
  );
  const liabilityEffect = siblings.find(
    (effect) => effect.effectType === "PARTNER_LIABILITY_LEDGER"
  );
  if (!commissionEffect || !liabilityEffect) {
    fail("SIBLING_INTENT_INVALID", "Partner sibling pair is incomplete.");
  }

  const commissionIntent = parsed.get(commissionEffect.id);
  const liabilityIntent = parsed.get(liabilityEffect.id);
  if (
    !commissionIntent ||
    commissionIntent.kind !== "PARTNER_COMMISSION" ||
    !liabilityIntent ||
    liabilityIntent.kind !== "PARTNER_LIABILITY"
  ) {
    fail("SIBLING_INTENT_INVALID", "Partner sibling pair could not be parsed consistently.");
  }

  if (commissionIntent.status !== liabilityIntent.status) {
    fail("SIBLING_INTENT_INVALID", "Partner commission/liability intent statuses disagree.");
  }
  if (commissionIntent.partnerId !== liabilityIntent.partnerId) {
    fail("SIBLING_INTENT_INVALID", "Partner commission/liability identities disagree.");
  }
  if (commissionIntent.status === "PENDING") {
    if (liabilityIntent.amountCentavos !== commissionIntent.commissionAmountCentavos) {
      fail(
        "SIBLING_INTENT_INVALID",
        "Partner liability amount does not equal immutable commission amount."
      );
    }
  } else if (liabilityIntent.amountCentavos !== 0) {
    fail("SIBLING_INTENT_INVALID", "Not-applicable partner liability amount must remain zero.");
  }
}

function validateSiblingTerminality(
  effect: PaymentFinalizationEffect,
  intent: ParsedSiblingIntent
): void {
  if (effect.status !== "COMPLETE" && effect.status !== "NOT_APPLICABLE") {
    fail(
      "PREREQUISITE_NOT_TERMINAL",
      `Sibling ${effect.effectType}:${effect.effectKey} is not terminal.`
    );
  }

  if (effect.status === "COMPLETE") {
    if (intent.status !== "PENDING") {
      fail("SIBLING_INTENT_INVALID", "COMPLETE sibling does not originate from a pending intent.");
    }
    return;
  }

  if (intent.status !== "NOT_APPLICABLE") {
    fail(
      "SIBLING_INTENT_INVALID",
      "NOT_APPLICABLE sibling does not contain a not-applicable intent."
    );
  }
}

function addIssue(
  issues: ReconciliationIssue[],
  severity: IssueSeverity,
  domain: IssueDomain,
  token: string,
  discrepancyCentavos = 0
): void {
  issues.push({
    severity,
    domain,
    token,
    discrepancyCentavos: clampDiscrepancy(discrepancyCentavos),
  });
}

function clampDiscrepancy(value: number): number {
  if (!Number.isFinite(value)) return POSTGRESQL_INTEGER_MAX;
  const rounded = Math.trunc(Math.abs(value));
  return Math.min(POSTGRESQL_INTEGER_MAX, rounded);
}

function amountDifference(expected: number, actual: number): number {
  return clampDiscrepancy(actual - expected);
}

function ledgerPairAmountDiscrepancy(
  expected: number,
  debitActual: number,
  creditActual: number
): number {
  return Math.max(
    amountDifference(expected, debitActual),
    amountDifference(expected, creditActual)
  );
}

function sameRowIds(
  left: readonly { readonly id: string }[],
  right: readonly { readonly id: string }[]
): boolean {
  if (left.length !== right.length) return false;
  const rightIds = new Set(right.map((row) => row.id));
  return left.every((row) => rightIds.has(row.id));
}

function classifyLedgerShape(
  state: LedgerReadState,
  expectedCount: number,
  issues: ReconciliationIssue[],
  domain: IssueDomain,
  missingToken: string,
  duplicateToken: string,
  mismatchToken: string
): readonly FinancialLedgerEntry[] | null {
  const { byOperation, byEffect } = state;

  if (expectedCount === 0) {
    const allIds = new Set([
      ...byOperation.map((row) => row.id),
      ...byEffect.map((row) => row.id),
    ]);
    if (allIds.size === 0) return [];
    addIssue(
      issues,
      allIds.size > 1 ? "DUPLICATE" : "MISMATCHED",
      domain,
      allIds.size > 1 ? duplicateToken : mismatchToken
    );
    return null;
  }

  if (byOperation.length === 0 && byEffect.length === 0) {
    addIssue(issues, "MISSING", domain, missingToken);
    return null;
  }

  if (byOperation.length > expectedCount || byEffect.length > expectedCount) {
    addIssue(issues, "DUPLICATE", domain, duplicateToken);
    return null;
  }

  if (byOperation.length < expectedCount || byEffect.length < expectedCount) {
    addIssue(issues, "MISSING", domain, missingToken);
    return null;
  }

  if (!sameRowIds(byOperation, byEffect)) {
    addIssue(issues, "MISMATCHED", domain, mismatchToken);
    return null;
  }

  return byOperation;
}

function splitLedgerPair(
  rows: readonly FinancialLedgerEntry[],
  issues: ReconciliationIssue[],
  domain: IssueDomain,
  malformedToken: string
): { readonly debit: FinancialLedgerEntry; readonly credit: FinancialLedgerEntry } | null {
  const debits = rows.filter((row) => row.entryType === "DEBIT");
  const credits = rows.filter((row) => row.entryType === "CREDIT");
  if (debits.length !== 1 || credits.length !== 1) {
    addIssue(issues, "MISMATCHED", domain, malformedToken);
    return null;
  }
  return { debit: debits[0], credit: credits[0] };
}

function validateCommonLedgerPair(
  pair: { readonly debit: FinancialLedgerEntry; readonly credit: FinancialLedgerEntry },
  expected: {
    readonly transactionId: string;
    readonly operationKey: string;
    readonly effectId: string;
    readonly transactionType: FinancialLedgerEntry["transactionType"];
    readonly debitCategory: FinancialLedgerEntry["accountCategory"];
    readonly creditCategory: FinancialLedgerEntry["accountCategory"];
    readonly amountCentavos: number;
    readonly sourceEntity: string;
    readonly sourceId: string;
    readonly effectiveDate: Date;
  },
  issues: ReconciliationIssue[],
  domain: IssueDomain,
  mismatchToken: string
): boolean {
  const { debit, credit } = pair;
  const structuralMismatch =
    debit.operationKey !== expected.operationKey ||
    credit.operationKey !== expected.operationKey ||
    debit.finalizationEffectId !== expected.effectId ||
    credit.finalizationEffectId !== expected.effectId ||
    debit.transactionId !== expected.transactionId ||
    credit.transactionId !== expected.transactionId ||
    debit.transactionType !== expected.transactionType ||
    credit.transactionType !== expected.transactionType ||
    debit.accountCategory !== expected.debitCategory ||
    credit.accountCategory !== expected.creditCategory ||
    debit.currency !== "PHP" ||
    credit.currency !== "PHP" ||
    debit.sourceEntity !== expected.sourceEntity ||
    credit.sourceEntity !== expected.sourceEntity ||
    debit.sourceId !== expected.sourceId ||
    credit.sourceId !== expected.sourceId ||
    debit.effectiveDate.toISOString() !== expected.effectiveDate.toISOString() ||
    credit.effectiveDate.toISOString() !== expected.effectiveDate.toISOString();

  const amountMismatch =
    debit.amountCentavos !== expected.amountCentavos ||
    credit.amountCentavos !== expected.amountCentavos ||
    debit.amountCentavos !== credit.amountCentavos;

  if (structuralMismatch || amountMismatch) {
    addIssue(
      issues,
      "MISMATCHED",
      domain,
      mismatchToken,
      amountMismatch
        ? ledgerPairAmountDiscrepancy(
            expected.amountCentavos,
            debit.amountCentavos,
            credit.amountCentavos
          )
        : 0
    );
    return false;
  }

  return true;
}

async function readLedgerState(
  client: Prisma.TransactionClient,
  operationKey: string,
  effectId: string
): Promise<LedgerReadState> {
  const byOperation = await client.financialLedgerEntry.findMany({
    where: { operationKey },
    orderBy: [{ entryType: "asc" }, { id: "asc" }],
  });
  const byEffect = await client.financialLedgerEntry.findMany({
    where: { finalizationEffectId: effectId },
    orderBy: [{ entryType: "asc" }, { id: "asc" }],
  });
  return { byOperation, byEffect };
}

async function evaluatePaymentEvidence(
  client: Prisma.TransactionClient,
  effect: PaymentFinalizationEffect,
  intent: ParsedPaymentIntent,
  parent: LoadedReconciliationEffect["finalization"],
  issues: ReconciliationIssue[]
): Promise<void> {
  const state = await readLedgerState(client, effect.operationKey, effect.id);
  const rows = classifyLedgerShape(
    state,
    2,
    issues,
    "PAYMENT",
    "PAYMENT_LEDGER_MISSING",
    "PAYMENT_LEDGER_DUPLICATE",
    "PAYMENT_LEDGER_IDENTITY_MISMATCH"
  );
  if (!rows) {
    const issue = issues[issues.length - 1];
    if (issue && issue.token === "PAYMENT_LEDGER_MISSING") {
      issues[issues.length - 1] = {
        ...issue,
        discrepancyCentavos: intent.amountCentavos,
      };
    }
    return;
  }
  const pair = splitLedgerPair(rows, issues, "PAYMENT", "PAYMENT_LEDGER_UNBALANCED");
  if (!pair) return;
  validateCommonLedgerPair(
    pair,
    {
      transactionId: parent.transactionId,
      operationKey: effect.operationKey,
      effectId: effect.id,
      transactionType: "PAYMENT_RECEIVED",
      debitCategory: "CASH_PAYMONGO",
      creditCategory: "REVENUE_PREMIUM",
      amountCentavos: intent.amountCentavos,
      sourceEntity: "PaymentFinalization",
      sourceId: parent.id,
      effectiveDate: parent.verifiedAt,
    },
    issues,
    "PAYMENT",
    "PAYMENT_LEDGER_MISMATCH"
  );
}

async function evaluateFeeEvidence(
  client: Prisma.TransactionClient,
  effect: PaymentFinalizationEffect,
  intent: ParsedFeeIntent,
  parent: LoadedReconciliationEffect["finalization"],
  issues: ReconciliationIssue[]
): Promise<void> {
  const state = await readLedgerState(client, effect.operationKey, effect.id);
  if (intent.status === "NOT_APPLICABLE") {
    classifyLedgerShape(
      state,
      0,
      issues,
      "FEE",
      "FEE_LEDGER_MISSING",
      "FEE_LEDGER_DUPLICATE",
      "FEE_LEDGER_UNEXPECTED"
    );
    return;
  }
  if (intent.status !== "PENDING" || intent.feeAmountCentavos === null) {
    fail("SIBLING_INTENT_INVALID", "Terminal fee evidence cannot originate from awaiting data.");
  }
  const rows = classifyLedgerShape(
    state,
    2,
    issues,
    "FEE",
    "FEE_LEDGER_MISSING",
    "FEE_LEDGER_DUPLICATE",
    "FEE_LEDGER_IDENTITY_MISMATCH"
  );
  if (!rows) {
    const issue = issues[issues.length - 1];
    if (issue && issue.token === "FEE_LEDGER_MISSING") {
      issues[issues.length - 1] = {
        ...issue,
        discrepancyCentavos: intent.feeAmountCentavos,
      };
    }
    return;
  }
  const pair = splitLedgerPair(rows, issues, "FEE", "FEE_LEDGER_UNBALANCED");
  if (!pair) return;
  validateCommonLedgerPair(
    pair,
    {
      transactionId: parent.transactionId,
      operationKey: effect.operationKey,
      effectId: effect.id,
      transactionType: "PAYMONGO_FEE",
      debitCategory: "EXPENSE_PAYMENT_FEE",
      creditCategory: "CASH_PAYMONGO",
      amountCentavos: intent.feeAmountCentavos,
      sourceEntity: "PaymentFinalization",
      sourceId: parent.id,
      effectiveDate: parent.verifiedAt,
    },
    issues,
    "FEE",
    "FEE_LEDGER_MISMATCH"
  );
}

function validateReferralRewardRow(
  row: ReferralReward,
  intent: ParsedReferralIntent,
  transactionId: string,
  effectId: string
): boolean {
  if (
    intent.status !== "PENDING" ||
    intent.referralId === null ||
    intent.inviterId === null ||
    intent.rewardType === null ||
    intent.rewardRateBasisPoints === null ||
    intent.holdingUntil === null
  ) {
    return false;
  }

  return (
    row.referralId === intent.referralId &&
    row.inviterId === intent.inviterId &&
    row.referredUserId === intent.referredUserId &&
    row.transactionId === transactionId &&
    row.finalizationEffectId === effectId &&
    row.purchaseAmountCentavos === intent.purchaseAmountCentavos &&
    row.rewardType === (intent.rewardType === "FIXED" ? "FIXED_AMOUNT" : "PERCENTAGE") &&
    row.effectiveRate === intent.rewardRateBasisPoints / 100 &&
    row.rewardAmountCentavos === intent.rewardAmountCentavos &&
    row.currency === "PHP" &&
    row.holdingUntil?.toISOString() === intent.holdingUntil
  );
}

async function evaluateReferralEvidence(
  client: Prisma.TransactionClient,
  effect: PaymentFinalizationEffect,
  intent: ParsedReferralIntent,
  transactionId: string,
  issues: ReconciliationIssue[]
): Promise<void> {
  const byEffect = await client.referralReward.findUnique({
    where: { finalizationEffectId: effect.id },
  });
  const byTransaction = await client.referralReward.findUnique({
    where: { transactionId },
  });

  if (intent.status === "NOT_APPLICABLE") {
    const ids = new Set(
      [byEffect?.id, byTransaction?.id].filter(
        (value): value is string => typeof value === "string"
      )
    );
    if (ids.size > 0) {
      addIssue(
        issues,
        ids.size > 1 ? "DUPLICATE" : "MISMATCHED",
        "REFERRAL",
        ids.size > 1 ? "REFERRAL_REWARD_DUPLICATE" : "REFERRAL_REWARD_UNEXPECTED"
      );
    }
    return;
  }

  const byReferral = intent.referralId
    ? await client.referralReward.findUnique({ where: { referralId: intent.referralId } })
    : null;
  const rows = [byEffect, byTransaction, byReferral].filter(
    (value): value is ReferralReward => value !== null
  );
  const ids = new Set(rows.map((row) => row.id));

  if (rows.length === 0) {
    addIssue(
      issues,
      "MISSING",
      "REFERRAL",
      "REFERRAL_REWARD_MISSING",
      intent.rewardAmountCentavos
    );
    return;
  }
  if (ids.size > 1) {
    addIssue(issues, "DUPLICATE", "REFERRAL", "REFERRAL_REWARD_DUPLICATE");
    return;
  }
  const row = rows[0];
  if (!byEffect || !byTransaction || !byReferral || !validateReferralRewardRow(row, intent, transactionId, effect.id)) {
    addIssue(
      issues,
      "MISMATCHED",
      "REFERRAL",
      "REFERRAL_REWARD_MISMATCH",
      amountDifference(intent.rewardAmountCentavos, row.rewardAmountCentavos)
    );
  }
}

function validatePartnerCommissionRow(
  row: PartnerCommission,
  intent: ParsedPartnerCommissionIntent,
  transactionId: string,
  effectId: string,
  purchaseAmountCentavos: number
): boolean {
  if (
    intent.status !== "PENDING" ||
    intent.partnerId === null ||
    intent.commissionModel === null ||
    intent.commissionRateBasisPoints === null ||
    intent.holdingUntil === null
  ) {
    return false;
  }
  return (
    row.partnerId === intent.partnerId &&
    row.transactionId === transactionId &&
    row.finalizationEffectId === effectId &&
    row.purchaseAmountCentavos === purchaseAmountCentavos &&
    row.commissionModel === intent.commissionModel &&
    row.effectiveRate === intent.commissionRateBasisPoints / 100 &&
    row.commissionAmountCentavos === intent.commissionAmountCentavos &&
    row.currency === "PHP" &&
    row.campaignSource === intent.campaignSource &&
    row.holdingUntil?.toISOString() === intent.holdingUntil
  );
}

async function evaluatePartnerCommissionEvidence(
  client: Prisma.TransactionClient,
  effect: PaymentFinalizationEffect,
  intent: ParsedPartnerCommissionIntent,
  transactionId: string,
  purchaseAmountCentavos: number,
  issues: ReconciliationIssue[]
): Promise<ExactPartnerEvidence | null> {
  const byEffect = await client.partnerCommission.findUnique({
    where: { finalizationEffectId: effect.id },
  });
  const byTransaction = await client.partnerCommission.findUnique({
    where: { transactionId },
  });

  if (intent.status === "NOT_APPLICABLE") {
    const ids = new Set(
      [byEffect?.id, byTransaction?.id].filter(
        (value): value is string => typeof value === "string"
      )
    );
    if (ids.size > 0) {
      addIssue(
        issues,
        ids.size > 1 ? "DUPLICATE" : "MISMATCHED",
        "PARTNER_COMMISSION",
        ids.size > 1
          ? "PARTNER_COMMISSION_DUPLICATE"
          : "PARTNER_COMMISSION_UNEXPECTED"
      );
    }
    return null;
  }

  if (!byEffect && !byTransaction) {
    addIssue(
      issues,
      "MISSING",
      "PARTNER_COMMISSION",
      "PARTNER_COMMISSION_MISSING",
      intent.commissionAmountCentavos
    );
    return null;
  }
  if (!byEffect || !byTransaction || byEffect.id !== byTransaction.id) {
    addIssue(
      issues,
      byEffect && byTransaction ? "DUPLICATE" : "MISMATCHED",
      "PARTNER_COMMISSION",
      byEffect && byTransaction
        ? "PARTNER_COMMISSION_DUPLICATE"
        : "PARTNER_COMMISSION_IDENTITY_MISMATCH"
    );
    return null;
  }
  if (
    !validatePartnerCommissionRow(
      byEffect,
      intent,
      transactionId,
      effect.id,
      purchaseAmountCentavos
    )
  ) {
    addIssue(
      issues,
      "MISMATCHED",
      "PARTNER_COMMISSION",
      "PARTNER_COMMISSION_MISMATCH",
      amountDifference(intent.commissionAmountCentavos, byEffect.commissionAmountCentavos)
    );
    return null;
  }
  return { commissionEffectId: effect.id, commission: byEffect };
}

async function evaluatePartnerLiabilityEvidence(
  client: Prisma.TransactionClient,
  effect: PaymentFinalizationEffect,
  intent: ParsedPartnerLiabilityIntent,
  parent: LoadedReconciliationEffect["finalization"],
  partnerEvidence: ExactPartnerEvidence | null,
  issues: ReconciliationIssue[]
): Promise<void> {
  const state = await readLedgerState(client, effect.operationKey, effect.id);
  if (intent.status === "NOT_APPLICABLE") {
    classifyLedgerShape(
      state,
      0,
      issues,
      "PARTNER_LIABILITY",
      "PARTNER_LIABILITY_MISSING",
      "PARTNER_LIABILITY_DUPLICATE",
      "PARTNER_LIABILITY_UNEXPECTED"
    );
    return;
  }

  const rows = classifyLedgerShape(
    state,
    2,
    issues,
    "PARTNER_LIABILITY",
    "PARTNER_LIABILITY_MISSING",
    "PARTNER_LIABILITY_DUPLICATE",
    "PARTNER_LIABILITY_IDENTITY_MISMATCH"
  );
  if (!rows) {
    const issue = issues[issues.length - 1];
    if (issue && issue.token === "PARTNER_LIABILITY_MISSING") {
      issues[issues.length - 1] = {
        ...issue,
        discrepancyCentavos: intent.amountCentavos,
      };
    }
    return;
  }
  const pair = splitLedgerPair(
    rows,
    issues,
    "PARTNER_LIABILITY",
    "PARTNER_LIABILITY_UNBALANCED"
  );
  if (!pair) return;

  const expectedSourceId = partnerEvidence?.commission.id ?? pair.debit.sourceId;
  const valid = validateCommonLedgerPair(
    pair,
    {
      transactionId: parent.transactionId,
      operationKey: effect.operationKey,
      effectId: effect.id,
      transactionType: "PARTNER_COMMISSION",
      debitCategory: "EXPENSE_PARTNER",
      creditCategory: "LIABILITY_PARTNER_PAYABLE",
      amountCentavos: intent.amountCentavos,
      sourceEntity: "PartnerCommission",
      sourceId: expectedSourceId,
      effectiveDate: parent.verifiedAt,
    },
    issues,
    "PARTNER_LIABILITY",
    "PARTNER_LIABILITY_MISMATCH"
  );

  if (
    valid &&
    partnerEvidence &&
    (partnerEvidence.commission.partnerId !== intent.partnerId ||
      partnerEvidence.commission.commissionAmountCentavos !== intent.amountCentavos ||
      pair.debit.sourceId !== partnerEvidence.commission.id ||
      pair.credit.sourceId !== partnerEvidence.commission.id)
  ) {
    addIssue(
      issues,
      "MISMATCHED",
      "PARTNER_LIABILITY",
      "PARTNER_LIABILITY_SOURCE_MISMATCH"
    );
  }
}

function validateTaxRecordRow(
  row: TaxRecord,
  intent: ParsedTaxIntent,
  transactionId: string,
  effectId: string,
  verifiedAt: Date
): boolean {
  if (
    intent.status !== "PENDING" ||
    intent.taxConfigId === null ||
    intent.calculationBasis === null
  ) {
    return false;
  }
  const expectedAppliedRate = (intent.taxRateBasisPoints ?? 0) / 100;
  return (
    row.taxConfigId === intent.taxConfigId &&
    row.transactionId === transactionId &&
    row.partnerPayoutId === null &&
    row.referralPayoutId === null &&
    row.finalizationEffectId === effectId &&
    row.taxableAmountCentavos === intent.taxableAmountCentavos &&
    row.appliedRate === expectedAppliedRate &&
    row.taxAmountCentavos === intent.taxAmountCentavos &&
    row.calculationBasis === intent.calculationBasis &&
    row.effectiveDate.toISOString() === verifiedAt.toISOString()
  );
}

async function evaluateTaxEvidence(
  client: Prisma.TransactionClient,
  effect: PaymentFinalizationEffect,
  intent: ParsedTaxIntent,
  parent: LoadedReconciliationEffect["finalization"],
  issues: ReconciliationIssue[]
): Promise<ExactTaxEvidence | null> {
  if (intent.status === "NOT_APPLICABLE") {
    const byEffect = await client.taxRecord.findUnique({
      where: { finalizationEffectId: effect.id },
    });
    const transactionRows =
      intent.taxConfigId === null
        ? await client.taxRecord.findMany({ where: { transactionId: parent.transactionId } })
        : await client.taxRecord.findMany({
            where: {
              transactionId: parent.transactionId,
              taxConfigId: intent.taxConfigId,
            },
          });
    const state = await readLedgerState(client, effect.operationKey, effect.id);
    const evidenceIds = new Set([
      ...(byEffect ? [`tax:${byEffect.id}`] : []),
      ...transactionRows.map((row) => `tax:${row.id}`),
      ...state.byOperation.map((row) => `ledger:${row.id}`),
      ...state.byEffect.map((row) => `ledger:${row.id}`),
    ]);
    if (evidenceIds.size > 0) {
      const suffix = intent.taxConfigId ? `:${intent.taxConfigId}` : "";
      addIssue(
        issues,
        evidenceIds.size > 1 ? "DUPLICATE" : "MISMATCHED",
        "TAX",
        evidenceIds.size > 1
          ? `TAX_EVIDENCE_DUPLICATE${suffix}`
          : `TAX_EVIDENCE_UNEXPECTED${suffix}`
      );
    }
    return null;
  }

  if (intent.taxConfigId === null) {
    fail("SIBLING_INTENT_INVALID", "Active tax intent is missing taxConfigId.");
  }

  const byEffect = await client.taxRecord.findUnique({
    where: { finalizationEffectId: effect.id },
  });
  const byTransactionConfig = await client.taxRecord.findMany({
    where: {
      transactionId: parent.transactionId,
      taxConfigId: intent.taxConfigId,
    },
    orderBy: { id: "asc" },
  });

  if (!byEffect && byTransactionConfig.length === 0) {
    addIssue(
      issues,
      "MISSING",
      "TAX",
      `TAX_RECORD_MISSING:${intent.taxConfigId}`,
      intent.taxAmountCentavos
    );
    // Still inspect ledger so multiple problems remain visible.
  } else if (byTransactionConfig.length > 1) {
    addIssue(issues, "DUPLICATE", "TAX", `TAX_RECORD_DUPLICATE:${intent.taxConfigId}`);
  } else if (
    !byEffect ||
    byTransactionConfig.length !== 1 ||
    byEffect.id !== byTransactionConfig[0].id
  ) {
    addIssue(
      issues,
      "MISMATCHED",
      "TAX",
      `TAX_RECORD_IDENTITY_MISMATCH:${intent.taxConfigId}`
    );
  } else if (
    !validateTaxRecordRow(
      byEffect,
      intent,
      parent.transactionId,
      effect.id,
      parent.verifiedAt
    )
  ) {
    addIssue(
      issues,
      "MISMATCHED",
      "TAX",
      `TAX_RECORD_MISMATCH:${intent.taxConfigId}`,
      amountDifference(intent.taxAmountCentavos, byEffect.taxAmountCentavos)
    );
  }

  const exactTaxRecord =
    byEffect &&
    byTransactionConfig.length === 1 &&
    byEffect.id === byTransactionConfig[0].id &&
    validateTaxRecordRow(
      byEffect,
      intent,
      parent.transactionId,
      effect.id,
      parent.verifiedAt
    )
      ? byEffect
      : null;

  const state = await readLedgerState(client, effect.operationKey, effect.id);
  const rows = classifyLedgerShape(
    state,
    2,
    issues,
    "TAX",
    `TAX_LEDGER_MISSING:${intent.taxConfigId}`,
    `TAX_LEDGER_DUPLICATE:${intent.taxConfigId}`,
    `TAX_LEDGER_IDENTITY_MISMATCH:${intent.taxConfigId}`
  );
  if (!rows) {
    const issue = issues[issues.length - 1];
    if (issue && issue.token === `TAX_LEDGER_MISSING:${intent.taxConfigId}`) {
      issues[issues.length - 1] = {
        ...issue,
        discrepancyCentavos: intent.taxAmountCentavos,
      };
    }
    return exactTaxRecord ? { taxEffectId: effect.id, taxRecord: exactTaxRecord } : null;
  }
  const pair = splitLedgerPair(
    rows,
    issues,
    "TAX",
    `TAX_LEDGER_UNBALANCED:${intent.taxConfigId}`
  );
  if (!pair) {
    return exactTaxRecord ? { taxEffectId: effect.id, taxRecord: exactTaxRecord } : null;
  }

  const expectedSourceId = exactTaxRecord?.id ?? pair.debit.sourceId;
  const validLedger = validateCommonLedgerPair(
    pair,
    {
      transactionId: parent.transactionId,
      operationKey: effect.operationKey,
      effectId: effect.id,
      transactionType: "TAX_PROVISION",
      debitCategory: "EXPENSE_TAX",
      creditCategory: "LIABILITY_TAX_PAYABLE",
      amountCentavos: intent.taxAmountCentavos,
      sourceEntity: "TaxRecord",
      sourceId: expectedSourceId,
      effectiveDate: parent.verifiedAt,
    },
    issues,
    "TAX",
    `TAX_LEDGER_MISMATCH:${intent.taxConfigId}`
  );

  if (
    validLedger &&
    exactTaxRecord &&
    (pair.debit.sourceId !== exactTaxRecord.id ||
      pair.credit.sourceId !== exactTaxRecord.id)
  ) {
    addIssue(
      issues,
      "MISMATCHED",
      "TAX",
      `TAX_LEDGER_SOURCE_MISMATCH:${intent.taxConfigId}`
    );
  }

  return exactTaxRecord ? { taxEffectId: effect.id, taxRecord: exactTaxRecord } : null;
}

function statusRank(severity: IssueSeverity): number {
  switch (severity) {
    case "DUPLICATE":
      return 3;
    case "MISMATCHED":
      return 2;
    case "MISSING":
      return 1;
  }
}

function domainRank(domain: IssueDomain): number {
  switch (domain) {
    case "PAYMENT":
      return 1;
    case "FEE":
      return 2;
    case "TAX":
      return 3;
    case "PARTNER_LIABILITY":
      return 4;
    case "REFERRAL":
      return 5;
    case "PARTNER_COMMISSION":
      return 6;
    case "OTHER":
      return 7;
  }
}

function buildDiscrepancyNotes(issues: readonly ReconciliationIssue[]): string {
  if (issues.length === 0) return "ALL_EVIDENCE_MATCHED";
  const tokens = [...new Set(issues.map((issue) => issue.token))].sort((a, b) =>
    a.localeCompare(b)
  );
  const full = tokens.join(";");
  if (full.length <= NOTES_MAX_LENGTH) return full;

  const digest = computeSha256Hash(full);
  const suffix = `;TRUNCATED_SHA256:${digest}`;
  const maxPrefix = Math.max(0, NOTES_MAX_LENGTH - suffix.length);
  let prefix = "";
  for (const token of tokens) {
    const next = prefix.length === 0 ? token : `${prefix};${token}`;
    if (next.length > maxPrefix) break;
    prefix = next;
  }
  return `${prefix}${suffix}`.slice(0, NOTES_MAX_LENGTH);
}

function finalizeEvaluation(issues: readonly ReconciliationIssue[]): EvaluationResult {
  if (issues.length === 0) {
    return {
      status: "MATCHED",
      discrepancyCentavos: 0,
      discrepancyNotes: "ALL_EVIDENCE_MATCHED",
    };
  }

  const topSeverity = [...issues].sort(
    (a, b) => statusRank(b.severity) - statusRank(a.severity)
  )[0].severity;
  const status: EvaluationResult["status"] = topSeverity;

  const primary = [...issues].sort((a, b) => {
    const domainDelta = domainRank(a.domain) - domainRank(b.domain);
    if (domainDelta !== 0) return domainDelta;
    const severityDelta = statusRank(b.severity) - statusRank(a.severity);
    if (severityDelta !== 0) return severityDelta;
    return a.token.localeCompare(b.token);
  })[0];

  return {
    status,
    discrepancyCentavos: primary.discrepancyCentavos,
    discrepancyNotes: buildDiscrepancyNotes(issues),
  };
}

async function evaluateAllEvidence(
  client: Prisma.TransactionClient,
  siblings: readonly PaymentFinalizationEffect[],
  parsed: ReadonlyMap<string, ParsedSiblingIntent>,
  parent: LoadedReconciliationEffect["finalization"]
): Promise<EvaluationResult> {
  const issues: ReconciliationIssue[] = [];

  const partnerCommissionEffect = siblings.find(
    (effect) => effect.effectType === "PARTNER_COMMISSION"
  );
  let partnerEvidence: ExactPartnerEvidence | null = null;
  if (partnerCommissionEffect) {
    const intent = parsed.get(partnerCommissionEffect.id);
    if (!intent || intent.kind !== "PARTNER_COMMISSION") {
      fail("SIBLING_INTENT_INVALID", "Partner commission parsed intent is missing.");
    }
    partnerEvidence = await evaluatePartnerCommissionEvidence(
      client,
      partnerCommissionEffect,
      intent,
      parent.transactionId,
      parent.purchaseAmountCentavos,
      issues
    );
  }

  for (const effect of siblings) {
    const intent = parsed.get(effect.id);
    if (!intent) {
      fail("SIBLING_INTENT_INVALID", "Parsed sibling intent is missing.");
    }
    switch (intent.kind) {
      case "PAYMENT":
        await evaluatePaymentEvidence(client, effect, intent, parent, issues);
        break;
      case "FEE":
        await evaluateFeeEvidence(client, effect, intent, parent, issues);
        break;
      case "REFERRAL":
        await evaluateReferralEvidence(client, effect, intent, parent.transactionId, issues);
        break;
      case "PARTNER_COMMISSION":
        // Evaluated first so liability source identity can be checked against it.
        break;
      case "PARTNER_LIABILITY":
        await evaluatePartnerLiabilityEvidence(
          client,
          effect,
          intent,
          parent,
          partnerEvidence,
          issues
        );
        break;
      case "TAX":
        await evaluateTaxEvidence(client, effect, intent, parent, issues);
        break;
    }
  }

  return finalizeEvaluation(issues);
}

async function acquireAdvisoryLock(
  client: Prisma.TransactionClient,
  lockName: string
): Promise<void> {
  await client.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${lockName}, 0)
    )::text
  `;
}

async function lockEffectRow(
  client: Prisma.TransactionClient,
  effectId: string
): Promise<void> {
  await client.$queryRaw`
    SELECT "id"
    FROM "PaymentFinalizationEffect"
    WHERE "id" = ${effectId}
    FOR UPDATE
  `;
}

async function lockFinalizationRow(
  client: Prisma.TransactionClient,
  finalizationId: string
): Promise<void> {
  await client.$queryRaw`
    SELECT "id"
    FROM "PaymentFinalization"
    WHERE "id" = ${finalizationId}
    FOR UPDATE
  `;
}

async function lockSiblingRows(
  client: Prisma.TransactionClient,
  effectIds: readonly string[]
): Promise<void> {
  for (const effectId of [...new Set(effectIds)].sort((a, b) => a.localeCompare(b))) {
    await lockEffectRow(client, effectId);
  }
}

async function lockReconciliationRows(
  client: Prisma.TransactionClient,
  recordIds: readonly string[]
): Promise<void> {
  for (const recordId of [...new Set(recordIds)].sort((a, b) => a.localeCompare(b))) {
    await client.$queryRaw`
      SELECT "id"
      FROM "ReconciliationRecord"
      WHERE "id" = ${recordId}
      FOR UPDATE
    `;
  }
}

async function loadReconciliationEffect(
  client: Prisma.TransactionClient,
  effectId: string
): Promise<LoadedReconciliationEffect | null> {
  return client.paymentFinalizationEffect.findUnique({
    where: { id: effectId },
    include: {
      finalization: {
        include: {
          transaction: true,
        },
      },
    },
  });
}

async function readReconciliationIdentity(
  client: Prisma.TransactionClient,
  effectId: string,
  transactionId: string
): Promise<{
  readonly byEffect: ReconciliationRecord | null;
  readonly bySource: readonly ReconciliationRecord[];
}> {
  const byEffect = await client.reconciliationRecord.findUnique({
    where: { finalizationEffectId: effectId },
  });
  const bySource = await client.reconciliationRecord.findMany({
    where: {
      sourceType: "INTERNAL_TRANSACTION",
      sourceId: transactionId,
    },
    orderBy: { id: "asc" },
  });
  return { byEffect, bySource };
}

function classifyReconciliationIdentity(state: {
  readonly byEffect: ReconciliationRecord | null;
  readonly bySource: readonly ReconciliationRecord[];
}, transactionId: string, effectId: string): ReconciliationIdentity {
  const { byEffect, bySource } = state;

  if (!byEffect && bySource.length === 0) {
    return { kind: "NONE" };
  }

  if (!byEffect && bySource.length === 1 && bySource[0].finalizationEffectId === null) {
    return { kind: "LEGACY", record: bySource[0] };
  }

  if (bySource.length > 1) {
    return { kind: "DUPLICATE" };
  }

  if (byEffect && bySource.length === 1 && byEffect.id === bySource[0].id) {
    if (
      byEffect.finalizationEffectId === effectId &&
      byEffect.sourceType === "INTERNAL_TRANSACTION" &&
      byEffect.sourceId === transactionId &&
      byEffect.matchedTransactionId === transactionId
    ) {
      return { kind: "EXACT", record: byEffect };
    }
  }

  return { kind: "CONFLICT" };
}

function sameAutomaticEvaluation(
  record: ReconciliationRecord,
  evaluation: EvaluationResult
): boolean {
  return (
    record.status === evaluation.status &&
    record.discrepancyCentavos === evaluation.discrepancyCentavos &&
    record.discrepancyNotes === evaluation.discrepancyNotes &&
    record.reconciledBy === null &&
    record.reconciledAt !== null
  );
}

function resultFromRecord(
  record: ReconciliationRecord,
  isReplay: boolean
): ExecuteReconciliationEffectResult {
  if (record.status === "MANUALLY_RESOLVED") {
    return { outcome: "MANUALLY_RESOLVED", record, isReplay: true };
  }
  if (record.status === "MATCHED") {
    return { outcome: "MATCHED", record, isReplay };
  }
  if (
    record.status === "MISSING" ||
    record.status === "MISMATCHED" ||
    record.status === "DUPLICATE"
  ) {
    return {
      outcome: "DISCREPANCY",
      record,
      status: record.status,
      isReplay,
    };
  }
  fail("RECONCILIATION_IDENTITY_CONFLICT", "Reconciliation record has unsupported automatic status.");
}

function isReconciliationIdentityP2002Error(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    readonly code?: unknown;
    readonly meta?: { readonly target?: unknown };
  };
  if (candidate.code !== "P2002" || !candidate.meta) return false;
  const target = candidate.meta.target;
  if (Array.isArray(target)) {
    return target.length === 1 && String(target[0]) === "finalizationEffectId";
  }
  return target === "ReconciliationRecord_finalizationEffectId_key";
}

function normalizeExecutionError(error: unknown): never {
  if (error instanceof ReconciliationExecutionError) {
    throw error;
  }
  if (isReconciliationIdentityP2002Error(error)) {
    fail(
      "CONCURRENT_IDENTITY_CONFLICT",
      "A concurrent reconciliation identity collision requires a new transaction retry."
    );
  }
  fail(
    "DATABASE_EXECUTION_FAILED",
    "Internal reconciliation failed without exposing database internals."
  );
}

export class IdempotentReconciliationService {
  static async executeReconciliationEffect(
    params: ExecuteReconciliationEffectParams
  ): Promise<ExecuteReconciliationEffectResult> {
    const transactionId = requireInputTransactionIdentifier(params.transactionId);
    const effectId = requireInputEffectIdentifier(params.reconciliationEffectId);

    try {
      if (params.tx) {
        return await this.executeInsideTransaction(transactionId, effectId, params.tx);
      }
      return await prisma.$transaction((tx) =>
        this.executeInsideTransaction(transactionId, effectId, tx)
      );
    } catch (error: unknown) {
      return normalizeExecutionError(error);
    }
  }

  private static async executeInsideTransaction(
    transactionId: string,
    effectId: string,
    client: Prisma.TransactionClient
  ): Promise<ExecuteReconciliationEffectResult> {
    // Global P1-001 ordering: transaction root -> reconciliation effect -> reconciliation operation.
    await acquireAdvisoryLock(client, transactionId);
    await acquireAdvisoryLock(client, `reconciliation:effect:${effectId}`);
    const operationKey = buildPaymentFinalizationOperationKey(transactionId, {
      kind: "RECONCILIATION",
    });
    await acquireAdvisoryLock(client, `reconciliation:operation:${operationKey}`);

    const preliminaryEffect = await loadReconciliationEffect(client, effectId);
    if (!preliminaryEffect) {
      fail("EFFECT_NOT_FOUND", "The requested reconciliation effect was not found.");
    }

    await lockEffectRow(client, effectId);
    await lockFinalizationRow(client, preliminaryEffect.finalizationId);

    const preliminarySiblings = await client.paymentFinalizationEffect.findMany({
      where: {
        finalizationId: preliminaryEffect.finalizationId,
        id: { not: effectId },
      },
      orderBy: [{ effectType: "asc" }, { effectKey: "asc" }, { id: "asc" }],
    });
    await lockSiblingRows(
      client,
      preliminarySiblings.map((sibling) => sibling.id)
    );

    const effect = await loadReconciliationEffect(client, effectId);
    if (!effect) {
      fail("EFFECT_NOT_FOUND", "The requested reconciliation effect was not found.");
    }
    const intent = parseReconciliationIntent(effect);
    const { replayOnly } = validateReconciliationEffectAndParent(
      effect,
      intent,
      transactionId
    );

    const siblings = await client.paymentFinalizationEffect.findMany({
      where: {
        finalizationId: effect.finalizationId,
        id: { not: effectId },
      },
      orderBy: [{ effectType: "asc" }, { effectKey: "asc" }, { id: "asc" }],
    });

    if (siblings.length !== preliminarySiblings.length) {
      fail("SIBLING_INTENT_INVALID", "Sibling effect set changed during reconciliation locking.");
    }
    const preliminaryIds = preliminarySiblings.map((sibling) => sibling.id).sort();
    const authoritativeIds = siblings.map((sibling) => sibling.id).sort();
    if (preliminaryIds.some((id, index) => id !== authoritativeIds[index])) {
      fail("SIBLING_INTENT_INVALID", "Sibling effect identity set changed during reconciliation.");
    }

    validateSiblingTopology(siblings);

    const parsed = new Map<string, ParsedSiblingIntent>();
    for (const sibling of siblings) {
      const parsedIntent = parseSiblingIntent(sibling, effect.finalization);
      validateSiblingTerminality(sibling, parsedIntent);
      parsed.set(sibling.id, parsedIntent);
    }
    validateParsedSiblingRelationships(siblings, parsed);

    const preliminaryIdentity = await readReconciliationIdentity(
      client,
      effectId,
      transactionId
    );
    await lockReconciliationRows(
      client,
      [
        preliminaryIdentity.byEffect?.id,
        ...preliminaryIdentity.bySource.map((record) => record.id),
      ].filter((value): value is string => typeof value === "string")
    );
    const identityState = await readReconciliationIdentity(client, effectId, transactionId);
    const identity = classifyReconciliationIdentity(identityState, transactionId, effectId);

    if (identity.kind === "DUPLICATE" || identity.kind === "CONFLICT") {
      fail(
        "RECONCILIATION_IDENTITY_CONFLICT",
        "Reconciliation effect/source identities resolve to an inconsistent state."
      );
    }

    if (identity.kind === "LEGACY") {
      const legacyClassification = classifyLegacyReconciliationRecord(
        identity.record,
        transactionId
      );
      if (legacyClassification.outcome === "IDENTITY_CONFLICT") {
        fail(
          "RECONCILIATION_IDENTITY_CONFLICT",
          "Legacy reconciliation identity is inconsistent with the requested transaction."
        );
      }
      if (legacyClassification.outcome === "MANUAL_REVIEW_REQUIRED") {
        fail(
          "LEGACY_RECONCILIATION_REQUIRES_CLASSIFICATION",
          "Legacy reconciliation provenance requires explicit manual classification."
        );
      }
      if (replayOnly) {
        fail(
          "INVALID_LIFECYCLE",
          "Replay-only reconciliation lifecycle cannot adopt a legacy reconciliation row."
        );
      }
    }

    if (identity.kind === "EXACT" && identity.record.status === "MANUALLY_RESOLVED") {
      return {
        outcome: "MANUALLY_RESOLVED",
        record: identity.record,
        isReplay: true,
      };
    }

    if (identity.kind === "EXACT" && identity.record.status === "PENDING") {
      fail(
        "RECONCILIATION_IDENTITY_CONFLICT",
        "Automatic durable reconciliation records must never persist PENDING status."
      );
    }

    const evaluation = await evaluateAllEvidence(
      client,
      siblings,
      parsed,
      effect.finalization
    );

    if (identity.kind === "LEGACY") {
      const reconciledAt = new Date();
      if (!Number.isFinite(reconciledAt.getTime())) {
        fail("DATABASE_EXECUTION_FAILED", "Unable to obtain reconciliation audit timestamp.");
      }

      try {
        const adopted = await client.reconciliationRecord.update({
          where: { id: identity.record.id },
          data: {
            finalizationEffectId: effectId,
            status: evaluation.status,
            discrepancyCentavos: evaluation.discrepancyCentavos,
            discrepancyNotes: evaluation.discrepancyNotes,
            reconciledBy: null,
            reconciledAt,
          },
        });
        return resultFromRecord(adopted, false);
      } catch (error: unknown) {
        if (isReconciliationIdentityP2002Error(error)) {
          fail(
            "CONCURRENT_IDENTITY_CONFLICT",
            "Concurrent legacy reconciliation adoption requires a new transaction retry."
          );
        }
        throw error;
      }
    }

    if (identity.kind === "EXACT") {
      if (identity.record.reconciledBy !== null) {
        fail(
          "RECONCILIATION_IDENTITY_CONFLICT",
          "Automatic reconciliation record unexpectedly contains a human reconciler."
        );
      }

      if (sameAutomaticEvaluation(identity.record, evaluation)) {
        return resultFromRecord(identity.record, true);
      }

      if (replayOnly) {
        fail(
          "INVALID_LIFECYCLE",
          "Completed reconciliation lifecycle does not match its persisted reconciliation record."
        );
      }

      const reconciledAt = new Date();
      if (!Number.isFinite(reconciledAt.getTime())) {
        fail("DATABASE_EXECUTION_FAILED", "Unable to obtain reconciliation audit timestamp.");
      }
      const updated = await client.reconciliationRecord.update({
        where: { id: identity.record.id },
        data: {
          status: evaluation.status,
          discrepancyCentavos: evaluation.discrepancyCentavos,
          discrepancyNotes: evaluation.discrepancyNotes,
          reconciledBy: null,
          reconciledAt,
        },
      });
      return resultFromRecord(updated, false);
    }

    if (replayOnly) {
      fail(
        "INVALID_LIFECYCLE",
        "Completed reconciliation lifecycle has no equivalent reconciliation record to replay."
      );
    }

    const reconciledAt = new Date();
    if (!Number.isFinite(reconciledAt.getTime())) {
      fail("DATABASE_EXECUTION_FAILED", "Unable to obtain reconciliation audit timestamp.");
    }

    try {
      const created = await client.reconciliationRecord.create({
        data: {
          sourceType: "INTERNAL_TRANSACTION",
          sourceId: transactionId,
          matchedTransactionId: transactionId,
          finalizationEffectId: effectId,
          status: evaluation.status,
          discrepancyCentavos: evaluation.discrepancyCentavos,
          discrepancyNotes: evaluation.discrepancyNotes,
          reconciledBy: null,
          reconciledAt,
        },
      });
      return resultFromRecord(created, false);
    } catch (error: unknown) {
      if (isReconciliationIdentityP2002Error(error)) {
        fail(
          "CONCURRENT_IDENTITY_CONFLICT",
          "Concurrent ReconciliationRecord identity collision requires a new transaction retry."
        );
      }
      throw error;
    }
  }
}
