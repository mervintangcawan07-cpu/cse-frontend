// Relative Path: src/lib/accounting/idempotentTaxProvisionService.ts
/**
 * Dormant atomic tax-provision executor (P1-001 / Slice 6B).
 *
 * Consumes one persisted immutable TAX_PROVISION effect and atomically creates
 * its TaxRecord plus exact balanced ledger pair. Supports deterministic replay,
 * fail-closed split-state detection, caller/self-owned transactions, and zero
 * lifecycle or external side effects. This service has no production callers.
 */

import {
  Prisma,
  type FinancialLedgerEntry,
  type TaxRecord,
} from "@prisma/client";
import { prisma } from "../prisma";
import {
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
  validateIdentifier,
  validateTransactionId,
  type TaxProvisionNotApplicableReason,
} from "../payment/paymentFinalizationContracts";
import type { AccountCategory } from "./types";
import {
  IdempotentLedgerService,
  IdempotentLedgerError,
  InvalidLedgerAmountError,
  InvalidLedgerCurrencyError,
  InvalidLedgerEffectiveDateError,
  InvalidLedgerFinalizationEffectIdError,
  InvalidLedgerOperationKeyError,
  InvalidLedgerOperationMismatchError,
  InvalidLedgerTransactionIdError,
  LedgerConcurrentIdentityConflictError,
  LedgerIdempotencyMismatchError,
  LedgerInconsistentStateError,
} from "./idempotentLedgerService";

const POSTGRESQL_INTEGER_MAX = 2_147_483_647;
const SUPPORTED_INTENT_VERSION = 1;
const SUPPORTED_MANIFEST_VERSION = 1;
const SUPPORTED_MANIFEST_REVISION = 1;
const IDENTIFIER_MAX_LENGTH = 128;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const TAX_TYPES = [
  "VAT",
  "PERCENTAGE_TAX",
  "WITHHOLDING_TAX",
  "OTHER_TAX",
] as const;
const TAX_BASES = ["CUSTOMER_PAYMENT", "GROSS_SALE"] as const;

type V1TaxType = (typeof TAX_TYPES)[number];
type V1TaxBasis = (typeof TAX_BASES)[number];

export interface ExecuteTaxProvisionEffectParams {
  readonly transactionId: string;
  readonly taxEffectId: string;
  readonly tx?: Prisma.TransactionClient;
}

export type ExecuteTaxProvisionEffectResult =
  | {
      readonly outcome: "CREATED";
      readonly taxRecord: TaxRecord;
      readonly debitEntry: FinancialLedgerEntry;
      readonly creditEntry: FinancialLedgerEntry;
      readonly isReplay: false;
    }
  | {
      readonly outcome: "REPLAY";
      readonly taxRecord: TaxRecord;
      readonly debitEntry: FinancialLedgerEntry;
      readonly creditEntry: FinancialLedgerEntry;
      readonly isReplay: true;
    }
  | {
      readonly outcome: "NOT_APPLICABLE";
      readonly taxRecord: null;
      readonly debitEntry: null;
      readonly creditEntry: null;
      readonly reason: TaxProvisionNotApplicableReason;
    };

export type TaxProvisionExecutionErrorCode =
  | "EFFECT_NOT_FOUND"
  | "WRONG_EFFECT_TYPE"
  | "UNSUPPORTED_INTENT_VERSION"
  | "INTENT_HASH_MISMATCH"
  | "MANIFEST_LINKAGE_MISMATCH"
  | "TRANSACTION_IDENTITY_MISMATCH"
  | "TAX_CONFIG_NOT_FOUND"
  | "TAX_IDENTITY_MISMATCH"
  | "TAX_RECORD_IDENTITY_CONFLICT"
  | "TAX_RECORD_PARTIAL_STATE"
  | "LEGACY_TAX_REQUIRES_CLASSIFICATION"
  | "LEDGER_IDENTITY_CONFLICT"
  | "CONCURRENT_IDENTITY_CONFLICT"
  | "INVALID_IMMUTABLE_INTENT"
  | "INVALID_LIFECYCLE"
  | "DATABASE_EXECUTION_FAILED";

export class TaxProvisionExecutionError extends Error {
  public readonly code: TaxProvisionExecutionErrorCode;

  constructor(code: TaxProvisionExecutionErrorCode, message: string) {
    super(message);
    this.name = "TaxProvisionExecutionError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type LoadedTaxEffect = Prisma.PaymentFinalizationEffectGetPayload<{
  include: {
    finalization: {
      include: {
        transaction: true;
      };
    };
  };
}>;

interface ConfiguredTaxIntentFields {
  readonly taxConfigId: string;
  readonly taxName: string;
  readonly taxType: V1TaxType;
  readonly calculationBasis: V1TaxBasis;
  readonly taxableAmountCentavos: number;
  readonly taxRateBasisPoints: number | null;
}

interface ActiveTaxIntent extends ConfiguredTaxIntentFields {
  readonly effectType: "TAX_PROVISION";
  readonly intentVersion: 1;
  readonly status: "PENDING";
  readonly taxAmountCentavos: number;
  readonly debitCategory: Extract<AccountCategory, "EXPENSE_TAX">;
  readonly creditCategory: Extract<AccountCategory, "LIABILITY_TAX_PAYABLE">;
}

interface NoActiveTaxIntent {
  readonly effectType: "TAX_PROVISION";
  readonly intentVersion: 1;
  readonly status: "NOT_APPLICABLE";
  readonly notApplicableReason: "NO_ACTIVE_TAX_RULES";
  readonly taxConfigId: null;
  readonly taxName: null;
  readonly taxType: null;
  readonly calculationBasis: null;
  readonly taxableAmountCentavos: 0;
  readonly taxRateBasisPoints: null;
  readonly taxAmountCentavos: 0;
  readonly debitCategory: null;
  readonly creditCategory: null;
}

interface ZeroTaxIntent extends ConfiguredTaxIntentFields {
  readonly effectType: "TAX_PROVISION";
  readonly intentVersion: 1;
  readonly status: "NOT_APPLICABLE";
  readonly notApplicableReason: "ZERO_TAX_CALCULATED";
  readonly taxAmountCentavos: 0;
  readonly debitCategory: null;
  readonly creditCategory: null;
}

type ParsedTaxIntent = ActiveTaxIntent | NoActiveTaxIntent | ZeroTaxIntent;

interface TaxIdentityState {
  readonly byEffect: TaxRecord | null;
  readonly byTransactionConfig: readonly TaxRecord[];
}

type ClassifiedTaxIdentity =
  | { readonly kind: "NONE" }
  | { readonly kind: "EXACT"; readonly taxRecord: TaxRecord }
  | { readonly kind: "LEGACY"; readonly taxRecord: TaxRecord }
  | { readonly kind: "CONFLICT" };

type ClassifiedLedgerIdentity =
  | { readonly kind: "NONE" }
  | {
      readonly kind: "EXACT";
      readonly debitEntry: FinancialLedgerEntry;
      readonly creditEntry: FinancialLedgerEntry;
    }
  | { readonly kind: "CONFLICT" };

const ACTIVE_INTENT_KEYS = [
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

const NOT_APPLICABLE_INTENT_KEYS = [
  ...ACTIVE_INTENT_KEYS,
  "notApplicableReason",
].sort() as readonly string[];

function fail(code: TaxProvisionExecutionErrorCode, message: string): never {
  throw new TaxProvisionExecutionError(code, message);
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
      "Persisted tax intent does not match the exact supported v1 shape."
    );
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
    fail("EFFECT_NOT_FOUND", "The requested tax effect was not found.");
  }

  try {
    const validated = validateIdentifier(value, "taxEffectId");
    if (validated !== value) throw new Error("non-canonical");
    return validated;
  } catch {
    fail("EFFECT_NOT_FOUND", "The requested tax effect was not found.");
  }
}

function requireCanonicalIdentifier(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    fail("INVALID_IMMUTABLE_INTENT", `${fieldName} must be a string.`);
  }
  try {
    const validated = validateIdentifier(value, fieldName);
    if (validated !== value) throw new Error("non-canonical");
    return validated;
  } catch {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} is not an exact canonical identifier.`
    );
  }
}

function requirePostgresInteger(
  value: unknown,
  fieldName: string,
  positive: boolean
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < (positive ? 1 : 0) ||
    value > POSTGRESQL_INTEGER_MAX
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      `${fieldName} is not a supported PostgreSQL integer centavo value.`
    );
  }
  return value;
}

function requireTaxType(value: unknown): V1TaxType {
  if (!TAX_TYPES.some((candidate) => candidate === value)) {
    fail("INVALID_IMMUTABLE_INTENT", "Tax type is outside the closed v1 set.");
  }
  return value as V1TaxType;
}

function requireTaxBasis(value: unknown): V1TaxBasis {
  if (!TAX_BASES.some((candidate) => candidate === value)) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Tax calculation basis is outside the closed v1 set."
    );
  }
  return value as V1TaxBasis;
}

function requireTaxRate(value: unknown): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 10_000
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "taxRateBasisPoints must be null or an integer in the range 1..10000."
    );
  }
  return value;
}

function parseConfiguredFields(
  raw: Record<string, unknown>
): ConfiguredTaxIntentFields {
  const taxConfigId = requireCanonicalIdentifier(raw.taxConfigId, "taxConfigId");
  if (typeof raw.taxName !== "string") {
    fail("INVALID_IMMUTABLE_INTENT", "taxName must be a string.");
  }
  const taxName = raw.taxName;
  const taxType = requireTaxType(raw.taxType);
  const calculationBasis = requireTaxBasis(raw.calculationBasis);
  const taxableAmountCentavos = requirePostgresInteger(
    raw.taxableAmountCentavos,
    "taxableAmountCentavos",
    false
  );
  const taxRateBasisPoints = requireTaxRate(raw.taxRateBasisPoints);

  return {
    taxConfigId,
    taxName,
    taxType,
    calculationBasis,
    taxableAmountCentavos,
    taxRateBasisPoints,
  };
}

function validatePercentageAmount(
  fields: ConfiguredTaxIntentFields,
  taxAmountCentavos: number
): void {
  if (fields.taxRateBasisPoints === null) return;
  const canonicalPercentage = fields.taxRateBasisPoints / 100;
  const expectedTax = Math.round(
    (fields.taxableAmountCentavos * canonicalPercentage) / 100
  );
  if (expectedTax !== taxAmountCentavos) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Tax amount does not match canonical percentage arithmetic."
    );
  }
}

function parseAndValidateIntent(effect: LoadedTaxEffect): ParsedTaxIntent {
  if (effect.effectType !== "TAX_PROVISION") {
    fail("WRONG_EFFECT_TYPE", "Effect is not a TAX_PROVISION effect.");
  }
  if (effect.intentVersion !== SUPPORTED_INTENT_VERSION) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      `Unsupported tax intent version ${effect.intentVersion}.`
    );
  }
  if (
    typeof effect.intentHash !== "string" ||
    !HASH_PATTERN.test(effect.intentHash)
  ) {
    fail("INTENT_HASH_MISMATCH", "Stored tax intent hash is malformed.");
  }

  const raw = effect.intent;
  if (!isRecord(raw)) {
    fail("INVALID_IMMUTABLE_INTENT", "Tax intent is not a plain JSON object.");
  }
  if (raw.intentVersion !== SUPPORTED_INTENT_VERSION) {
    fail(
      "UNSUPPORTED_INTENT_VERSION",
      "Tax intent internal version is not supported."
    );
  }
  if (raw.effectType !== "TAX_PROVISION") {
    fail("WRONG_EFFECT_TYPE", "Tax intent internal effectType is invalid.");
  }

  if (computeSha256Hash(canonicalizeJson(raw)) !== effect.intentHash) {
    fail("INTENT_HASH_MISMATCH", "Tax intent hash verification failed.");
  }

  if (raw.status === "PENDING") {
    requireExactKeys(raw, ACTIVE_INTENT_KEYS);
    const configured = parseConfiguredFields(raw);
    const taxAmountCentavos = requirePostgresInteger(
      raw.taxAmountCentavos,
      "taxAmountCentavos",
      true
    );
    if (
      raw.debitCategory !== "EXPENSE_TAX" ||
      raw.creditCategory !== "LIABILITY_TAX_PAYABLE"
    ) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "Pending tax intent has invalid account categories."
      );
    }
    validatePercentageAmount(configured, taxAmountCentavos);
    return {
      effectType: "TAX_PROVISION",
      intentVersion: 1,
      status: "PENDING",
      ...configured,
      taxAmountCentavos,
      debitCategory: "EXPENSE_TAX",
      creditCategory: "LIABILITY_TAX_PAYABLE",
    };
  }

  if (raw.status !== "NOT_APPLICABLE") {
    fail("INVALID_IMMUTABLE_INTENT", "Tax intent status is unsupported.");
  }

  requireExactKeys(raw, NOT_APPLICABLE_INTENT_KEYS);
  if (
    raw.taxAmountCentavos !== 0 ||
    raw.debitCategory !== null ||
    raw.creditCategory !== null
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Not-applicable tax intent must contain zero tax and null accounts."
    );
  }

  if (raw.notApplicableReason === "NO_ACTIVE_TAX_RULES") {
    if (
      raw.taxConfigId !== null ||
      raw.taxName !== null ||
      raw.taxType !== null ||
      raw.calculationBasis !== null ||
      raw.taxableAmountCentavos !== 0 ||
      raw.taxRateBasisPoints !== null
    ) {
      fail(
        "INVALID_IMMUTABLE_INTENT",
        "NO_ACTIVE_TAX_RULES intent has non-null tax configuration data."
      );
    }
    return {
      effectType: "TAX_PROVISION",
      intentVersion: 1,
      status: "NOT_APPLICABLE",
      notApplicableReason: "NO_ACTIVE_TAX_RULES",
      taxConfigId: null,
      taxName: null,
      taxType: null,
      calculationBasis: null,
      taxableAmountCentavos: 0,
      taxRateBasisPoints: null,
      taxAmountCentavos: 0,
      debitCategory: null,
      creditCategory: null,
    };
  }

  if (raw.notApplicableReason !== "ZERO_TAX_CALCULATED") {
    fail("INVALID_IMMUTABLE_INTENT", "Tax not-applicable reason is unsupported.");
  }

  const configured = parseConfiguredFields(raw);
  validatePercentageAmount(configured, 0);
  return {
    effectType: "TAX_PROVISION",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: "ZERO_TAX_CALCULATED",
    ...configured,
    taxAmountCentavos: 0,
    debitCategory: null,
    creditCategory: null,
  };
}

function extractPreliminaryTaxConfigId(effect: LoadedTaxEffect): string | null {
  const raw = effect.intent;
  const rawTaxConfigId =
    isRecord(raw) &&
    (raw.taxConfigId === null || typeof raw.taxConfigId === "string")
      ? raw.taxConfigId
      : undefined;

  if (rawTaxConfigId === undefined || effect.taxConfigId !== rawTaxConfigId) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Preliminary effect and intent tax identities do not match."
    );
  }
  if (rawTaxConfigId === null) return null;

  try {
    const validated = validateIdentifier(rawTaxConfigId, "taxConfigId");
    if (validated !== rawTaxConfigId) throw new Error("non-canonical");
    return validated;
  } catch {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Preliminary tax identity is not canonical."
    );
  }
}

function operationKeyFor(
  transactionId: string,
  taxConfigId: string | null
): string {
  return buildPaymentFinalizationOperationKey(
    transactionId,
    taxConfigId === null
      ? { kind: "TAX_NONE" }
      : { kind: "TAX", taxConfigId }
  );
}

function validateParentLinkageAndLifecycle(
  effect: LoadedTaxEffect,
  intent: ParsedTaxIntent,
  transactionId: string,
  preliminaryTaxConfigId: string | null
): { readonly replayOnly: boolean; readonly operationKey: string } {
  const finalization = effect.finalization;
  if (
    effect.finalizationId !== finalization.id ||
    finalization.manifestVersion !== SUPPORTED_MANIFEST_VERSION ||
    finalization.manifestRevision !== SUPPORTED_MANIFEST_REVISION ||
    typeof finalization.manifestHash !== "string" ||
    !HASH_PATTERN.test(finalization.manifestHash)
  ) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Payment finalization manifest linkage is not canonical v1."
    );
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
  if (
    finalization.currency !== "PHP" ||
    !(finalization.verifiedAt instanceof Date) ||
    !Number.isFinite(finalization.verifiedAt.getTime())
  ) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Payment finalization currency or verified timestamp is invalid."
    );
  }
  if (effect.partnerId !== null || effect.referralId !== null) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Tax effect contains foreign partner or referral linkage."
    );
  }
  if (effect.taxConfigId !== preliminaryTaxConfigId) {
    fail(
      "TAX_IDENTITY_MISMATCH",
      "Tax identity changed during locked effect resolution."
    );
  }
  if (effect.taxConfigId !== intent.taxConfigId) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Effect taxConfigId does not match immutable intent."
    );
  }

  const expectedEffectKey =
    intent.taxConfigId === null ? "tax:none" : `tax:${intent.taxConfigId}`;
  const expectedOperationKey = operationKeyFor(transactionId, intent.taxConfigId);
  if (
    effect.effectKey !== expectedEffectKey ||
    effect.operationKey !== expectedOperationKey
  ) {
    fail(
      "MANIFEST_LINKAGE_MISMATCH",
      "Tax effect key or operation key is not canonical."
    );
  }

  if (
    intent.calculationBasis === "CUSTOMER_PAYMENT" &&
    intent.taxableAmountCentavos !== finalization.purchaseAmountCentavos
  ) {
    fail(
      "INVALID_IMMUTABLE_INTENT",
      "Customer-payment taxable amount does not match finalization purchase amount."
    );
  }

  if (finalization.status === "MANUAL_REVIEW") {
    fail("INVALID_LIFECYCLE", "Payment finalization is in manual review.");
  }

  if (intent.status === "NOT_APPLICABLE") {
    if (effect.status !== "NOT_APPLICABLE") {
      fail(
        "INVALID_LIFECYCLE",
        "Not-applicable tax intent has inconsistent effect lifecycle."
      );
    }
    return { replayOnly: true, operationKey: expectedOperationKey };
  }

  if (
    effect.status === "AWAITING_DATA" ||
    effect.status === "MANUAL_REVIEW" ||
    effect.status === "NOT_APPLICABLE"
  ) {
    fail("INVALID_LIFECYCLE", "Tax effect is not executable in its current state.");
  }
  if (
    effect.status !== "PENDING" &&
    effect.status !== "FAILED_RETRYABLE" &&
    effect.status !== "COMPLETE"
  ) {
    fail("INVALID_LIFECYCLE", "Tax effect lifecycle state is inconsistent.");
  }

  return {
    replayOnly:
      effect.status === "COMPLETE" || finalization.status === "COMPLETE",
    operationKey: expectedOperationKey,
  };
}

function isTaxRecordIdentityP2002Error(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const prismaError = error as { code?: string; meta?: { target?: unknown } };
  if (prismaError.code !== "P2002" || !prismaError.meta) return false;
  const target = prismaError.meta.target;
  if (Array.isArray(target)) {
    return target.length === 1 && String(target[0]) === "finalizationEffectId";
  }
  return target === "TaxRecord_finalizationEffectId_key";
}

function normalizeLedgerError(error: unknown): never {
  if (error instanceof LedgerConcurrentIdentityConflictError) {
    fail("CONCURRENT_IDENTITY_CONFLICT", "Concurrent ledger identity conflict.");
  }
  if (
    error instanceof LedgerInconsistentStateError ||
    error instanceof LedgerIdempotencyMismatchError
  ) {
    fail("LEDGER_IDENTITY_CONFLICT", "Tax ledger identity is inconsistent.");
  }
  if (
    error instanceof InvalidLedgerAmountError ||
    error instanceof InvalidLedgerCurrencyError ||
    error instanceof InvalidLedgerEffectiveDateError
  ) {
    fail("INVALID_IMMUTABLE_INTENT", "Tax ledger payload is invalid.");
  }
  if (
    error instanceof InvalidLedgerOperationKeyError ||
    error instanceof InvalidLedgerOperationMismatchError ||
    error instanceof InvalidLedgerFinalizationEffectIdError ||
    error instanceof InvalidLedgerTransactionIdError
  ) {
    fail("MANIFEST_LINKAGE_MISMATCH", "Tax ledger identity linkage is invalid.");
  }
  if (error instanceof TaxProvisionExecutionError) throw error;
  fail(
    "DATABASE_EXECUTION_FAILED",
    "Database execution failed during tax ledger execution."
  );
}

function normalizeExecutionError(error: unknown): never {
  if (error instanceof TaxProvisionExecutionError) throw error;
  if (error instanceof IdempotentLedgerError) normalizeLedgerError(error);
  if (isTaxRecordIdentityP2002Error(error)) {
    fail(
      "CONCURRENT_IDENTITY_CONFLICT",
      "A concurrent execution established the TaxRecord identity."
    );
  }
  fail(
    "DATABASE_EXECUTION_FAILED",
    "Database execution failed during tax provision execution."
  );
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

async function lockTaxRecordRows(
  client: Prisma.TransactionClient,
  ids: readonly string[]
): Promise<void> {
  for (const id of [...new Set(ids)].sort()) {
    await client.$queryRaw`
      SELECT "id"
      FROM "TaxRecord"
      WHERE "id" = ${id}
      FOR UPDATE
    `;
  }
}

async function loadEffect(
  client: Prisma.TransactionClient,
  effectId: string
): Promise<LoadedTaxEffect | null> {
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

async function readTaxIdentities(
  client: Prisma.TransactionClient,
  transactionId: string,
  effectId: string,
  taxConfigId: string | null
): Promise<TaxIdentityState> {
  const byEffect = await client.taxRecord.findUnique({
    where: { finalizationEffectId: effectId },
  });
  const byTransactionConfig =
    taxConfigId === null
      ? []
      : await client.taxRecord.findMany({
          where: { transactionId, taxConfigId },
          orderBy: { id: "asc" },
        });
  return { byEffect, byTransactionConfig };
}

function taxRecordMatches(
  taxRecord: TaxRecord,
  intent: ActiveTaxIntent,
  transactionId: string,
  effectId: string,
  effectiveDate: Date
): boolean {
  const expectedRate =
    intent.taxRateBasisPoints === null ? 0 : intent.taxRateBasisPoints / 100;
  return (
    taxRecord.taxConfigId === intent.taxConfigId &&
    taxRecord.transactionId === transactionId &&
    taxRecord.finalizationEffectId === effectId &&
    taxRecord.taxableAmountCentavos === intent.taxableAmountCentavos &&
    taxRecord.appliedRate === expectedRate &&
    taxRecord.taxAmountCentavos === intent.taxAmountCentavos &&
    taxRecord.calculationBasis === intent.calculationBasis &&
    taxRecord.effectiveDate.toISOString() === effectiveDate.toISOString() &&
    taxRecord.partnerPayoutId === null &&
    taxRecord.referralPayoutId === null
  );
}

function classifyTaxIdentity(
  state: TaxIdentityState,
  intent: ParsedTaxIntent,
  transactionId: string,
  effectId: string,
  effectiveDate: Date
): ClassifiedTaxIdentity {
  const { byEffect, byTransactionConfig } = state;
  if (byEffect === null && byTransactionConfig.length === 0) {
    return { kind: "NONE" };
  }
  if (
    byEffect === null &&
    byTransactionConfig.length === 1 &&
    byTransactionConfig[0].finalizationEffectId === null
  ) {
    return { kind: "LEGACY", taxRecord: byTransactionConfig[0] };
  }
  if (
    intent.status === "PENDING" &&
    byEffect !== null &&
    byTransactionConfig.length === 1 &&
    byEffect.id === byTransactionConfig[0].id &&
    taxRecordMatches(
      byEffect,
      intent,
      transactionId,
      effectId,
      effectiveDate
    )
  ) {
    return { kind: "EXACT", taxRecord: byEffect };
  }
  return { kind: "CONFLICT" };
}

function sameLedgerRows(
  left: readonly FinancialLedgerEntry[],
  right: readonly FinancialLedgerEntry[]
): boolean {
  if (left.length !== right.length) return false;
  const rightIds = new Set(right.map((entry) => entry.id));
  return left.every((entry) => rightIds.has(entry.id));
}

function ledgerEntryMatches(
  entry: FinancialLedgerEntry,
  entryType: "DEBIT" | "CREDIT",
  accountCategory: "EXPENSE_TAX" | "LIABILITY_TAX_PAYABLE",
  intent: ActiveTaxIntent,
  transactionId: string,
  effectId: string,
  operationKey: string,
  taxRecordId: string,
  effectiveDate: Date
): boolean {
  const baseDescription = `Tax provision for transaction ${transactionId} and tax configuration ${intent.taxConfigId}`;
  return (
    entry.transactionId === transactionId &&
    entry.transactionType === "TAX_PROVISION" &&
    entry.operationKey === operationKey &&
    entry.finalizationEffectId === effectId &&
    entry.entryType === entryType &&
    entry.accountCategory === accountCategory &&
    entry.amountCentavos === intent.taxAmountCentavos &&
    entry.currency === "PHP" &&
    entry.sourceEntity === "TaxRecord" &&
    entry.sourceId === taxRecordId &&
    entry.effectiveDate.toISOString() === effectiveDate.toISOString() &&
    entry.periodId === null &&
    entry.createdBy === null &&
    entry.description === `${baseDescription} (${entryType === "DEBIT" ? "DR" : "CR"})`
  );
}

async function classifyLedgerIdentity(
  client: Prisma.TransactionClient,
  operationKey: string,
  effectId: string,
  intent: ParsedTaxIntent,
  transactionId: string,
  taxRecord: TaxRecord | null,
  effectiveDate: Date
): Promise<ClassifiedLedgerIdentity> {
  const [byOperation, byEffect] = await Promise.all([
    client.financialLedgerEntry.findMany({
      where: { operationKey },
      orderBy: { entryType: "asc" },
    }),
    client.financialLedgerEntry.findMany({
      where: { finalizationEffectId: effectId },
      orderBy: { entryType: "asc" },
    }),
  ]);

  if (byOperation.length === 0 && byEffect.length === 0) {
    return { kind: "NONE" };
  }
  if (
    intent.status === "PENDING" &&
    byOperation.length === 2 &&
    byEffect.length === 2 &&
    sameLedgerRows(byOperation, byEffect)
  ) {
    const debit = byOperation.find((entry) => entry.entryType === "DEBIT");
    const credit = byOperation.find((entry) => entry.entryType === "CREDIT");
    const expectedSourceId =
      taxRecord?.id ??
      (debit &&
      credit &&
      debit.sourceId.length > 0 &&
      debit.sourceId === credit.sourceId
        ? debit.sourceId
        : null);
    if (
      debit &&
      credit &&
      expectedSourceId !== null &&
      debit.id !== credit.id &&
      ledgerEntryMatches(
        debit,
        "DEBIT",
        "EXPENSE_TAX",
        intent,
        transactionId,
        effectId,
        operationKey,
        expectedSourceId,
        effectiveDate
      ) &&
      ledgerEntryMatches(
        credit,
        "CREDIT",
        "LIABILITY_TAX_PAYABLE",
        intent,
        transactionId,
        effectId,
        operationKey,
        expectedSourceId,
        effectiveDate
      )
    ) {
      return { kind: "EXACT", debitEntry: debit, creditEntry: credit };
    }
  }
  return { kind: "CONFLICT" };
}

export class IdempotentTaxProvisionService {
  /**
   * Executes one immutable TAX_PROVISION effect. A supplied transaction client
   * is used directly; its caller must abort on every propagated failure and must
   * obey the documented transaction -> effect -> ledger lock hierarchy.
   */
  static async executeTaxProvisionEffect(
    params: ExecuteTaxProvisionEffectParams
  ): Promise<ExecuteTaxProvisionEffectResult> {
    const transactionId = requireInputTransactionIdentifier(params.transactionId);
    const taxEffectId = requireInputEffectIdentifier(params.taxEffectId);

    if (params.tx) {
      try {
        return await IdempotentTaxProvisionService.executeInsideTransaction(
          transactionId,
          taxEffectId,
          params.tx
        );
      } catch (error) {
        return normalizeExecutionError(error);
      }
    }

    try {
      return await prisma.$transaction((tx) =>
        IdempotentTaxProvisionService.executeInsideTransaction(
          transactionId,
          taxEffectId,
          tx
        )
      );
    } catch (error) {
      return normalizeExecutionError(error);
    }
  }

  private static async executeInsideTransaction(
    transactionId: string,
    taxEffectId: string,
    client: Prisma.TransactionClient
  ): Promise<ExecuteTaxProvisionEffectResult> {
    await acquireAdvisoryLock(client, transactionId);
    await acquireAdvisoryLock(
      client,
      `tax-provision:effect:${taxEffectId}`
    );

    const preliminaryEffect = await loadEffect(client, taxEffectId);
    if (!preliminaryEffect) {
      fail("EFFECT_NOT_FOUND", "The requested tax effect was not found.");
    }
    const preliminaryTaxConfigId =
      extractPreliminaryTaxConfigId(preliminaryEffect);
    const preliminaryOperationKey = operationKeyFor(
      transactionId,
      preliminaryTaxConfigId
    );

    await acquireAdvisoryLock(
      client,
      `ledger:operation:${preliminaryOperationKey}`
    );
    await acquireAdvisoryLock(client, `ledger:effect:${taxEffectId}`);
    await lockEffectRow(client, taxEffectId);

    const effect = await loadEffect(client, taxEffectId);
    if (!effect) {
      fail("EFFECT_NOT_FOUND", "The requested tax effect was not found.");
    }
    const intent = parseAndValidateIntent(effect);
    const { replayOnly, operationKey } = validateParentLinkageAndLifecycle(
      effect,
      intent,
      transactionId,
      preliminaryTaxConfigId
    );
    if (operationKey !== preliminaryOperationKey) {
      fail(
        "TAX_IDENTITY_MISMATCH",
        "Tax operation identity changed during locked effect resolution."
      );
    }

    if (intent.taxConfigId !== null) {
      const configIdentity = await client.taxConfiguration.findUnique({
        where: { id: intent.taxConfigId },
        select: { id: true },
      });
      if (!configIdentity) {
        fail("TAX_CONFIG_NOT_FOUND", "The immutable tax configuration identity is missing.");
      }
    }

    const preliminaryTaxRows = await readTaxIdentities(
      client,
      transactionId,
      taxEffectId,
      intent.taxConfigId
    );
    await lockTaxRecordRows(
      client,
      [
        preliminaryTaxRows.byEffect?.id,
        ...preliminaryTaxRows.byTransactionConfig.map((record) => record.id),
      ].filter((id): id is string => typeof id === "string")
    );

    const taxRows = await readTaxIdentities(
      client,
      transactionId,
      taxEffectId,
      intent.taxConfigId
    );
    const taxIdentity = classifyTaxIdentity(
      taxRows,
      intent,
      transactionId,
      taxEffectId,
      effect.finalization.verifiedAt
    );
    const ledgerIdentity = await classifyLedgerIdentity(
      client,
      operationKey,
      taxEffectId,
      intent,
      transactionId,
      taxIdentity.kind === "EXACT" ? taxIdentity.taxRecord : null,
      effect.finalization.verifiedAt
    );

    if (taxIdentity.kind === "LEGACY") {
      fail(
        "LEGACY_TAX_REQUIRES_CLASSIFICATION",
        "A legacy TaxRecord requires explicit classification before recovery."
      );
    }
    if (taxIdentity.kind === "CONFLICT") {
      fail(
        "TAX_RECORD_IDENTITY_CONFLICT",
        "TaxRecord identities or immutable values are inconsistent."
      );
    }
    if (ledgerIdentity.kind === "CONFLICT") {
      fail(
        "LEDGER_IDENTITY_CONFLICT",
        "Tax ledger identities or immutable values are inconsistent."
      );
    }

    if (intent.status === "NOT_APPLICABLE") {
      if (taxIdentity.kind !== "NONE" || ledgerIdentity.kind !== "NONE") {
        fail(
          "TAX_RECORD_IDENTITY_CONFLICT",
          "Not-applicable tax effect has unexpected financial evidence."
        );
      }
      return {
        outcome: "NOT_APPLICABLE",
        taxRecord: null,
        debitEntry: null,
        creditEntry: null,
        reason: intent.notApplicableReason,
      };
    }

    if (taxIdentity.kind === "EXACT" && ledgerIdentity.kind === "NONE") {
      fail(
        "TAX_RECORD_PARTIAL_STATE",
        "TaxRecord exists but its exact ledger pair is missing."
      );
    }
    if (taxIdentity.kind === "NONE" && ledgerIdentity.kind === "EXACT") {
      fail(
        "TAX_RECORD_PARTIAL_STATE",
        "Tax ledger pair exists but its exact TaxRecord is missing."
      );
    }

    const ledgerDescription = `Tax provision for transaction ${transactionId} and tax configuration ${intent.taxConfigId}`;

    if (taxIdentity.kind === "EXACT" && ledgerIdentity.kind === "EXACT") {
      let replay;
      try {
        replay = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
          {
            transactionId,
            finalizationEffectId: taxEffectId,
            operation: { kind: "TAX", taxConfigId: intent.taxConfigId },
            operationKey,
            transactionType: "TAX_PROVISION",
            debitCategory: "EXPENSE_TAX",
            creditCategory: "LIABILITY_TAX_PAYABLE",
            amountCentavos: intent.taxAmountCentavos,
            currency: "PHP",
            sourceEntity: "TaxRecord",
            sourceId: taxIdentity.taxRecord.id,
            description: ledgerDescription,
            effectiveDate: effect.finalization.verifiedAt,
            periodId: null,
            createdBy: null,
          },
          client
        );
      } catch (error) {
        normalizeLedgerError(error);
      }
      if (!replay.isReplay) {
        fail(
          "LEDGER_IDENTITY_CONFLICT",
          "Expected exact tax ledger replay but received fresh creation."
        );
      }
      return {
        outcome: "REPLAY",
        taxRecord: taxIdentity.taxRecord,
        debitEntry: replay.debitEntry,
        creditEntry: replay.creditEntry,
        isReplay: true,
      };
    }

    if (taxIdentity.kind !== "NONE" || ledgerIdentity.kind !== "NONE") {
      fail("TAX_RECORD_PARTIAL_STATE", "Tax domain and ledger state are split.");
    }
    if (replayOnly) {
      fail(
        "INVALID_LIFECYCLE",
        "Completed tax lifecycle has no exact financial state to replay."
      );
    }

    const taxRecord = await client.taxRecord.create({
      data: {
        taxConfigId: intent.taxConfigId,
        transactionId,
        finalizationEffectId: taxEffectId,
        taxableAmountCentavos: intent.taxableAmountCentavos,
        appliedRate:
          intent.taxRateBasisPoints === null
            ? 0
            : intent.taxRateBasisPoints / 100,
        taxAmountCentavos: intent.taxAmountCentavos,
        calculationBasis: intent.calculationBasis,
        status: "PROVISIONED",
        effectiveDate: effect.finalization.verifiedAt,
      },
    });

    let ledger;
    try {
      ledger = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
        {
          transactionId,
          finalizationEffectId: taxEffectId,
          operation: { kind: "TAX", taxConfigId: intent.taxConfigId },
          operationKey,
          transactionType: "TAX_PROVISION",
          debitCategory: "EXPENSE_TAX",
          creditCategory: "LIABILITY_TAX_PAYABLE",
          amountCentavos: intent.taxAmountCentavos,
          currency: "PHP",
          sourceEntity: "TaxRecord",
          sourceId: taxRecord.id,
          description: ledgerDescription,
          effectiveDate: effect.finalization.verifiedAt,
          periodId: null,
          createdBy: null,
        },
        client
      );
    } catch (error) {
      normalizeLedgerError(error);
    }
    if (ledger.isReplay) {
      fail(
        "LEDGER_IDENTITY_CONFLICT",
        "Fresh TaxRecord unexpectedly resolved an existing ledger pair."
      );
    }
    return {
      outcome: "CREATED",
      taxRecord,
      debitEntry: ledger.debitEntry,
      creditEntry: ledger.creditEntry,
      isReplay: false,
    };
  }
}
