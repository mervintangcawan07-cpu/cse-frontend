// Relative Path: src/lib/accounting/idempotentPartnerCommissionService.ts
/**
 * Dormant payment-finalization partner commission and liability executor (P1-001 / Slice 5).
 *
 * This primitive consumes one coupled pair of persisted immutable effects:
 *   - PARTNER_COMMISSION
 *   - PARTNER_LIABILITY_LEDGER
 *
 * It guarantees:
 *   1. Immutable manifest authority.
 *   2. Exact intent/hash verification.
 *   3. Atomic PartnerCommission + balanced liability ledger creation.
 *   4. Deterministic replay without duplicate commission or ledger entries.
 *   5. Fail-closed detection of partial/split state.
 *   6. Concurrency safety under transaction and domain advisory locks.
 *   7. Caller-owned and self-owned transaction support.
 *   8. Zero external side effects (no email, no notifications, no external APIs).
 *   9. Zero production callers / strictly dormant.
 */

import {
  Prisma,
  type FinancialLedgerEntry,
  type PartnerCommission,
} from "@prisma/client";
import { prisma } from "../prisma";
import {
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
  validateIsoUtcTimestamp,
  validateTransactionId,
} from "../payment/paymentFinalizationContracts";
import type { AccountCategory, PartnerCommissionModel } from "./types";
import {
  IdempotentLedgerService,
  IdempotentLedgerError,
  LedgerConcurrentIdentityConflictError,
  LedgerInconsistentStateError,
  LedgerIdempotencyMismatchError,
  InvalidLedgerAmountError,
  InvalidLedgerCurrencyError,
  InvalidLedgerEffectiveDateError,
  InvalidLedgerOperationKeyError,
  InvalidLedgerOperationMismatchError,
  InvalidLedgerFinalizationEffectIdError,
  InvalidLedgerTransactionIdError,
} from "./idempotentLedgerService";

const POSTGRESQL_INTEGER_MAX = 2_147_483_647;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SUPPORTED_INTENT_VERSION = 1;
const SUPPORTED_MANIFEST_VERSION = 1;
const SUPPORTED_MANIFEST_REVISION = 1;
const IDENTIFIER_MAX_LENGTH = 128;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const PERSISTED_PARTNER_COMMISSION_MODELS = [
  "PERCENTAGE_OF_GROSS",
  "PERCENTAGE_OF_CUSTOMER_PAYMENT",
  "PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS",
  "FIXED_PER_PURCHASE",
  "FIXED_PER_REFERRAL",
  "CUSTOM_RULE",
] as const satisfies readonly PartnerCommissionModel[];

export interface ExecutePartnerCommissionAndLiabilityParams {
  readonly transactionId: string;
  readonly commissionEffectId: string;
  readonly liabilityEffectId: string;
  readonly tx?: Prisma.TransactionClient;
}

export type V1PartnerCommissionNotApplicableReason =
  | "NO_PARTNER_ATTRIBUTION"
  | "INACTIVE_PARTNER"
  | "ZERO_COMMISSION_CALCULATED";

export type ExecutePartnerCommissionAndLiabilityResult =
  | {
      readonly outcome: "CREATED";
      readonly commission: PartnerCommission;
      readonly debitEntry: FinancialLedgerEntry;
      readonly creditEntry: FinancialLedgerEntry;
      readonly isReplay: false;
    }
  | {
      readonly outcome: "REPLAY";
      readonly commission: PartnerCommission;
      readonly debitEntry: FinancialLedgerEntry;
      readonly creditEntry: FinancialLedgerEntry;
      readonly isReplay: true;
    }
  | {
      readonly outcome: "NOT_APPLICABLE";
      readonly commission: null;
      readonly debitEntry: null;
      readonly creditEntry: null;
      readonly reason: V1PartnerCommissionNotApplicableReason;
    };

export type PartnerCommissionExecutionErrorCode =
  | "EFFECT_NOT_FOUND"
  | "WRONG_EFFECT_TYPE"
  | "UNSUPPORTED_INTENT_VERSION"
  | "INTENT_HASH_MISMATCH"
  | "MANIFEST_LINKAGE_MISMATCH"
  | "TRANSACTION_IDENTITY_MISMATCH"
  | "PARTNER_NOT_FOUND"
  | "PARTNER_IDENTITY_MISMATCH"
  | "PAIR_IDENTITY_MISMATCH"
  | "PAIR_STATE_MISMATCH"
  | "PARTNER_COMMISSION_IDENTITY_CONFLICT"
  | "PARTNER_COMMISSION_PARTIAL_STATE"
  | "LEGACY_COMMISSION_REQUIRES_CLASSIFICATION"
  | "LEDGER_IDENTITY_CONFLICT"
  | "CONCURRENT_IDENTITY_CONFLICT"
  | "INVALID_IMMUTABLE_INTENT"
  | "INVALID_LIFECYCLE"
  | "DATABASE_EXECUTION_FAILED";

export class PartnerCommissionExecutionError extends Error {
  public readonly code: PartnerCommissionExecutionErrorCode;

  constructor(code: PartnerCommissionExecutionErrorCode, message: string) {
    super(message);
    this.name = "PartnerCommissionExecutionError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type LoadedEffect = Prisma.PaymentFinalizationEffectGetPayload<{
  include: {
    finalization: {
      include: {
        transaction: true;
      };
    };
  };
}>;

interface ActivePartnerCommissionIntent {
  readonly effectType: "PARTNER_COMMISSION";
  readonly intentVersion: 1;
  readonly status: "PENDING";
  readonly partnerId: string;
  readonly partnerCode: string;
  readonly commissionModel:
    | "PERCENTAGE_OF_CUSTOMER_PAYMENT"
    | "PERCENTAGE_OF_GROSS"
    | "FIXED_PER_PURCHASE";
  readonly commissionRateBasisPoints: number;
  readonly calculationBasis: "CUSTOMER_PAYMENT" | "GROSS_PRICE" | "FIXED_AMOUNT";
  readonly baseAmountCentavos: number | null;
  readonly commissionAmountCentavos: number;
  readonly currency: "PHP";
  readonly campaignSource: string | null;
  readonly holdingPeriodDays: number;
  readonly holdingUntil: string;
}

interface NotApplicablePartnerCommissionIntent {
  readonly effectType: "PARTNER_COMMISSION";
  readonly intentVersion: 1;
  readonly status: "NOT_APPLICABLE";
  readonly notApplicableReason: V1PartnerCommissionNotApplicableReason;
  readonly partnerId: string | null;
  readonly partnerCode: string | null;
  readonly commissionModel: PartnerCommissionModel | null;
  readonly commissionRateBasisPoints: number | null;
  readonly calculationBasis:
    | "CUSTOMER_PAYMENT"
    | "GROSS_PRICE"
    | "FIXED_AMOUNT"
    | null;
  readonly baseAmountCentavos: number | null;
  readonly commissionAmountCentavos: 0;
  readonly currency: "PHP";
  readonly campaignSource: string | null;
  readonly holdingPeriodDays: number | null;
  readonly holdingUntil: null;
}

type ParsedPartnerCommissionIntent =
  | ActivePartnerCommissionIntent
  | NotApplicablePartnerCommissionIntent;

interface ActivePartnerLiabilityIntent {
  readonly effectType: "PARTNER_LIABILITY_LEDGER";
  readonly intentVersion: 1;
  readonly status: "PENDING";
  readonly partnerId: string;
  readonly amountCentavos: number;
  readonly debitCategory: Extract<AccountCategory, "EXPENSE_PARTNER">;
  readonly creditCategory: Extract<AccountCategory, "LIABILITY_PARTNER_PAYABLE">;
}

interface NotApplicablePartnerLiabilityIntent {
  readonly effectType: "PARTNER_LIABILITY_LEDGER";
  readonly intentVersion: 1;
  readonly status: "NOT_APPLICABLE";
  readonly notApplicableReason: "NO_PARTNER_COMMISSION";
  readonly partnerId: string | null;
  readonly amountCentavos: 0;
  readonly debitCategory: null;
  readonly creditCategory: null;
}

type ParsedPartnerLiabilityIntent =
  | ActivePartnerLiabilityIntent
  | NotApplicablePartnerLiabilityIntent;

interface CommissionIdentityState {
  readonly byTransaction: PartnerCommission | null;
  readonly byEffect: PartnerCommission | null;
}

type ClassifiedCommissionIdentity =
  | { readonly kind: "NONE" }
  | { readonly kind: "EXACT"; readonly commission: PartnerCommission }
  | { readonly kind: "LEGACY"; readonly commission: PartnerCommission }
  | { readonly kind: "CONFLICT" };

type ClassifiedLedgerIdentity =
  | { readonly kind: "NONE" }
  | {
      readonly kind: "EXACT";
      readonly debitEntry: FinancialLedgerEntry;
      readonly creditEntry: FinancialLedgerEntry;
    }
  | { readonly kind: "CONFLICT" };

const ACTIVE_COMMISSION_INTENT_KEYS = [
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

const NOT_APPLICABLE_COMMISSION_INTENT_KEYS = [
  ...ACTIVE_COMMISSION_INTENT_KEYS,
  "notApplicableReason",
].sort() as readonly string[];

const ACTIVE_LIABILITY_INTENT_KEYS = [
  "amountCentavos",
  "creditCategory",
  "debitCategory",
  "effectType",
  "intentVersion",
  "partnerId",
  "status",
] as const;

const NOT_APPLICABLE_LIABILITY_INTENT_KEYS = [
  ...ACTIVE_LIABILITY_INTENT_KEYS,
  "notApplicableReason",
].sort() as readonly string[];

const APPROVED_COMMISSION_P2002_FIELDS = new Set([
  "transactionId",
  "finalizationEffectId",
]);

const APPROVED_COMMISSION_P2002_CONSTRAINTS = new Set([
  "PartnerCommission_transactionId_key",
  "PartnerCommission_finalizationEffectId_key",
]);

function fail(
  code: PartnerCommissionExecutionErrorCode,
  message: string
): never {
  throw new PartnerCommissionExecutionError(code, message);
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
  expectedKeys: readonly string[]
): void {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Persisted partner intent does not match the exact supported v1 shape."
    );
  }
}

function requireExactIdentifier(value: unknown, fieldName: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > IDENTIFIER_MAX_LENGTH ||
    value !== value.trim()
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} is not a valid exact persisted identifier.`
    );
  }
  return value;
}

function requireInputEffectIdentifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > IDENTIFIER_MAX_LENGTH ||
    value !== value.trim()
  ) {
    fail("EFFECT_NOT_FOUND", "The requested finalization effect was not found.");
  }
  return value;
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

  let validated: string;
  try {
    validated = validateTransactionId(value);
  } catch {
    fail(
      "TRANSACTION_IDENTITY_MISMATCH",
      "The requested transactionId is not an exact canonical identifier."
    );
  }

  if (validated !== value) {
    fail(
      "TRANSACTION_IDENTITY_MISMATCH",
      "The requested transactionId is not an exact canonical identifier."
    );
  }

  return validated;
}

function isPersistedPartnerCommissionModel(
  value: unknown
): value is PartnerCommissionModel {
  return (
    typeof value === "string" &&
    PERSISTED_PARTNER_COMMISSION_MODELS.some((model) => model === value)
  );
}

function requirePositivePostgresInteger(
  value: unknown,
  fieldName: string
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > POSTGRESQL_INTEGER_MAX
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} must be a positive PostgreSQL-compatible integer.`
    );
  }
  return value;
}

function requireNonNegativeSafeInteger(
  value: unknown,
  fieldName: string
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} must be a nonnegative safe integer.`
    );
  }
  return value;
}

function requireBasisPoints(value: unknown): number {
  const basisPoints = requireNonNegativeSafeInteger(
    value,
    "commissionRateBasisPoints"
  );
  if (basisPoints > 10_000) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "commissionRateBasisPoints exceeds the supported range (0..10000)."
    );
  }
  return basisPoints;
}

function requireCanonicalIso(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    fail("INVALID_IMMUTABLE_INTENT", `${fieldName} must be a timestamp string.`);
  }

  let normalized: string | null;
  try {
    normalized = validateIsoUtcTimestamp(value, fieldName, false);
  } catch {
    fail("INVALID_IMMUTABLE_INTENT", `${fieldName} is not a valid UTC timestamp.`);
  }

  if (normalized === null || normalized !== value) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} must be an exact canonical UTC ISO timestamp.`
    );
  }
  return normalized;
}

function isPartnerCommissionP2002Error(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const prismaError = error as { code?: string; meta?: { target?: unknown } };
  if (prismaError.code !== "P2002" || !prismaError.meta) return false;

  const target = prismaError.meta.target;

  if (Array.isArray(target)) {
    if (target.length !== 1) return false;
    return APPROVED_COMMISSION_P2002_FIELDS.has(String(target[0]));
  }

  if (typeof target === "string") {
    return APPROVED_COMMISSION_P2002_CONSTRAINTS.has(target);
  }

  return false;
}

function normalizeLedgerError(error: unknown): never {
  if (error instanceof LedgerConcurrentIdentityConflictError) {
    fail("CONCURRENT_IDENTITY_CONFLICT", error.message);
  }
  if (
    error instanceof LedgerInconsistentStateError ||
    error instanceof LedgerIdempotencyMismatchError
  ) {
    fail("LEDGER_IDENTITY_CONFLICT", error.message);
  }
  if (
    error instanceof InvalidLedgerAmountError ||
    error instanceof InvalidLedgerCurrencyError ||
    error instanceof InvalidLedgerEffectiveDateError
  ) {
    fail("INVALID_IMMUTABLE_INTENT", error.message);
  }
  if (
    error instanceof InvalidLedgerOperationKeyError ||
    error instanceof InvalidLedgerOperationMismatchError ||
    error instanceof InvalidLedgerFinalizationEffectIdError ||
    error instanceof InvalidLedgerTransactionIdError
  ) {
    fail("MANIFEST_LINKAGE_MISMATCH", error.message);
  }
  if (error instanceof PartnerCommissionExecutionError) {
    throw error;
  }
  fail(
    "DATABASE_EXECUTION_FAILED",
    "Database execution failed during partner liability ledger execution."
  );
}

function normalizeExecutionError(error: unknown): never {
  if (error instanceof PartnerCommissionExecutionError) {
    throw error;
  }
  if (error instanceof IdempotentLedgerError) {
    normalizeLedgerError(error);
  }
  if (isPartnerCommissionP2002Error(error)) {
    fail(
      "CONCURRENT_IDENTITY_CONFLICT",
      "A concurrent execution established a partner commission identity."
    );
  }
  fail(
    "DATABASE_EXECUTION_FAILED",
    "Database execution failed during partner commission execution."
  );
}

function parseAndValidateCommissionIntent(
  effect: LoadedEffect
): ParsedPartnerCommissionIntent {
  if (effect.effectType !== "PARTNER_COMMISSION") {
    fail("WRONG_EFFECT_TYPE", "Effect is not a PARTNER_COMMISSION effect.");
  }
  if (effect.intentVersion !== SUPPORTED_INTENT_VERSION) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      `Unsupported intent version ${effect.intentVersion}.`
    );
  }
  if (
    typeof effect.intentHash !== "string" ||
    !HASH_PATTERN.test(effect.intentHash)
  ) {
    fail("INTENT_HASH_MISMATCH", "Stored commission intent hash is malformed.");
  }

  const raw = effect.intent;
  if (!isRecord(raw)) {
    fail("INVALID_IMMUTABLE_INTENT", "Commission intent is not a valid JSON object.");
  }

  if (raw.intentVersion !== SUPPORTED_INTENT_VERSION) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      "Commission intent internal version is not supported."
    );
  }
  if (raw.effectType !== "PARTNER_COMMISSION") {
    fail("WRONG_EFFECT_TYPE", "Commission intent internal effectType mismatch.");
  }
  if (raw.currency !== "PHP") {
    fail("INVALID_IMMUTABLE_INTENT", "Commission currency must be PHP.");
  }

  const canonicalString = canonicalizeJson(raw);
  const recomputedHash = computeSha256Hash(canonicalString);
  if (recomputedHash !== effect.intentHash) {
    fail("INTENT_HASH_MISMATCH", "Commission intent hash verification failed.");
  }

  const status = raw.status;
  if (status !== "PENDING" && status !== "NOT_APPLICABLE") {
    fail("INVALID_IMMUTABLE_INTENT", "Unsupported commission intent status.");
  }

  if (status === "PENDING") {
    requireExactKeys(raw, ACTIVE_COMMISSION_INTENT_KEYS);
    if ("notApplicableReason" in raw) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "Active commission intent must not contain notApplicableReason."
      );
    }

    const partnerId = requireExactIdentifier(raw.partnerId, "partnerId");
    const partnerCode =
      typeof raw.partnerCode === "string" && raw.partnerCode.length > 0
        ? raw.partnerCode
        : fail("INVALID_IMMUTABLE_INTENT", "partnerCode must be a non-empty string.");

    const commissionModel = raw.commissionModel;
    if (
      commissionModel !== "PERCENTAGE_OF_CUSTOMER_PAYMENT" &&
      commissionModel !== "PERCENTAGE_OF_GROSS" &&
      commissionModel !== "FIXED_PER_PURCHASE"
    ) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "Active commission intent contains an unsupported commission model."
      );
    }

    const campaignSource =
      raw.campaignSource === null || typeof raw.campaignSource === "string"
        ? raw.campaignSource
        : fail("INVALID_IMMUTABLE_INTENT", "campaignSource must be a string or null.");

    const holdingPeriodDays = requireNonNegativeSafeInteger(
      raw.holdingPeriodDays,
      "holdingPeriodDays"
    );
    const holdingUntil = requireCanonicalIso(raw.holdingUntil, "holdingUntil");

    if (commissionModel === "FIXED_PER_PURCHASE") {
      if (raw.commissionRateBasisPoints !== 0) {
        fail(
          "INVALID_IMMUTABLE_INTENT",
          "FIXED_PER_PURCHASE commissionRateBasisPoints must be exactly 0."
        );
      }
      if (raw.calculationBasis !== "FIXED_AMOUNT") {
        fail(
          "INVALID_IMMUTABLE_INTENT",
          "FIXED_PER_PURCHASE calculationBasis must be FIXED_AMOUNT."
        );
      }
      if (raw.baseAmountCentavos !== null) {
        fail(
          "INVALID_IMMUTABLE_INTENT",
          "FIXED_PER_PURCHASE baseAmountCentavos must be null."
        );
      }
      const commissionAmountCentavos = requirePositivePostgresInteger(
        raw.commissionAmountCentavos,
        "commissionAmountCentavos"
      );

      return {
        effectType: "PARTNER_COMMISSION",
        intentVersion: 1,
        status: "PENDING",
        partnerId,
        partnerCode,
        commissionModel: "FIXED_PER_PURCHASE",
        commissionRateBasisPoints: 0,
        calculationBasis: "FIXED_AMOUNT",
        baseAmountCentavos: null,
        commissionAmountCentavos,
        currency: "PHP",
        campaignSource,
        holdingPeriodDays,
        holdingUntil,
      };
    }

    // Percentage models
    const commissionRateBasisPoints = requireBasisPoints(
      raw.commissionRateBasisPoints
    );
    const calculationBasis = raw.calculationBasis;
    if (
      commissionModel === "PERCENTAGE_OF_CUSTOMER_PAYMENT" &&
      calculationBasis !== "CUSTOMER_PAYMENT"
    ) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "PERCENTAGE_OF_CUSTOMER_PAYMENT calculationBasis must be CUSTOMER_PAYMENT."
      );
    }
    if (
      commissionModel === "PERCENTAGE_OF_GROSS" &&
      calculationBasis !== "GROSS_PRICE"
    ) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "PERCENTAGE_OF_GROSS calculationBasis must be GROSS_PRICE."
      );
    }

    const baseAmountCentavos = requirePositivePostgresInteger(
      raw.baseAmountCentavos,
      "baseAmountCentavos"
    );
    const commissionAmountCentavos = requirePositivePostgresInteger(
      raw.commissionAmountCentavos,
      "commissionAmountCentavos"
    );

    const canonicalPercentage = commissionRateBasisPoints / 100;
    const expectedCommission = Math.round(
      (baseAmountCentavos * canonicalPercentage) / 100
    );

    if (commissionAmountCentavos !== expectedCommission) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "Commission amount does not match the canonical percentage arithmetic."
      );
    }

    return {
      effectType: "PARTNER_COMMISSION",
      intentVersion: 1,
      status: "PENDING",
      partnerId,
      partnerCode,
      commissionModel,
      commissionRateBasisPoints,
      calculationBasis:
        calculationBasis as "CUSTOMER_PAYMENT" | "GROSS_PRICE",
      baseAmountCentavos,
      commissionAmountCentavos,
      currency: "PHP",
      campaignSource,
      holdingPeriodDays,
      holdingUntil,
    };
  }

  // status === "NOT_APPLICABLE"
  requireExactKeys(raw, NOT_APPLICABLE_COMMISSION_INTENT_KEYS);
  const reason = raw.notApplicableReason;
  if (
    reason !== "NO_PARTNER_ATTRIBUTION" &&
    reason !== "INACTIVE_PARTNER" &&
    reason !== "ZERO_COMMISSION_CALCULATED"
  ) {
    fail("INVALID_IMMUTABLE_INTENT", "Unsupported notApplicableReason.");
  }

  if (raw.commissionAmountCentavos !== 0) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Not-applicable commission intent must have commissionAmountCentavos equal to 0."
    );
  }
  if (raw.holdingUntil !== null) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Not-applicable commission intent must have holdingUntil null."
    );
  }

  const campaignSource =
    raw.campaignSource === null || typeof raw.campaignSource === "string"
      ? raw.campaignSource
      : fail("INVALID_IMMUTABLE_INTENT", "campaignSource must be a string or null.");

  if (reason === "NO_PARTNER_ATTRIBUTION") {
    if (
      raw.partnerId !== null ||
      raw.partnerCode !== null ||
      raw.commissionModel !== null ||
      raw.commissionRateBasisPoints !== null ||
      raw.calculationBasis !== null ||
      raw.baseAmountCentavos !== null ||
      raw.holdingPeriodDays !== null
    ) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "NO_PARTNER_ATTRIBUTION must have null partner, financial, and holding fields."
      );
    }

    return {
      effectType: "PARTNER_COMMISSION",
      intentVersion: 1,
      status: "NOT_APPLICABLE",
      notApplicableReason: "NO_PARTNER_ATTRIBUTION",
      partnerId: null,
      partnerCode: null,
      commissionModel: null,
      commissionRateBasisPoints: null,
      calculationBasis: null,
      baseAmountCentavos: null,
      commissionAmountCentavos: 0,
      currency: "PHP",
      campaignSource,
      holdingPeriodDays: null,
      holdingUntil: null,
    };
  }

  if (reason === "INACTIVE_PARTNER") {
    const partnerId = requireExactIdentifier(raw.partnerId, "partnerId");
    const partnerCode =
      typeof raw.partnerCode === "string" && raw.partnerCode.length > 0
        ? raw.partnerCode
        : fail("INVALID_IMMUTABLE_INTENT", "partnerCode must be a non-empty string.");

    const commissionModel = isPersistedPartnerCommissionModel(raw.commissionModel)
      ? raw.commissionModel
      : fail(
          "INVALID_IMMUTABLE_INTENT",
          "INACTIVE_PARTNER must preserve a valid persisted commissionModel."
        );

    if (
      raw.commissionRateBasisPoints !== null ||
      raw.calculationBasis !== null ||
      raw.baseAmountCentavos !== null ||
      raw.holdingPeriodDays !== null
    ) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "INACTIVE_PARTNER must have null financial calculation fields."
      );
    }

    return {
      effectType: "PARTNER_COMMISSION",
      intentVersion: 1,
      status: "NOT_APPLICABLE",
      notApplicableReason: "INACTIVE_PARTNER",
      partnerId,
      partnerCode,
      commissionModel,
      commissionRateBasisPoints: null,
      calculationBasis: null,
      baseAmountCentavos: null,
      commissionAmountCentavos: 0,
      currency: "PHP",
      campaignSource,
      holdingPeriodDays: null,
      holdingUntil: null,
    };
  }

  // reason === "ZERO_COMMISSION_CALCULATED"
  const partnerId = requireExactIdentifier(raw.partnerId, "partnerId");
  const partnerCode =
    typeof raw.partnerCode === "string" && raw.partnerCode.length > 0
      ? raw.partnerCode
      : fail("INVALID_IMMUTABLE_INTENT", "partnerCode must be a non-empty string.");

  const commissionModel = raw.commissionModel;
  if (
    commissionModel !== "PERCENTAGE_OF_CUSTOMER_PAYMENT" &&
    commissionModel !== "PERCENTAGE_OF_GROSS" &&
    commissionModel !== "FIXED_PER_PURCHASE"
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "ZERO_COMMISSION_CALCULATED requires a supported active commission model."
    );
  }

  if (typeof campaignSource !== "string" || campaignSource.length === 0) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "ZERO_COMMISSION_CALCULATED must contain a non-empty campaignSource string."
    );
  }

  const holdingPeriodDays = requireNonNegativeSafeInteger(
    raw.holdingPeriodDays,
    "holdingPeriodDays"
  );

  if (commissionModel === "FIXED_PER_PURCHASE") {
    if (raw.commissionRateBasisPoints !== 0) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "ZERO_COMMISSION_CALCULATED fixed model commissionRateBasisPoints must be 0."
      );
    }
    if (raw.calculationBasis !== "FIXED_AMOUNT") {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "ZERO_COMMISSION_CALCULATED fixed model calculationBasis must be FIXED_AMOUNT."
      );
    }
    if (raw.baseAmountCentavos !== null) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "ZERO_COMMISSION_CALCULATED fixed model baseAmountCentavos must be null."
      );
    }

    return {
      effectType: "PARTNER_COMMISSION",
      intentVersion: 1,
      status: "NOT_APPLICABLE",
      notApplicableReason: "ZERO_COMMISSION_CALCULATED",
      partnerId,
      partnerCode,
      commissionModel: "FIXED_PER_PURCHASE",
      commissionRateBasisPoints: 0,
      calculationBasis: "FIXED_AMOUNT",
      baseAmountCentavos: null,
      commissionAmountCentavos: 0,
      currency: "PHP",
      campaignSource,
      holdingPeriodDays,
      holdingUntil: null,
    };
  }

  // Percentage zero commission
  const commissionRateBasisPoints = requireBasisPoints(
    raw.commissionRateBasisPoints
  );
  const calculationBasis = raw.calculationBasis;
  if (
    commissionModel === "PERCENTAGE_OF_CUSTOMER_PAYMENT" &&
    calculationBasis !== "CUSTOMER_PAYMENT"
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "PERCENTAGE_OF_CUSTOMER_PAYMENT calculationBasis must be CUSTOMER_PAYMENT."
    );
  }
  if (
    commissionModel === "PERCENTAGE_OF_GROSS" &&
    calculationBasis !== "GROSS_PRICE"
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "PERCENTAGE_OF_GROSS calculationBasis must be GROSS_PRICE."
    );
  }

  const baseAmountCentavos = requirePositivePostgresInteger(
    raw.baseAmountCentavos,
    "baseAmountCentavos"
  );

  const canonicalPercentage = commissionRateBasisPoints / 100;
  const expectedZero = Math.round(
    (baseAmountCentavos * canonicalPercentage) / 100
  );
  if (expectedZero !== 0) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "ZERO_COMMISSION_CALCULATED percentage model recomputes to non-zero amount."
    );
  }

  return {
    effectType: "PARTNER_COMMISSION",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: "ZERO_COMMISSION_CALCULATED",
    partnerId,
    partnerCode,
    commissionModel,
    commissionRateBasisPoints,
    calculationBasis: calculationBasis as "CUSTOMER_PAYMENT" | "GROSS_PRICE",
    baseAmountCentavos,
    commissionAmountCentavos: 0,
    currency: "PHP",
    campaignSource,
    holdingPeriodDays,
    holdingUntil: null,
  };
}

function parseAndValidateLiabilityIntent(
  effect: LoadedEffect
): ParsedPartnerLiabilityIntent {
  if (effect.effectType !== "PARTNER_LIABILITY_LEDGER") {
    fail("WRONG_EFFECT_TYPE", "Effect is not a PARTNER_LIABILITY_LEDGER effect.");
  }
  if (effect.intentVersion !== SUPPORTED_INTENT_VERSION) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      `Unsupported intent version ${effect.intentVersion}.`
    );
  }
  if (
    typeof effect.intentHash !== "string" ||
    !HASH_PATTERN.test(effect.intentHash)
  ) {
    fail("INTENT_HASH_MISMATCH", "Stored liability intent hash is malformed.");
  }

  const raw = effect.intent;
  if (!isRecord(raw)) {
    fail("INVALID_IMMUTABLE_INTENT", "Liability intent is not a valid JSON object.");
  }

  if (raw.intentVersion !== SUPPORTED_INTENT_VERSION) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      "Liability intent internal version is not supported."
    );
  }
  if (raw.effectType !== "PARTNER_LIABILITY_LEDGER") {
    fail("WRONG_EFFECT_TYPE", "Liability intent internal effectType mismatch.");
  }

  const canonicalString = canonicalizeJson(raw);
  const recomputedHash = computeSha256Hash(canonicalString);
  if (recomputedHash !== effect.intentHash) {
    fail("INTENT_HASH_MISMATCH", "Liability intent hash verification failed.");
  }

  const status = raw.status;
  if (status !== "PENDING" && status !== "NOT_APPLICABLE") {
    fail("INVALID_IMMUTABLE_INTENT", "Unsupported liability intent status.");
  }

  if (status === "PENDING") {
    requireExactKeys(raw, ACTIVE_LIABILITY_INTENT_KEYS);
    if ("notApplicableReason" in raw) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "Active liability intent must not contain notApplicableReason."
      );
    }
    const partnerId = requireExactIdentifier(raw.partnerId, "partnerId");
    const amountCentavos = requirePositivePostgresInteger(
      raw.amountCentavos,
      "amountCentavos"
    );
    if (raw.debitCategory !== "EXPENSE_PARTNER") {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "Liability debitCategory must be EXPENSE_PARTNER."
      );
    }
    if (raw.creditCategory !== "LIABILITY_PARTNER_PAYABLE") {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "Liability creditCategory must be LIABILITY_PARTNER_PAYABLE."
      );
    }

    return {
      effectType: "PARTNER_LIABILITY_LEDGER",
      intentVersion: 1,
      status: "PENDING",
      partnerId,
      amountCentavos,
      debitCategory: "EXPENSE_PARTNER",
      creditCategory: "LIABILITY_PARTNER_PAYABLE",
    };
  }

  // status === "NOT_APPLICABLE"
  requireExactKeys(raw, NOT_APPLICABLE_LIABILITY_INTENT_KEYS);
  if (raw.notApplicableReason !== "NO_PARTNER_COMMISSION") {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Not-applicable liability intent must have reason NO_PARTNER_COMMISSION."
    );
  }
  if (raw.amountCentavos !== 0) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Not-applicable liability intent must have amountCentavos equal to 0."
    );
  }
  if (raw.debitCategory !== null || raw.creditCategory !== null) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Not-applicable liability intent must have null account categories."
    );
  }

  const partnerId =
    raw.partnerId === null
      ? null
      : requireExactIdentifier(raw.partnerId, "partnerId");

  return {
    effectType: "PARTNER_LIABILITY_LEDGER",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: "NO_PARTNER_COMMISSION",
    partnerId,
    amountCentavos: 0,
    debitCategory: null,
    creditCategory: null,
  };
}

function validatePairAndParent(
  commEffect: LoadedEffect,
  liabEffect: LoadedEffect,
  commIntent: ParsedPartnerCommissionIntent,
  liabIntent: ParsedPartnerLiabilityIntent,
  transactionId: string
): { replayOnly: boolean } {
  if (commEffect.finalizationId !== liabEffect.finalizationId) {
    fail(
      "PAIR_IDENTITY_MISMATCH",
      "Commission and liability effects do not belong to the same finalization."
    );
  }

  const finalization = commEffect.finalization;
  if (
    finalization.manifestVersion !== SUPPORTED_MANIFEST_VERSION ||
    finalization.manifestRevision !== SUPPORTED_MANIFEST_REVISION ||
    typeof finalization.manifestHash !== "string" ||
    !HASH_PATTERN.test(finalization.manifestHash)
  ) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Payment finalization manifest metadata is not a supported canonical v1 manifest."
    );
  }

  if (finalization.transactionId !== transactionId) {
    fail(
      "TRANSACTION_IDENTITY_MISMATCH",
      "Payment finalization transactionId does not match requested transactionId."
    );
  }
  if (finalization.transaction.id !== transactionId) {
    fail(
      "TRANSACTION_IDENTITY_MISMATCH",
      "Finalization transaction record does not match requested transactionId."
    );
  }

  if (commEffect.effectKey !== "partner-commission") {
    fail("MANIFEST_LINKAGE_MISMATCH", "Commission effectKey is invalid.");
  }
  if (liabEffect.effectKey !== "partner-liability") {
    fail("MANIFEST_LINKAGE_MISMATCH", "Liability effectKey is invalid.");
  }

  const expectedCommOpKey = buildPaymentFinalizationOperationKey(
    transactionId,
    { kind: "PARTNER_COMMISSION" }
  );
  if (commEffect.operationKey !== expectedCommOpKey) {
    fail("MANIFEST_LINKAGE_MISMATCH", "Commission operationKey is invalid.");
  }

  const expectedLiabOpKey = buildPaymentFinalizationOperationKey(
    transactionId,
    { kind: "PARTNER_LIABILITY" }
  );
  if (liabEffect.operationKey !== expectedLiabOpKey) {
    fail("MANIFEST_LINKAGE_MISMATCH", "Liability operationKey is invalid.");
  }

  if (commEffect.partnerId !== commIntent.partnerId) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Commission effect partnerId does not match intent partnerId."
    );
  }
  if (liabEffect.partnerId !== liabIntent.partnerId) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Liability effect partnerId does not match intent partnerId."
    );
  }
  if (commIntent.partnerId !== liabIntent.partnerId) {
    fail(
      "PAIR_IDENTITY_MISMATCH",
      "Commission and liability intents identify different partners."
    );
  }

  if (commEffect.referralId !== null || commEffect.taxConfigId !== null) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Commission effect contains foreign linkage columns."
    );
  }
  if (liabEffect.referralId !== null || liabEffect.taxConfigId !== null) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Liability effect contains foreign linkage columns."
    );
  }

  if (finalization.currency !== "PHP" || commIntent.currency !== "PHP") {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Finalization and partner intent currency must be PHP."
    );
  }

  if (
    (commIntent.status === "PENDING" ||
      commIntent.notApplicableReason === "ZERO_COMMISSION_CALCULATED") &&
    commIntent.commissionModel === "PERCENTAGE_OF_CUSTOMER_PAYMENT" &&
    commIntent.baseAmountCentavos !== finalization.purchaseAmountCentavos
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Customer-payment commission base does not match the finalization purchase amount."
    );
  }

  if (finalization.status === "MANUAL_REVIEW") {
    fail("INVALID_LIFECYCLE", "Payment finalization is in manual review.");
  }

  // Status compatibility
  if (commIntent.status !== liabIntent.status) {
    fail(
      "PAIR_STATE_MISMATCH",
      "Commission and liability intents have mismatched statuses."
    );
  }

  if (commIntent.status === "PENDING") {
    if (
      commIntent.commissionAmountCentavos !==
      (liabIntent as ActivePartnerLiabilityIntent).amountCentavos
    ) {
      fail(
        "PAIR_STATE_MISMATCH",
        "Pending commission amount does not equal pending liability amount."
      );
    }

    if (
      commEffect.status === "AWAITING_DATA" ||
      commEffect.status === "MANUAL_REVIEW" ||
      liabEffect.status === "AWAITING_DATA" ||
      liabEffect.status === "MANUAL_REVIEW"
    ) {
      fail(
        "INVALID_LIFECYCLE",
        "Partner effects are not executable in their current lifecycle state."
      );
    }

    if (
      commEffect.status === "NOT_APPLICABLE" ||
      liabEffect.status === "NOT_APPLICABLE"
    ) {
      fail(
        "INVALID_LIFECYCLE",
        "Pending partner intent has not-applicable effect lifecycle."
      );
    }

    if (
      (commEffect.status !== "PENDING" &&
        commEffect.status !== "FAILED_RETRYABLE" &&
        commEffect.status !== "COMPLETE") ||
      (liabEffect.status !== "PENDING" &&
        liabEffect.status !== "FAILED_RETRYABLE" &&
        liabEffect.status !== "COMPLETE")
    ) {
      fail("INVALID_LIFECYCLE", "Partner effect lifecycle state is inconsistent.");
    }

    return {
      replayOnly:
        commEffect.status === "COMPLETE" ||
        liabEffect.status === "COMPLETE" ||
        finalization.status === "COMPLETE",
    };
  }

  // commIntent.status === "NOT_APPLICABLE"
  if (
    commEffect.status !== "NOT_APPLICABLE" ||
    liabEffect.status !== "NOT_APPLICABLE"
  ) {
    fail(
      "INVALID_LIFECYCLE",
      "Not-applicable partner intent has an inconsistent effect lifecycle."
    );
  }

  return { replayOnly: true };
}

function validateHoldingTime(
  finalization: LoadedEffect["finalization"],
  intent: ActivePartnerCommissionIntent
): Date {
  const verifiedTimestamp = finalization.verifiedAt.getTime();
  const holdingDuration = intent.holdingPeriodDays * MILLISECONDS_PER_DAY;
  const expectedTimestamp = verifiedTimestamp + holdingDuration;

  if (
    !Number.isFinite(verifiedTimestamp) ||
    !Number.isSafeInteger(holdingDuration) ||
    !Number.isSafeInteger(expectedTimestamp)
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Partner holding timestamp overflows safe integer limits."
    );
  }

  const expectedDate = new Date(expectedTimestamp);
  if (
    !Number.isFinite(expectedDate.getTime()) ||
    expectedDate.toISOString() !== intent.holdingUntil
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Partner holding timestamp does not match finalization verification time."
    );
  }

  return expectedDate;
}

function validateCommissionReplay(
  commission: PartnerCommission,
  intent: ActivePartnerCommissionIntent,
  finalization: LoadedEffect["finalization"],
  transactionId: string,
  effectId: string
): void {
  if (
    commission.partnerId !== intent.partnerId ||
    commission.transactionId !== transactionId ||
    commission.finalizationEffectId !== effectId ||
    commission.purchaseAmountCentavos !== finalization.purchaseAmountCentavos ||
    commission.commissionModel !== intent.commissionModel ||
    commission.commissionAmountCentavos !== intent.commissionAmountCentavos ||
    commission.currency !== "PHP" ||
    commission.campaignSource !== intent.campaignSource ||
    commission.holdingUntil?.toISOString() !== intent.holdingUntil
  ) {
    fail(
      "PARTNER_COMMISSION_IDENTITY_CONFLICT",
      "Existing PartnerCommission row does not match immutable intent economics."
    );
  }

  const expectedEffectiveRate =
    intent.commissionModel === "FIXED_PER_PURCHASE"
      ? 0
      : intent.commissionRateBasisPoints / 100;

  if (commission.effectiveRate !== expectedEffectiveRate) {
    fail(
      "PARTNER_COMMISSION_IDENTITY_CONFLICT",
      "Existing PartnerCommission effectiveRate does not match intent rate."
    );
  }
}

async function acquireAdvisoryLock(
  client: Prisma.TransactionClient,
  lockName: string
): Promise<void> {
  await client.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${lockName}, 0)
    )::text AS lock_result
  `;
}

async function lockEffectRows(
  client: Prisma.TransactionClient,
  effectIds: readonly string[]
): Promise<void> {
  for (const effectId of [...new Set(effectIds)].sort()) {
    await client.$queryRaw`
      SELECT "id"
      FROM "PaymentFinalizationEffect"
      WHERE "id" = ${effectId}
      FOR UPDATE
    `;
  }
}

async function lockCommissionRows(
  client: Prisma.TransactionClient,
  commissionIds: readonly string[]
): Promise<void> {
  for (const id of [...new Set(commissionIds)].sort()) {
    await client.$queryRaw`
      SELECT "id"
      FROM "PartnerCommission"
      WHERE "id" = ${id}
      FOR UPDATE
    `;
  }
}

async function loadEffect(
  client: Prisma.TransactionClient,
  effectId: string
): Promise<LoadedEffect | null> {
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

function extractPreliminaryPartnerId(
  effect: LoadedEffect
): string | null {
  const columnPartnerId = effect.partnerId;
  const raw = effect.intent;
  let jsonPartnerId: string | null = null;
  if (isRecord(raw) && typeof raw.partnerId === "string") {
    jsonPartnerId = raw.partnerId.trim();
  }

  if (columnPartnerId !== jsonPartnerId) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Preliminary effect.partnerId and intent.partnerId do not match."
    );
  }
  return columnPartnerId;
}

async function readCommissionIdentities(
  client: Prisma.TransactionClient,
  transactionId: string,
  effectId: string
): Promise<CommissionIdentityState> {
  const [byTransaction, byEffect] = await Promise.all([
    client.partnerCommission.findUnique({ where: { transactionId } }),
    client.partnerCommission.findUnique({
      where: { finalizationEffectId: effectId },
    }),
  ]);
  return { byTransaction, byEffect };
}

function classifyCommissionIdentities(
  state: CommissionIdentityState,
  transactionId: string
): ClassifiedCommissionIdentity {
  const { byTransaction, byEffect } = state;

  if (byTransaction === null && byEffect === null) {
    return { kind: "NONE" };
  }

  if (
    byTransaction !== null &&
    byEffect !== null &&
    byTransaction.id === byEffect.id
  ) {
    return { kind: "EXACT", commission: byTransaction };
  }

  if (
    byTransaction !== null &&
    byTransaction.finalizationEffectId === null &&
    byEffect === null
  ) {
    return { kind: "LEGACY", commission: byTransaction };
  }

  if (byEffect !== null && byEffect.transactionId !== transactionId) {
    return { kind: "CONFLICT" };
  }

  return { kind: "CONFLICT" };
}

async function classifyLedgerState(
  client: Prisma.TransactionClient,
  transactionId: string,
  liabilityEffectId: string
): Promise<ClassifiedLedgerIdentity> {
  const opKey = `pfin:${transactionId}:partner-liability`;
  const [byOpKey, byEffect] = await Promise.all([
    client.financialLedgerEntry.findMany({
      where: { operationKey: opKey },
      orderBy: { entryType: "asc" },
    }),
    client.financialLedgerEntry.findMany({
      where: { finalizationEffectId: liabilityEffectId },
      orderBy: { entryType: "asc" },
    }),
  ]);

  if (byOpKey.length === 0 && byEffect.length === 0) {
    return { kind: "NONE" };
  }

  if (
    byOpKey.length === 2 &&
    byEffect.length === 2 &&
    byOpKey[0].id === byEffect[0].id &&
    byOpKey[1].id === byEffect[1].id
  ) {
    const debit = byOpKey.find((e) => e.entryType === "DEBIT");
    const credit = byOpKey.find((e) => e.entryType === "CREDIT");
    if (debit && credit && debit.id !== credit.id) {
      return { kind: "EXACT", debitEntry: debit, creditEntry: credit };
    }
  }

  return { kind: "CONFLICT" };
}

export class IdempotentPartnerCommissionService {
  /**
   * Atomically executes a paired PARTNER_COMMISSION and PARTNER_LIABILITY_LEDGER effect.
   * Strictly dormant — zero production callers.
   *
   * Caller-owned transaction contract: when `tx` is supplied, this service uses
   * that transaction directly and never opens a nested transaction. Every failure
   * propagates to the caller, which must abort/roll back the entire transaction,
   * obey the documented financial lock ordering, and never catch a P2002 or other
   * financial failure and continue issuing SQL on the same PostgreSQL transaction.
   */
  static async executePartnerCommissionAndLiability(
    params: ExecutePartnerCommissionAndLiabilityParams
  ): Promise<ExecutePartnerCommissionAndLiabilityResult> {
    const transactionId = requireInputTransactionIdentifier(params.transactionId);
    const commissionEffectId = requireInputEffectIdentifier(
      params.commissionEffectId
    );
    const liabilityEffectId = requireInputEffectIdentifier(
      params.liabilityEffectId
    );

    if (params.tx) {
      try {
        return await IdempotentPartnerCommissionService.executeInsideTransaction(
          transactionId,
          commissionEffectId,
          liabilityEffectId,
          params.tx
        );
      } catch (error) {
        return normalizeExecutionError(error);
      }
    }

    try {
      return await prisma.$transaction(async (tx) => {
        return IdempotentPartnerCommissionService.executeInsideTransaction(
          transactionId,
          commissionEffectId,
          liabilityEffectId,
          tx
        );
      });
    } catch (error) {
      return normalizeExecutionError(error);
    }
  }

  private static async executeInsideTransaction(
    transactionId: string,
    commissionEffectId: string,
    liabilityEffectId: string,
    client: Prisma.TransactionClient
  ): Promise<ExecutePartnerCommissionAndLiabilityResult> {
    // 🔒 1. TRANSACTION ROOT ADVISORY LOCK
    await acquireAdvisoryLock(client, transactionId);

    // 🔒 2. EFFECT ADVISORY LOCKS (Sorted order)
    const effectLocks = [
      `partner-commission:effect:${commissionEffectId}`,
      `partner-liability:effect:${liabilityEffectId}`,
    ].sort();
    for (const lock of effectLocks) {
      await acquireAdvisoryLock(client, lock);
    }

    // 🔒 3. PRELIMINARY LOAD & IDENTITY EXTRACTION
    const [prelimCommEffect, prelimLiabEffect] = await Promise.all([
      loadEffect(client, commissionEffectId),
      loadEffect(client, liabilityEffectId),
    ]);

    if (!prelimCommEffect || !prelimLiabEffect) {
      fail("EFFECT_NOT_FOUND", "The requested finalization effect was not found.");
    }

    const prelimCommPartnerId = extractPreliminaryPartnerId(prelimCommEffect);
    const prelimLiabPartnerId = extractPreliminaryPartnerId(prelimLiabEffect);

    if (prelimCommPartnerId !== prelimLiabPartnerId) {
      fail(
        "PAIR_IDENTITY_MISMATCH",
        "Commission and liability effects identify different preliminary partners."
      );
    }
    const preliminaryPartnerId = prelimCommPartnerId;

    // 🔒 4. PARTNER FINANCE DOMAIN ADVISORY LOCK
    if (preliminaryPartnerId !== null) {
      await acquireAdvisoryLock(
        client,
        `partner-finance:${preliminaryPartnerId}`
      );
    }

    // 🔒 5. LEDGER OPERATION & EFFECT ADVISORY LOCKS
    await acquireAdvisoryLock(
      client,
      `ledger:operation:pfin:${transactionId}:partner-liability`
    );
    await acquireAdvisoryLock(
      client,
      `ledger:effect:${liabilityEffectId}`
    );

    // 🔒 6. ROW-LOCK BOTH EFFECTS IN DETERMINISTIC ID ORDER
    await lockEffectRows(client, [commissionEffectId, liabilityEffectId]);

    // 🔒 7. AUTHORITATIVE RE-READ OF BOTH EFFECTS
    const [commEffect, liabEffect] = await Promise.all([
      loadEffect(client, commissionEffectId),
      loadEffect(client, liabilityEffectId),
    ]);

    if (!commEffect || !liabEffect) {
      fail("EFFECT_NOT_FOUND", "The requested finalization effect was not found.");
    }

    // 🔒 8. AUTHORITATIVE INTENT & PAIR VALIDATION
    const commIntent = parseAndValidateCommissionIntent(commEffect);
    const liabIntent = parseAndValidateLiabilityIntent(liabEffect);

    if (
      commIntent.partnerId !== preliminaryPartnerId ||
      liabIntent.partnerId !== preliminaryPartnerId
    ) {
      fail(
        "MANIFEST_LINKAGE_MISMATCH",
        "Partner identities changed during locked effect resolution."
      );
    }

    const { replayOnly } = validatePairAndParent(
      commEffect,
      liabEffect,
      commIntent,
      liabIntent,
      transactionId
    );

    const finalization = commEffect.finalization;

    // 🔒 9. PARTNER COMMISSION ROW STABILIZATION
    const prelimCommissions = await readCommissionIdentities(
      client,
      transactionId,
      commissionEffectId
    );
    await lockCommissionRows(
      client,
      [
        prelimCommissions.byTransaction?.id,
        prelimCommissions.byEffect?.id,
      ].filter((id): id is string => typeof id === "string")
    );

    const commissions = await readCommissionIdentities(
      client,
      transactionId,
      commissionEffectId
    );
    const commissionIdentity = classifyCommissionIdentities(
      commissions,
      transactionId
    );

    // 🔒 10. STABLE LEDGER PREFLIGHT
    const ledgerIdentity = await classifyLedgerState(
      client,
      transactionId,
      liabilityEffectId
    );

    // 🔒 11. NOT_APPLICABLE EXECUTION
    if (commIntent.status === "NOT_APPLICABLE") {
      if (
        commissionIdentity.kind !== "NONE" ||
        ledgerIdentity.kind !== "NONE"
      ) {
        fail(
          "PARTNER_COMMISSION_IDENTITY_CONFLICT",
          "A not-applicable partner effect is already associated with financial records."
        );
      }

      return {
        outcome: "NOT_APPLICABLE",
        commission: null,
        debitEntry: null,
        creditEntry: null,
        reason: commIntent.notApplicableReason,
      };
    }

    // commIntent.status === "PENDING"
    const activeCommIntent = commIntent as ActivePartnerCommissionIntent;
    const activeLiabIntent = liabIntent as ActivePartnerLiabilityIntent;

    // Verify Partner existence (Relational foreign key integrity)
    const partner = await client.partner.findUnique({
      where: { id: activeCommIntent.partnerId },
    });
    if (!partner) {
      fail("PARTNER_NOT_FOUND", "Attributed partner does not exist.");
    }

    const validatedHoldingUntil = validateHoldingTime(
      finalization,
      activeCommIntent
    );

    // 🔒 12. CROSS-STATE MATRIX EVALUATION
    if (commissionIdentity.kind === "CONFLICT") {
      fail(
        "PARTNER_COMMISSION_IDENTITY_CONFLICT",
        "Partner commission identities resolve to an inconsistent state."
      );
    }

    if (commissionIdentity.kind === "LEGACY") {
      fail(
        "LEGACY_COMMISSION_REQUIRES_CLASSIFICATION",
        "A legacy partner commission requires explicit Slice 7 classification."
      );
    }

    if (ledgerIdentity.kind === "CONFLICT") {
      fail(
        "LEDGER_IDENTITY_CONFLICT",
        "Partner liability ledger entries resolve to an inconsistent state."
      );
    }

    if (
      commissionIdentity.kind === "EXACT" &&
      ledgerIdentity.kind === "NONE"
    ) {
      fail(
        "PARTNER_COMMISSION_PARTIAL_STATE",
        "PartnerCommission exists but its liability ledger pair is missing."
      );
    }

    if (
      commissionIdentity.kind === "NONE" &&
      ledgerIdentity.kind === "EXACT"
    ) {
      fail(
        "PARTNER_COMMISSION_PARTIAL_STATE",
        "Liability ledger pair exists but its PartnerCommission row is missing."
      );
    }

    // 🔒 13. REPLAY PATH
    if (
      commissionIdentity.kind === "EXACT" &&
      ledgerIdentity.kind === "EXACT"
    ) {
      validateCommissionReplay(
        commissionIdentity.commission,
        activeCommIntent,
        finalization,
        transactionId,
        commissionEffectId
      );

      let ledgerReplayResult;
      try {
        ledgerReplayResult =
          await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
            {
              transactionId,
              finalizationEffectId: liabilityEffectId,
              operation: { kind: "PARTNER_LIABILITY" },
              operationKey: `pfin:${transactionId}:partner-liability`,
              transactionType: "PARTNER_COMMISSION",
              debitCategory: "EXPENSE_PARTNER",
              creditCategory: "LIABILITY_PARTNER_PAYABLE",
              amountCentavos: activeLiabIntent.amountCentavos,
              currency: "PHP",
              sourceEntity: "PartnerCommission",
              sourceId: commissionIdentity.commission.id,
              description: `Partner commission liability for transaction ${transactionId}`,
              effectiveDate: finalization.verifiedAt,
            },
            client
          );
      } catch (err) {
        normalizeLedgerError(err);
      }

      if (!ledgerReplayResult.isReplay) {
        fail(
          "LEDGER_IDENTITY_CONFLICT",
          "Expected ledger replay but received fresh creation."
        );
      }

      return {
        outcome: "REPLAY",
        commission: commissionIdentity.commission,
        debitEntry: ledgerReplayResult.debitEntry,
        creditEntry: ledgerReplayResult.creditEntry,
        isReplay: true,
      };
    }

    // 🔒 14. CREATE PATH (Commission NONE + Ledger NONE)
    if (replayOnly) {
      fail(
        "INVALID_LIFECYCLE",
        "Completed partner lifecycle has no equivalent commission to replay."
      );
    }

    const expectedEffectiveRate =
      activeCommIntent.commissionModel === "FIXED_PER_PURCHASE"
        ? 0
        : activeCommIntent.commissionRateBasisPoints / 100;

    const commission = await client.partnerCommission.create({
      data: {
        partnerId: activeCommIntent.partnerId,
        transactionId,
        finalizationEffectId: commissionEffectId,
        purchaseAmountCentavos: finalization.purchaseAmountCentavos,
        commissionModel: activeCommIntent.commissionModel,
        effectiveRate: expectedEffectiveRate,
        commissionAmountCentavos: activeCommIntent.commissionAmountCentavos,
        currency: "PHP",
        status: "PENDING",
        campaignSource: activeCommIntent.campaignSource,
        holdingUntil: validatedHoldingUntil,
        availableAt: null,
      },
    });

    let ledgerResult;
    try {
      ledgerResult =
        await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
          {
            transactionId,
            finalizationEffectId: liabilityEffectId,
            operation: { kind: "PARTNER_LIABILITY" },
            operationKey: `pfin:${transactionId}:partner-liability`,
            transactionType: "PARTNER_COMMISSION",
            debitCategory: "EXPENSE_PARTNER",
            creditCategory: "LIABILITY_PARTNER_PAYABLE",
            amountCentavos: activeLiabIntent.amountCentavos,
            currency: "PHP",
            sourceEntity: "PartnerCommission",
            sourceId: commission.id,
            description: `Partner commission liability for transaction ${transactionId}`,
            effectiveDate: finalization.verifiedAt,
          },
          client
        );
    } catch (err) {
      normalizeLedgerError(err);
    }

    if (ledgerResult.isReplay) {
      fail(
        "LEDGER_IDENTITY_CONFLICT",
        "Fresh commission creation unexpectedly resolved an existing ledger pair."
      );
    }

    return {
      outcome: "CREATED",
      commission,
      debitEntry: ledgerResult.debitEntry,
      creditEntry: ledgerResult.creditEntry,
      isReplay: false,
    };
  }
}
