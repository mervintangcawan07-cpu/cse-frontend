// Relative Path: src/lib/payment/paymentFinalizationContracts.ts
/**
 * GovStudyX Durable Payment Finalization Recovery Engine (Phase 1 / Slice 2.1)
 *
 * Strongly typed dormant domain contracts, discriminated intent unions,
 * closed operation-key builder, deterministic canonical serialization,
 * SHA-256 intent hashing, and ISO timestamp validation.
 *
 * STRICTLY READ-ONLY / DORMANT — ZERO APPLICATION SIDE-EFFECTS OR WRITES.
 */

import crypto from "crypto";
import type { AccountCategory } from "@/lib/accounting/types";

export const MANIFEST_VERSION = 1 as const;
export const INTENT_VERSION = 1 as const;
export const CANONICAL_VERSION = 1 as const;

export const SUPPORTED_CURRENCY = "PHP" as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCY;

export const SUPPORTED_PLAN_TYPES = ["1_MONTH", "6_MONTHS", "1_YEAR"] as const;
export type SupportedPlanType = (typeof SUPPORTED_PLAN_TYPES)[number];

export type PaymentFinalizationSource = "WEBHOOK" | "VERIFY_POLL";
export type PaymentFinalizationOrigin = "NEW_PAYMENT" | "LEGACY_ADOPTED";
export type PaymentFinalizationStatus =
  | "PENDING"
  | "PROCESSING"
  | "FAILED_RETRYABLE"
  | "COMPLETE"
  | "MANUAL_REVIEW";

export type PaymentFinalizationEffectStatus =
  | "PENDING"
  | "AWAITING_DATA"
  | "FAILED_RETRYABLE"
  | "COMPLETE"
  | "NOT_APPLICABLE"
  | "MANUAL_REVIEW";

export type PaymentFinalizationEffectType =
  | "PAYMENT_LEDGER"
  | "PROVIDER_FEE_LEDGER"
  | "REFERRAL_REWARD"
  | "PARTNER_COMMISSION"
  | "PARTNER_LIABILITY_LEDGER"
  | "TAX_PROVISION"
  | "RECONCILIATION";

export type PaymentFinalizationFeeKnowledge = "UNKNOWN" | "KNOWN";

// ============================================================================
// CLOSED NOT_APPLICABLE REASON UNIONS (NO OPEN-ENDED STRINGS)
// ============================================================================

export type ProviderFeeNotApplicableReason = "ZERO_PROVIDER_FEE";

export type ReferralRewardNotApplicableReason =
  | "NO_REFERRAL_ATTRIBUTION"
  | "PROGRAM_DISABLED"
  | "ZERO_REWARD_CALCULATED"
  | "NON_POSITIVE_AMOUNT"
  | "REFERRAL_ALREADY_REWARDED";

export type PartnerCommissionNotApplicableReason =
  | "NO_PARTNER_ATTRIBUTION"
  | "INACTIVE_PARTNER"
  | "ZERO_COMMISSION_CALCULATED";

export type PartnerLiabilityNotApplicableReason = "NO_PARTNER_COMMISSION";

export type TaxProvisionNotApplicableReason =
  | "NO_ACTIVE_TAX_RULES"
  | "ZERO_TAX_CALCULATED";

export const PAYMENT_FINALIZATION_V1_TAX_TYPES = [
  "VAT",
  "PERCENTAGE_TAX",
  "WITHHOLDING_TAX",
  "OTHER_TAX",
] as const;
export type PaymentFinalizationV1TaxType =
  (typeof PAYMENT_FINALIZATION_V1_TAX_TYPES)[number];

export const TAX_CALCULATION_BASES_FOR_PLANNING = [
  "GROSS_SALE",
  "CUSTOMER_PAYMENT",
  "NET_REVENUE",
  "COMMISSION",
  "PAYOUT",
  "OTHER",
] as const;
export type TaxCalculationBasisForPlanning =
  (typeof TAX_CALCULATION_BASES_FOR_PLANNING)[number];

// ============================================================================
// CLOSED DOMAIN ERROR CODES & HIERARCHY
// ============================================================================

export type PaymentFinalizationErrorCode =
  | "PLANNING_ERROR"
  | "UNSUPPORTED_PLAN_TYPE"
  | "INVALID_MONETARY_AMOUNT"
  | "MISSING_AUTHORITATIVE_GROSS"
  | "INVALID_OPERATION_KEY"
  | "DUPLICATE_EFFECT_KEY"
  | "INVALID_TIMESTAMP"
  | "INVALID_CURRENCY"
  | "INVALID_FEE_STATE"
  | "USER_NOT_FOUND"
  | "TRANSACTION_NOT_FOUND"
  | "TRANSACTION_IDENTITY_MISMATCH"
  | "EXISTING_REFERRAL_REWARD_CONFLICT"
  | "EXISTING_PARTNER_COMMISSION_CONFLICT"
  | "INVALID_RATE"
  | "CANONICAL_SERIALIZATION_ERROR";

export class PaymentFinalizationPlanningError extends Error {
  public readonly code: PaymentFinalizationErrorCode;

  constructor(message: string, code: PaymentFinalizationErrorCode = "PLANNING_ERROR") {
    super(message);
    this.name = "PaymentFinalizationPlanningError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnsupportedPlanTypeError extends PaymentFinalizationPlanningError {
  constructor(planType: string) {
    super(
      `Unsupported pricing plan: "${planType}". Supported plans: ${SUPPORTED_PLAN_TYPES.join(", ")}`,
      "UNSUPPORTED_PLAN_TYPE"
    );
    this.name = "UnsupportedPlanTypeError";
  }
}

export class InvalidMonetaryAmountError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "INVALID_MONETARY_AMOUNT");
    this.name = "InvalidMonetaryAmountError";
  }
}

export class MissingAuthoritativeGrossError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "MISSING_AUTHORITATIVE_GROSS");
    this.name = "MissingAuthoritativeGrossError";
  }
}

export class InvalidOperationKeyError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "INVALID_OPERATION_KEY");
    this.name = "InvalidOperationKeyError";
  }
}

export class DuplicateEffectKeyError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "DUPLICATE_EFFECT_KEY");
    this.name = "DuplicateEffectKeyError";
  }
}

export class InvalidTimestampError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "INVALID_TIMESTAMP");
    this.name = "InvalidTimestampError";
  }
}

export class InvalidCurrencyError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "INVALID_CURRENCY");
    this.name = "InvalidCurrencyError";
  }
}

export class InvalidFeeStateError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "INVALID_FEE_STATE");
    this.name = "InvalidFeeStateError";
  }
}

export class UserNotFoundError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "USER_NOT_FOUND");
    this.name = "UserNotFoundError";
  }
}

export class TransactionNotFoundError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "TRANSACTION_NOT_FOUND");
    this.name = "TransactionNotFoundError";
  }
}

export class TransactionIdentityMismatchError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "TRANSACTION_IDENTITY_MISMATCH");
    this.name = "TransactionIdentityMismatchError";
  }
}

export class ExistingReferralRewardConflictError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "EXISTING_REFERRAL_REWARD_CONFLICT");
    this.name = "ExistingReferralRewardConflictError";
  }
}

export class ExistingPartnerCommissionConflictError extends PaymentFinalizationPlanningError {
  constructor(message: string) {
    super(message, "EXISTING_PARTNER_COMMISSION_CONFLICT");
    this.name = "ExistingPartnerCommissionConflictError";
  }
}

// ============================================================================
// DISCRIMINATED INTENT UNIONS (COMPILED AGAINST CANONICAL ACCOUNT CATEGORIES)
// ============================================================================

export interface PaymentLedgerIntent {
  readonly effectType: "PAYMENT_LEDGER";
  readonly intentVersion: 1;
  readonly status: "PENDING";
  readonly amountCentavos: number;
  readonly userId: string;
  readonly planType: SupportedPlanType;
  readonly debitCategory: Extract<AccountCategory, "CASH_PAYMONGO">;
  readonly creditCategory: Extract<AccountCategory, "REVENUE_PREMIUM">;
}

export interface ProviderFeeLedgerIntent {
  readonly effectType: "PROVIDER_FEE_LEDGER";
  readonly intentVersion: 1;
  readonly feeKnowledge: PaymentFinalizationFeeKnowledge;
  readonly feeAmountCentavos: number | null;
  readonly status: "PENDING" | "AWAITING_DATA" | "NOT_APPLICABLE";
  readonly notApplicableReason?: ProviderFeeNotApplicableReason;
  readonly debitCategory: Extract<AccountCategory, "EXPENSE_PAYMENT_FEE"> | null;
  readonly creditCategory: Extract<AccountCategory, "CASH_PAYMONGO"> | null;
}

export interface ReferralRewardIntent {
  readonly effectType: "REFERRAL_REWARD";
  readonly intentVersion: 1;
  readonly status: "PENDING" | "NOT_APPLICABLE";
  readonly notApplicableReason?: ReferralRewardNotApplicableReason;
  readonly referralId: string | null;
  readonly inviterId: string | null;
  readonly referredUserId: string;
  readonly purchaseAmountCentavos: number;
  readonly rewardType: "PERCENTAGE" | "FIXED" | null;
  readonly rewardRateBasisPoints: number | null;
  readonly rewardAmountCentavos: number;
  readonly currency: "PHP";
  readonly holdingPeriodDays: number | null;
  readonly holdingUntil: string | null;
}

export type PartnerCommissionModel =
  | "PERCENTAGE_OF_GROSS"
  | "PERCENTAGE_OF_CUSTOMER_PAYMENT"
  | "PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS"
  | "FIXED_PER_PURCHASE"
  | "FIXED_PER_REFERRAL"
  | "CUSTOM_RULE";

export interface PartnerCommissionIntent {
  readonly effectType: "PARTNER_COMMISSION";
  readonly intentVersion: 1;
  readonly status: "PENDING" | "NOT_APPLICABLE";
  readonly notApplicableReason?: PartnerCommissionNotApplicableReason;
  readonly partnerId: string | null;
  readonly partnerCode: string | null;
  readonly commissionModel: PartnerCommissionModel | null;
  readonly commissionRateBasisPoints: number | null;
  readonly calculationBasis: "CUSTOMER_PAYMENT" | "GROSS_PRICE" | "FIXED_AMOUNT" | null;
  readonly baseAmountCentavos: number | null;
  readonly commissionAmountCentavos: number;
  readonly currency: "PHP";
  readonly campaignSource: string | null;
  readonly holdingPeriodDays: number | null;
  readonly holdingUntil: string | null;
}

export interface PartnerLiabilityLedgerIntent {
  readonly effectType: "PARTNER_LIABILITY_LEDGER";
  readonly intentVersion: 1;
  readonly status: "PENDING" | "NOT_APPLICABLE";
  readonly notApplicableReason?: PartnerLiabilityNotApplicableReason;
  readonly partnerId: string | null;
  readonly amountCentavos: number;
  readonly debitCategory: Extract<AccountCategory, "EXPENSE_PARTNER"> | null;
  readonly creditCategory: Extract<AccountCategory, "LIABILITY_PARTNER_PAYABLE"> | null;
}

export interface TaxProvisionIntent {
  readonly effectType: "TAX_PROVISION";
  readonly intentVersion: 1;
  readonly status: "PENDING" | "NOT_APPLICABLE";
  readonly notApplicableReason?: TaxProvisionNotApplicableReason;
  readonly taxConfigId: string | null;
  readonly taxName: string | null;
  readonly taxType: PaymentFinalizationV1TaxType | null;
  readonly calculationBasis: "CUSTOMER_PAYMENT" | "GROSS_SALE" | null;
  readonly taxableAmountCentavos: number;
  readonly taxRateBasisPoints: number | null;
  readonly taxAmountCentavos: number;
  readonly debitCategory: Extract<AccountCategory, "EXPENSE_TAX"> | null;
  readonly creditCategory: Extract<AccountCategory, "LIABILITY_TAX_PAYABLE"> | null;
}

export interface ReconciliationIntent {
  readonly effectType: "RECONCILIATION";
  readonly intentVersion: 1;
  readonly status: "PENDING";
  readonly expectedPaymentCentavos: number;
  readonly expectedFeeCentavos: number | null;
  readonly feeKnowledge: PaymentFinalizationFeeKnowledge;
  readonly sourceType: "INTERNAL_TRANSACTION";
}

export type EffectIntent =
  | PaymentLedgerIntent
  | ProviderFeeLedgerIntent
  | ReferralRewardIntent
  | PartnerCommissionIntent
  | PartnerLiabilityLedgerIntent
  | TaxProvisionIntent
  | ReconciliationIntent;

// ============================================================================
// PLANNED EFFECT & MANIFEST TYPES
// ============================================================================

export interface PlannedEffect {
  readonly effectType: PaymentFinalizationEffectType;
  readonly effectKey: string;
  readonly operationKey: string;
  readonly status: PaymentFinalizationEffectStatus;
  readonly intentVersion: 1;
  readonly intent: EffectIntent;
  readonly intentHash: string;
  readonly referralId?: string | null;
  readonly partnerId?: string | null;
  readonly taxConfigId?: string | null;
}

export interface PlannedManifest {
  readonly manifestVersion: 1;
  readonly manifestRevision: 1;
  readonly transactionId: string;
  readonly checkoutSessionId: string;
  readonly userId: string; // Planner context identity (reaches User via Transaction.userId)
  readonly providerPaymentId: string | null;
  readonly providerPaidAt: string | null;
  readonly source: PaymentFinalizationSource;
  readonly origin: PaymentFinalizationOrigin;
  readonly planType: SupportedPlanType;
  readonly currency: "PHP";
  readonly purchaseAmountCentavos: number;
  readonly feeKnowledge: PaymentFinalizationFeeKnowledge;
  readonly feeAmountCentavos: number | null;
  readonly feeObservedAt: string | null;
  readonly verifiedAt: string; // Canonical ISO UTC string
  readonly entitlementBefore: string | null;
  readonly entitlementAfter: string | null;
  readonly manifestHash: string;
  readonly effects: readonly PlannedEffect[];
}

// ============================================================================
// PLANNER INPUT & READ-ONLY CONTEXT INTERFACES
// ============================================================================

export interface FinalizationPlanningInput {
  readonly transactionId: string;
  readonly checkoutSessionId: string;
  readonly userId: string;
  readonly planType: string;
  readonly purchaseAmountCentavos: number;
  readonly authoritativeGrossAmountCentavos?: number;
  readonly feeKnowledge: PaymentFinalizationFeeKnowledge;
  readonly feeAmountCentavos?: number | null;
  readonly feeObservedAtIso?: string | null;
  readonly providerPaymentId?: string | null;
  readonly providerPaidAtIso?: string | null;
  readonly source: PaymentFinalizationSource;
  readonly origin?: PaymentFinalizationOrigin;
  readonly currency?: string;
  readonly partnerCode?: string | null; // Non-authoritative context only
  readonly campaignSource?: string | null;
  readonly paymentIntentId?: string | null;
  readonly receiptUrl?: string | null;
  readonly verifiedAtIso: string; // REQUIRED non-null ISO-8601 UTC string
}

export interface TransactionIdentityForPlanning {
  readonly id: string;
  readonly userId: string;
  readonly checkoutSessionId: string;
}

export interface UserRecordForPlanning {
  readonly id: string;
  readonly isPaid: boolean;
  readonly paidUntil: string | null;
}

export interface ReferralAttributionForPlanning {
  readonly referralId: string;
  readonly inviterId: string;
  readonly programEnabled: boolean;
  readonly rewardType: "PERCENTAGE" | "FIXED";
  readonly rewardPercentage: number;
  readonly fixedRewardAmountCentavos: number;
  readonly holdingPeriodDays: number;
  readonly existingReward: {
    readonly id: string;
    readonly transactionId: string;
  } | null;
}

export type PartnerStatus =
  | "ACTIVE"
  | "PENDING"
  | "SUSPENDED"
  | "EXPIRED"
  | "TERMINATED"
  | "ARCHIVED"
  | "INACTIVE";

export interface PartnerAttributionForPlanning {
  readonly partnerId: string;
  readonly partnerCode: string;
  readonly status: PartnerStatus;
  readonly commissionModel: PartnerCommissionModel;
  readonly commissionRate: number;
  readonly fixedCommissionCentavos: number;
  readonly holdingPeriodDays: number;
  readonly defaultCampaignSource: string | null;
}

export interface PartnerCommissionRecordForPlanning {
  readonly id: string;
  readonly partnerId: string;
  readonly transactionId: string;
}

export interface TaxConfigForPlanning {
  readonly id: string;
  readonly name: string;
  readonly taxType: PaymentFinalizationV1TaxType;
  readonly rate: number;
  readonly fixedAmountCentavos: number | null;
  readonly calculationBasis: TaxCalculationBasisForPlanning;
  readonly applicableTransactionType: string | null;
}

export interface IFinalizationDataReader {
  findTransactionIdentity(transactionId: string): Promise<TransactionIdentityForPlanning | null>;
  findUser(userId: string): Promise<UserRecordForPlanning | null>;
  findReferralAttribution(userId: string): Promise<ReferralAttributionForPlanning | null>;
  findExistingPartnerCommission(transactionId: string): Promise<PartnerCommissionRecordForPlanning | null>;
  findPartnerAttribution(userId: string): Promise<PartnerAttributionForPlanning | null>;
  findActiveTaxConfigs(referenceDate: Date): Promise<TaxConfigForPlanning[]>;
}

// ============================================================================
// PURE UTILITIES: VALIDATION, CANONICAL SERIALIZATION, OPERATION KEYS & HASHING
// ============================================================================

export function validatePlanType(planType: string | null | undefined): SupportedPlanType {
  if (!planType || typeof planType !== "string") {
    throw new UnsupportedPlanTypeError(String(planType));
  }
  const trimmed = planType.trim();
  if (!SUPPORTED_PLAN_TYPES.includes(trimmed as SupportedPlanType)) {
    throw new UnsupportedPlanTypeError(trimmed);
  }
  return trimmed as SupportedPlanType;
}

export function validateCurrency(currency?: string | null): "PHP" {
  if (currency === undefined || currency === null) {
    return SUPPORTED_CURRENCY;
  }
  if (typeof currency !== "string" || currency.trim().toUpperCase() !== "PHP") {
    throw new InvalidCurrencyError(
      `Unsupported currency "${currency}". GovStudyX only supports "${SUPPORTED_CURRENCY}".`
    );
  }
  return SUPPORTED_CURRENCY;
}

export function validateSafeCentavos(
  amount: number | null | undefined,
  fieldName: string,
  allowZero: boolean = true
): number {
  if (amount === null || amount === undefined || typeof amount !== "number") {
    throw new InvalidMonetaryAmountError(`${fieldName} must be a number.`);
  }
  if (!Number.isFinite(amount)) {
    throw new InvalidMonetaryAmountError(`${fieldName} must be a finite number.`);
  }
  if (!Number.isSafeInteger(amount)) {
    throw new InvalidMonetaryAmountError(`${fieldName} must be a safe integer in centavos.`);
  }
  if (allowZero ? amount < 0 : amount <= 0) {
    throw new InvalidMonetaryAmountError(
      `${fieldName} must be ${allowZero ? "non-negative" : "positive"}.`
    );
  }
  return amount;
}

export function validateSafeRate(rate: number, fieldName: string): number {
  if (typeof rate !== "number" || !Number.isFinite(rate)) {
    throw new PaymentFinalizationPlanningError(
      `${fieldName} must be a finite number.`,
      "INVALID_RATE"
    );
  }
  if (rate < 0 || rate > 100) {
    throw new PaymentFinalizationPlanningError(
      `${fieldName} must be between 0 and 100.`,
      "INVALID_RATE"
    );
  }
  return rate;
}

export function rateToBasisPoints(ratePercent: number): number {
  return Math.round(ratePercent * 100);
}

// STRICT OPERATION KEY IDENTIFIER REGEX: Forbids ":" because ":" is the structural delimiter
const IDENTIFIER_REGEX = /^[A-Za-z0-9_\-.]+$/;

export function validateIdentifier(id: string | null | undefined, fieldName: string): string {
  if (!id || typeof id !== "string") {
    throw new InvalidOperationKeyError(`${fieldName} must be a non-empty string.`);
  }
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    throw new InvalidOperationKeyError(`${fieldName} cannot be empty or whitespace only.`);
  }
  if (trimmed.includes(":")) {
    throw new InvalidOperationKeyError(
      `${fieldName} cannot contain ":" (colon delimiter forbidden inside identifier segment): "${trimmed}"`
    );
  }
  if (!IDENTIFIER_REGEX.test(trimmed)) {
    throw new InvalidOperationKeyError(`${fieldName} contains invalid characters: "${trimmed}"`);
  }
  if (trimmed.length > 128) {
    throw new InvalidOperationKeyError(
      `${fieldName} exceeds maximum length of 128 characters: "${trimmed}"`
    );
  }
  return trimmed;
}

export function validateTransactionId(transactionId: string | null | undefined): string {
  return validateIdentifier(transactionId, "transactionId");
}

// GENERAL CONTEXT IDENTIFIERS (Allows standard provider format while preventing whitespace/empty)
export function validateContextIdentifier(
  id: string | null | undefined,
  fieldName: string,
  maxLength: number = 255
): string {
  if (!id || typeof id !== "string") {
    throw new PaymentFinalizationPlanningError(
      `${fieldName} must be a non-empty string.`,
      "PLANNING_ERROR"
    );
  }
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    throw new PaymentFinalizationPlanningError(
      `${fieldName} cannot be empty or whitespace only.`,
      "PLANNING_ERROR"
    );
  }
  if (trimmed.length > maxLength) {
    throw new PaymentFinalizationPlanningError(
      `${fieldName} exceeds maximum length of ${maxLength} characters.`,
      "PLANNING_ERROR"
    );
  }
  return trimmed;
}

const ISO_8601_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/**
 * Validates that an input timestamp string is a strict, well-formed ISO-8601 UTC string.
 * Prevents JavaScript date rollovers (e.g. 2026-02-30 -> 2026-03-02) and normalizes to UTC ISO string.
 */
export function validateIsoUtcTimestamp(
  timestamp: string | null | undefined,
  fieldName: string,
  allowNullable: boolean = false
): string | null {
  if (timestamp === null || timestamp === undefined) {
    if (allowNullable) return null;
    throw new InvalidTimestampError(`${fieldName} must be a valid non-null ISO-8601 UTC string.`);
  }

  if (typeof timestamp !== "string") {
    throw new InvalidTimestampError(`${fieldName} must be a string.`);
  }

  const trimmed = timestamp.trim();
  if (!ISO_8601_UTC_REGEX.test(trimmed)) {
    throw new InvalidTimestampError(
      `${fieldName} must be a valid ISO-8601 UTC string matching YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ssZ: "${trimmed}"`
    );
  }

  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    throw new InvalidTimestampError(`${fieldName} is not a valid date: "${trimmed}"`);
  }

  const normalized = parsed.toISOString();
  const expectedPrefix = trimmed.replace(/Z$/, "").split(".")[0];
  const normalizedPrefix = normalized.replace(/Z$/, "").split(".")[0];

  if (expectedPrefix !== normalizedPrefix) {
    throw new InvalidTimestampError(
      `${fieldName} contains invalid date components (e.g. rolled day/month): "${trimmed}"`
    );
  }

  return normalized;
}

// ============================================================================
// CLOSED OPERATION-KEY BUILDER API
// ============================================================================

export type PaymentFinalizationOperation =
  | { readonly kind: "PAYMENT" }
  | { readonly kind: "FEE" }
  | { readonly kind: "REFERRAL" }
  | { readonly kind: "PARTNER_COMMISSION" }
  | { readonly kind: "PARTNER_LIABILITY" }
  | { readonly kind: "TAX"; readonly taxConfigId: string }
  | { readonly kind: "TAX_NONE" }
  | { readonly kind: "RECONCILIATION" };

/**
 * Closed, type-safe builder for canonical financial operation keys.
 * Exclusively supports the eight approved operation identities:
 *   1. pfin:<transactionId>:payment
 *   2. pfin:<transactionId>:fee
 *   3. pfin:<transactionId>:referral
 *   4. pfin:<transactionId>:partner-commission
 *   5. pfin:<transactionId>:partner-liability
 *   6. pfin:<transactionId>:tax:<taxConfigId>
 *   7. pfin:<transactionId>:tax:none
 *   8. pfin:<transactionId>:reconciliation
 */
export function buildPaymentFinalizationOperationKey(
  transactionId: string,
  operation: PaymentFinalizationOperation
): string {
  const trimmedTxId = validateTransactionId(transactionId);

  let effectKey: string;
  switch (operation.kind) {
    case "PAYMENT":
      effectKey = "payment";
      break;
    case "FEE":
      effectKey = "fee";
      break;
    case "REFERRAL":
      effectKey = "referral";
      break;
    case "PARTNER_COMMISSION":
      effectKey = "partner-commission";
      break;
    case "PARTNER_LIABILITY":
      effectKey = "partner-liability";
      break;
    case "TAX": {
      const trimmedTaxId = validateIdentifier(operation.taxConfigId, "taxConfigId");
      effectKey = `tax:${trimmedTaxId}`;
      break;
    }
    case "TAX_NONE":
      effectKey = "tax:none";
      break;
    case "RECONCILIATION":
      effectKey = "reconciliation";
      break;
    default: {
      const exhaustiveCheck: never = operation;
      throw new InvalidOperationKeyError("Unsupported payment-finalization operation.");
    }
  }

  const key = `pfin:${trimmedTxId}:${effectKey}`;

  if (key.length > 255) {
    throw new InvalidOperationKeyError(
      `Operation key exceeds maximum length of 255 characters: ${key}`
    );
  }

  return key;
}

/**
 * Deterministically canonicalizes a JSON-compatible value by recursively sorting object keys.
 * Strictly accepts ONLY plain objects, arrays, strings, booleans, null, and safe integers.
 * REJECTS Date objects, non-integers, floats, functions, symbols, undefined, NaN, Infinity, and non-plain objects.
 */
export function canonicalizeJson(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (value === null) {
    return "null";
  }

  const valType = typeof value;

  if (valType === "boolean") {
    return value ? "true" : "false";
  }

  if (valType === "number") {
    if (!Number.isFinite(value)) {
      throw new PaymentFinalizationPlanningError(
        "Cannot canonicalize non-finite numbers (NaN/Infinity).",
        "CANONICAL_SERIALIZATION_ERROR"
      );
    }
    if (!Number.isSafeInteger(value)) {
      throw new PaymentFinalizationPlanningError(
        `Cannot canonicalize non-integer number ${value}. All canonical numbers must be safe integers.`,
        "CANONICAL_SERIALIZATION_ERROR"
      );
    }
    return String(value);
  }

  if (valType === "string") {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    throw new PaymentFinalizationPlanningError(
      "Date objects are not allowed in canonical serialization. Timestamps must be converted and validated as UTC ISO strings before canonicalization.",
      "CANONICAL_SERIALIZATION_ERROR"
    );
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new PaymentFinalizationPlanningError(
        "Circular structure detected in canonicalization.",
        "CANONICAL_SERIALIZATION_ERROR"
      );
    }
    seen.add(value);
    const elements = value.map((v) => canonicalizeJson(v, seen));
    return `[${elements.join(",")}]`;
  }

  if (valType === "object" && value !== null) {
    const nonNullObj = value as object;
    const isPlainObject =
      Object.prototype.toString.call(nonNullObj) === "[object Object]" &&
      (nonNullObj.constructor === Object || Object.getPrototypeOf(nonNullObj) === null);

    if (!isPlainObject) {
      const typeName =
        "constructor" in nonNullObj && nonNullObj.constructor
          ? nonNullObj.constructor.name
          : valType;
      throw new PaymentFinalizationPlanningError(
        `Non-plain object type "${typeName}" is not allowed in canonical serialization.`,
        "CANONICAL_SERIALIZATION_ERROR"
      );
    }

    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) {
      throw new PaymentFinalizationPlanningError(
        "Circular structure detected in canonicalization.",
        "CANONICAL_SERIALIZATION_ERROR"
      );
    }
    seen.add(obj);

    const keys = Object.keys(obj).sort();
    const entries: string[] = [];

    for (const key of keys) {
      const val = obj[key];
      if (
        val === undefined ||
        typeof val === "function" ||
        typeof val === "symbol" ||
        typeof val === "bigint"
      ) {
        throw new PaymentFinalizationPlanningError(
          `Cannot canonicalize unsupported property type for key "${key}".`,
          "CANONICAL_SERIALIZATION_ERROR"
        );
      }
      entries.push(`${JSON.stringify(key)}:${canonicalizeJson(val, seen)}`);
    }

    return `{${entries.join(",")}}`;
  }

  throw new PaymentFinalizationPlanningError(
    `Unsupported value type for canonicalization: ${valType}`,
    "CANONICAL_SERIALIZATION_ERROR"
  );
}

export function computeSha256Hash(canonicalString: string): string {
  return crypto.createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

// ============================================================================
// STICKY PER-PAYMENT ARCHITECTURE OWNERSHIP (Slice 8E-B)
// ============================================================================

export type PaymentArchitectureOwner = "DURABLE" | "LEGACY";

export interface ResolveOwnershipInput {
  readonly hasDurableFinalization: boolean;
  readonly durableEnabledFlag: boolean;
}

/**
 * Enforces sticky durable ownership:
 * If a payment has ever been persisted as a durable PaymentFinalization, it remains
 * permanently owned by the durable architecture regardless of the global activation flag.
 * Only un-finalized new payments look at the current feature flag.
 */
export function resolvePaymentArchitectureOwnership(
  input: ResolveOwnershipInput
): PaymentArchitectureOwner {
  if (input.hasDurableFinalization) {
    return "DURABLE";
  }
  return input.durableEnabledFlag ? "DURABLE" : "LEGACY";
}
