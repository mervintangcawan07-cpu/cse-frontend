/**
 * Dormant durable payment-finalization coordinator (P1-001 / Slice 8C).
 */

import {
  Prisma,
  type PaymentFinalization,
  type PaymentFinalizationEffect,
  type PaymentFinalizationManifestRevision,
  type Transaction,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  IdempotentLedgerError,
  IdempotentLedgerService,
  type PostBalancedDoubleEntryIdempotentParams,
  type PostBalancedDoubleEntryResult,
} from "@/lib/accounting/idempotentLedgerService";
import {
  IdempotentReferralRewardService,
  ReferralRewardExecutionError,
  type ExecuteReferralRewardEffectParams,
  type ExecuteReferralRewardEffectResult,
} from "@/lib/referral/idempotentReferralRewardService";
import {
  IdempotentPartnerCommissionService,
  PartnerCommissionExecutionError,
  type ExecutePartnerCommissionAndLiabilityParams,
  type ExecutePartnerCommissionAndLiabilityResult,
} from "@/lib/accounting/idempotentPartnerCommissionService";
import {
  IdempotentTaxProvisionService,
  TaxProvisionExecutionError,
  type ExecuteTaxProvisionEffectParams,
  type ExecuteTaxProvisionEffectResult,
} from "@/lib/accounting/idempotentTaxProvisionService";
import {
  IdempotentReconciliationService,
  ReconciliationExecutionError,
  type ExecuteReconciliationEffectParams,
  type ExecuteReconciliationEffectResult,
} from "@/lib/accounting/idempotentReconciliationService";
import {
  INTENT_VERSION,
  MANIFEST_VERSION,
  SUPPORTED_CURRENCY,
  SUPPORTED_PLAN_TYPES,
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
  type PaymentFinalizationManifestSnapshot,
  type EffectManifestSnapshot,
} from "@/lib/payment/paymentFinalizationContracts";

const LEASE_DURATION_MS = 120_000;
const TRANSACTION_TIMEOUT_MS = 25_000;
const TRANSACTION_MAX_WAIT_MS = 15_000;
const MAX_AUTOMATIC_PARENT_ATTEMPTS = 5;
const MAX_AUTOMATIC_EFFECT_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000] as const;

const WORKER_ID_MAX_LENGTH = 64;
const FINALIZATION_ID_MAX_LENGTH = 128;
const MAX_BATCH_SIZE = 100;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._-]+$/;

export interface ExecuteFinalizationInput {
  readonly finalizationId: string;
  readonly workerId: string;
  readonly now: Date;
}

export type ExecuteFinalizationOutcome =
  | "COMPLETE"
  | "PROGRESSED"
  | "RETRY_SCHEDULED"
  | "AWAITING_DATA"
  | "MANUAL_REVIEW"
  | "ALREADY_COMPLETE"
  | "LEASE_NOT_ACQUIRED"
  | "LEASE_LOST";

export interface ExecuteFinalizationResult {
  readonly finalizationId: string;
  readonly outcome: ExecuteFinalizationOutcome;
  readonly completedEffectIds: readonly string[];
  readonly nextAttemptAt: Date | null;
  readonly errorCode: string | null;
}

export interface RecoverDueFinalizationsInput {
  readonly workerId: string;
  readonly now: Date;
  readonly batchSize: number;
}

export interface RecoverDueFinalizationsResult {
  readonly examined: number;
  readonly claimed: number;
  readonly results: readonly ExecuteFinalizationResult[];
}

type LoadedFinalization = PaymentFinalization & {
  readonly transaction: Transaction;
  readonly effects: PaymentFinalizationEffect[];
  readonly revisions?: readonly PaymentFinalizationManifestRevision[];
};

type CoordinatorManualCode =
  | "FINALIZATION_NOT_FOUND"
  | "MANIFEST_HASH_MISMATCH"
  | "EFFECT_HASH_MISMATCH"
  | "MANIFEST_TOPOLOGY_INVALID"
  | "OPERATION_KEY_MISMATCH"
  | "TRANSACTION_IDENTITY_MISMATCH"
  | "UNSUPPORTED_VERSION"
  | "LEASE_STATE_INVALID"
  | "REFUND_CONFLICT"
  | "RECONCILIATION_DISCREPANCY"
  | "MAX_ATTEMPTS_EXCEEDED"
  | "INVALID_IMMUTABLE_INTENT"
  | "LIFECYCLE_INVALID"
  | "REVISION_CHAIN_INVALID"
  | "COORDINATOR_UNCLASSIFIED_ERROR";

type EffectGroup =
  | { readonly kind: "PAYMENT"; readonly effectIds: readonly [string] }
  | { readonly kind: "FEE"; readonly effectIds: readonly [string] }
  | { readonly kind: "REFERRAL"; readonly effectIds: readonly [string] }
  | { readonly kind: "PARTNER_PAIR"; readonly effectIds: readonly [string, string] }
  | { readonly kind: "TAX"; readonly effectIds: readonly [string] }
  | { readonly kind: "RECONCILIATION"; readonly effectIds: readonly [string] };

interface ClaimedExecutionResult {
  readonly claimed: boolean;
  readonly result: ExecuteFinalizationResult;
}

interface GroupSuccess {
  readonly completedEffectIds: readonly string[];
  readonly parentComplete: boolean;
  readonly manualReview: boolean;
  readonly errorCode: string | null;
}

interface FailureClassification {
  readonly retryable: boolean;
  readonly code: string;
  readonly message: string;
}

interface CoordinatorRuntime {
  executeFinalization(input: ExecuteFinalizationInput): Promise<ExecuteFinalizationResult>;
  recoverDueFinalizations(
    input: RecoverDueFinalizationsInput
  ): Promise<RecoverDueFinalizationsResult>;
}

/** @internal Narrow seam used only by the synthetic Slice 8C verification. */
export interface PaymentFinalizationCoordinatorTestDependencies {
  runInTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T>;
  findDueFinalizationIds(now: Date, batchSize: number): Promise<readonly string[]>;
  postLedger(
    params: PostBalancedDoubleEntryIdempotentParams,
    tx: Prisma.TransactionClient
  ): Promise<PostBalancedDoubleEntryResult>;
  executeReferral(
    params: ExecuteReferralRewardEffectParams
  ): Promise<ExecuteReferralRewardEffectResult>;
  executePartnerPair(
    params: ExecutePartnerCommissionAndLiabilityParams
  ): Promise<ExecutePartnerCommissionAndLiabilityResult>;
  executeTax(
    params: ExecuteTaxProvisionEffectParams
  ): Promise<ExecuteTaxProvisionEffectResult>;
  executeReconciliation(
    params: ExecuteReconciliationEffectParams
  ): Promise<ExecuteReconciliationEffectResult>;
}

class CoordinatorInvariantError extends Error {
  constructor(
    public readonly code: CoordinatorManualCode,
    message: string
  ) {
    super(message);
    this.name = "CoordinatorInvariantError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class LeaseLostError extends Error {
  constructor() {
    super("The payment-finalization lease is no longer owned by this worker.");
    this.name = "LeaseLostError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class LifecycleCasError extends Error {
  constructor() {
    super("A lifecycle compare-and-set did not update exactly one row.");
    this.name = "LifecycleCasError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function fail(code: CoordinatorManualCode, message: string): never {
  throw new CoordinatorInvariantError(code, message);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  code: CoordinatorManualCode,
  message: string
): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) fail(code, message);
  return value;
}

function requirePositiveCentavos(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    fail("INVALID_IMMUTABLE_INTENT", message);
  }
  return value;
}

function requireNonnegativeCentavos(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail("INVALID_IMMUTABLE_INTENT", message);
  }
  return value;
}

function validateIdentifier(
  value: string,
  fieldName: string,
  maxLength: number
): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maxLength ||
    value.trim() !== value ||
    !SAFE_IDENTIFIER_PATTERN.test(value)
  ) {
    throw new TypeError(
      fieldName + " must be an exact safe identifier of 1-" + maxLength + " characters."
    );
  }
  return value;
}

function validateNow(now: Date): Date {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError("now must be a valid explicit Date.");
  }
  return new Date(now.getTime());
}

function validateBatchSize(batchSize: number): number {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new TypeError("batchSize must be an integer from 1 through " + MAX_BATCH_SIZE + ".");
  }
  return batchSize;
}

function sanitizeMessage(message: string): string {
  const singleLine = message.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return (singleLine || "Payment finalization requires controlled review.").slice(0, 500);
}

function addMilliseconds(now: Date, milliseconds: number): Date {
  const value = now.getTime() + milliseconds;
  if (!Number.isSafeInteger(value)) {
    fail("LIFECYCLE_INVALID", "Lifecycle timestamp arithmetic is invalid.");
  }
  return new Date(value);
}

function effectById(
  parent: LoadedFinalization,
  effectId: string
): PaymentFinalizationEffect {
  const effect = parent.effects.find((candidate) => candidate.id === effectId);
  if (!effect) {
    fail("MANIFEST_TOPOLOGY_INVALID", "The selected effect is absent from the manifest.");
  }
  return effect;
}

function originalIntentStatus(effect: PaymentFinalizationEffect): string {
  const intent = requireRecord(
    effect.intent,
    "INVALID_IMMUTABLE_INTENT",
    "An effect intent is not a JSON object."
  );
  if (typeof intent.status !== "string") {
    fail("INVALID_IMMUTABLE_INTENT", "An effect intent has no original planned status.");
  }
  return intent.status;
}

function compareEffects(
  left: { readonly effectType: PaymentFinalizationEffect["effectType"]; readonly effectKey: string; readonly id?: string },
  right: { readonly effectType: PaymentFinalizationEffect["effectType"]; readonly effectKey: string; readonly id?: string }
): number {
  const rank: Readonly<Record<PaymentFinalizationEffect["effectType"], number>> = {
    PAYMENT_LEDGER: 0,
    PROVIDER_FEE_LEDGER: 1,
    REFERRAL_REWARD: 2,
    PARTNER_COMMISSION: 3,
    PARTNER_LIABILITY_LEDGER: 4,
    TAX_PROVISION: 5,
    RECONCILIATION: 6,
  };
  const rankDifference = rank[left.effectType] - rank[right.effectType];
  if (rankDifference !== 0) return rankDifference;
  const keyDifference = left.effectKey.localeCompare(right.effectKey);
  return keyDifference !== 0 ? keyDifference : (left.id ?? "").localeCompare(right.id ?? "");
}

function expectedOperationKey(
  transactionId: string,
  effect: PaymentFinalizationEffect,
  intent: Readonly<Record<string, unknown>>
): string {
  switch (effect.effectType) {
    case "PAYMENT_LEDGER":
      return buildPaymentFinalizationOperationKey(transactionId, { kind: "PAYMENT" });
    case "PROVIDER_FEE_LEDGER":
      return buildPaymentFinalizationOperationKey(transactionId, { kind: "FEE" });
    case "REFERRAL_REWARD":
      return buildPaymentFinalizationOperationKey(transactionId, { kind: "REFERRAL" });
    case "PARTNER_COMMISSION":
      return buildPaymentFinalizationOperationKey(transactionId, {
        kind: "PARTNER_COMMISSION",
      });
    case "PARTNER_LIABILITY_LEDGER":
      return buildPaymentFinalizationOperationKey(transactionId, {
        kind: "PARTNER_LIABILITY",
      });
    case "TAX_PROVISION":
      if (intent.taxConfigId === null) {
        return buildPaymentFinalizationOperationKey(transactionId, { kind: "TAX_NONE" });
      }
      if (typeof intent.taxConfigId !== "string") {
        fail("INVALID_IMMUTABLE_INTENT", "Tax intent has an invalid configuration identity.");
      }
      return buildPaymentFinalizationOperationKey(transactionId, {
        kind: "TAX",
        taxConfigId: intent.taxConfigId,
      });
    case "RECONCILIATION":
      return buildPaymentFinalizationOperationKey(transactionId, {
        kind: "RECONCILIATION",
      });
  }
}

function validateEffectKey(
  effect: PaymentFinalizationEffect,
  intent: Readonly<Record<string, unknown>>
): void {
  let expected: string;
  switch (effect.effectType) {
    case "PAYMENT_LEDGER":
      expected = "payment";
      break;
    case "PROVIDER_FEE_LEDGER":
      expected = "fee";
      break;
    case "REFERRAL_REWARD":
      expected = "referral";
      break;
    case "PARTNER_COMMISSION":
      expected = "partner-commission";
      break;
    case "PARTNER_LIABILITY_LEDGER":
      expected = "partner-liability";
      break;
    case "RECONCILIATION":
      expected = "reconciliation";
      break;
    case "TAX_PROVISION":
      expected = intent.taxConfigId === null ? "tax:none" : "tax:" + String(intent.taxConfigId);
      break;
  }
  if (effect.effectKey !== expected) {
    fail("MANIFEST_TOPOLOGY_INVALID", "An effect key does not match its identity.");
  }
}

function validateLifecycleAgainstIntent(
  effect: PaymentFinalizationEffect,
  plannedStatus: string
): void {
  if (plannedStatus === "NOT_APPLICABLE") {
    if (effect.status !== "NOT_APPLICABLE") {
      fail("LIFECYCLE_INVALID", "A not-applicable intent changed lifecycle state.");
    }
    return;
  }
  if (plannedStatus === "AWAITING_DATA") {
    if (
      effect.effectType !== "PROVIDER_FEE_LEDGER" ||
      effect.status !== "AWAITING_DATA"
    ) {
      fail("LIFECYCLE_INVALID", "An awaiting-data intent changed lifecycle state.");
    }
    return;
  }
  if (plannedStatus !== "PENDING") {
    fail("INVALID_IMMUTABLE_INTENT", "An effect has an unsupported planned status.");
  }
  if (effect.status === "NOT_APPLICABLE" || effect.status === "AWAITING_DATA") {
    fail("LIFECYCLE_INVALID", "A pending intent has an incompatible lifecycle state.");
  }
}

function validateLinkage(
  effect: PaymentFinalizationEffect,
  intent: Readonly<Record<string, unknown>>
): void {
  const referralEffect = effect.effectType === "REFERRAL_REWARD";
  const partnerEffect =
    effect.effectType === "PARTNER_COMMISSION" ||
    effect.effectType === "PARTNER_LIABILITY_LEDGER";
  const taxEffect = effect.effectType === "TAX_PROVISION";
  if (!referralEffect && effect.referralId !== null) {
    fail("MANIFEST_TOPOLOGY_INVALID", "A non-referral effect has referral linkage.");
  }
  if (!partnerEffect && effect.partnerId !== null) {
    fail("MANIFEST_TOPOLOGY_INVALID", "A non-partner effect has partner linkage.");
  }
  if (!taxEffect && effect.taxConfigId !== null) {
    fail("MANIFEST_TOPOLOGY_INVALID", "A non-tax effect has tax linkage.");
  }
  if (referralEffect && intent.referralId !== effect.referralId) {
    fail("TRANSACTION_IDENTITY_MISMATCH", "Referral linkage does not match.");
  }
  if (partnerEffect && intent.partnerId !== effect.partnerId) {
    fail("TRANSACTION_IDENTITY_MISMATCH", "Partner linkage does not match.");
  }
  if (taxEffect && intent.taxConfigId !== effect.taxConfigId) {
    fail("TRANSACTION_IDENTITY_MISMATCH", "Tax linkage does not match.");
  }
}

function validateCrossIntent(
  parent: LoadedFinalization,
  effect: PaymentFinalizationEffect,
  intent: Readonly<Record<string, unknown>>
): void {
  if (
    intent.effectType !== effect.effectType ||
    intent.intentVersion !== INTENT_VERSION ||
    effect.intentVersion !== INTENT_VERSION
  ) {
    fail("UNSUPPORTED_VERSION", "An effect type or intent version is unsupported.");
  }

  switch (effect.effectType) {
    case "PAYMENT_LEDGER":
      if (
        originalIntentStatus(effect) !== "PENDING" ||
        requirePositiveCentavos(intent.amountCentavos, "Payment amount is invalid.") !==
          parent.purchaseAmountCentavos ||
        intent.userId !== parent.transaction.userId ||
        intent.planType !== parent.planType ||
        intent.debitCategory !== "CASH_PAYMONGO" ||
        intent.creditCategory !== "REVENUE_PREMIUM"
      ) {
        fail("INVALID_IMMUTABLE_INTENT", "Payment ledger intent does not match.");
      }
      break;
    case "PROVIDER_FEE_LEDGER": {
      const status = originalIntentStatus(effect);
      if (
        intent.feeKnowledge !== parent.feeKnowledge ||
        intent.feeAmountCentavos !== parent.feeAmountCentavos
      ) {
        fail("INVALID_IMMUTABLE_INTENT", "Provider-fee intent does not match.");
      }
      if (status === "PENDING") {
        if (
          parent.feeKnowledge !== "KNOWN" ||
          requirePositiveCentavos(intent.feeAmountCentavos, "Provider fee is invalid.") < 1 ||
          intent.debitCategory !== "EXPENSE_PAYMENT_FEE" ||
          intent.creditCategory !== "CASH_PAYMONGO"
        ) {
          fail("INVALID_IMMUTABLE_INTENT", "Known provider-fee intent is invalid.");
        }
      } else if (status === "AWAITING_DATA") {
        if (
          parent.feeKnowledge !== "UNKNOWN" ||
          intent.feeAmountCentavos !== null ||
          intent.debitCategory !== null ||
          intent.creditCategory !== null
        ) {
          fail("INVALID_IMMUTABLE_INTENT", "Awaiting provider-fee intent is invalid.");
        }
      } else if (
        status !== "NOT_APPLICABLE" ||
        parent.feeKnowledge !== "KNOWN" ||
        requireNonnegativeCentavos(intent.feeAmountCentavos, "Provider fee is invalid.") !== 0 ||
        intent.notApplicableReason !== "ZERO_PROVIDER_FEE" ||
        intent.debitCategory !== null ||
        intent.creditCategory !== null
      ) {
        fail("INVALID_IMMUTABLE_INTENT", "Not-applicable provider-fee intent is invalid.");
      }
      break;
    }
    case "REFERRAL_REWARD":
      if (
        intent.referredUserId !== parent.transaction.userId ||
        intent.purchaseAmountCentavos !== parent.purchaseAmountCentavos ||
        intent.currency !== SUPPORTED_CURRENCY
      ) {
        fail("INVALID_IMMUTABLE_INTENT", "Referral intent does not match.");
      }
      break;
    case "PARTNER_COMMISSION":
      if (intent.currency !== SUPPORTED_CURRENCY) {
        fail("INVALID_IMMUTABLE_INTENT", "Partner commission currency is invalid.");
      }
      break;
    case "PARTNER_LIABILITY_LEDGER":
    case "TAX_PROVISION":
      break;
    case "RECONCILIATION":
      if (
        originalIntentStatus(effect) !== "PENDING" ||
        intent.expectedPaymentCentavos !== parent.purchaseAmountCentavos ||
        intent.expectedFeeCentavos !== parent.feeAmountCentavos ||
        intent.feeKnowledge !== parent.feeKnowledge ||
        intent.sourceType !== "INTERNAL_TRANSACTION"
      ) {
        fail("INVALID_IMMUTABLE_INTENT", "Reconciliation intent does not match.");
      }
      break;
  }
}

function validateRevision2Chain(parent: LoadedFinalization): void {
  const revisions = parent.revisions ?? [];
  if (revisions.length < 2) {
    fail("REVISION_CHAIN_INVALID", "Revision 2 execution requires complete R1 and R2 revision history.");
  }
  const r1 = revisions.find((r) => r.manifestRevision === 1);
  const r2 = revisions.find((r) => r.manifestRevision === 2);
  if (!r1 || !r2) {
    fail("REVISION_CHAIN_INVALID", "Missing R1 or R2 revision archive record.");
  }
  if (r1.parentManifestHash !== null || r1.revisionReason !== "INITIAL_INGESTION") {
    fail("REVISION_CHAIN_INVALID", "Genesis R1 archive metadata is invalid.");
  }
  if (r2.parentManifestHash !== r1.manifestHash || r2.revisionReason !== "PROVIDER_FEE_ENRICHMENT") {
    fail("REVISION_CHAIN_INVALID", "R2 parent hash chain or reason is invalid.");
  }

  // Validate R1 snapshot intents and root manifest hash
  const r1Snapshot = r1.snapshot as unknown as PaymentFinalizationManifestSnapshot;
  const r1Effects = Array.isArray(r1Snapshot?.effects) ? (r1Snapshot.effects as readonly EffectManifestSnapshot[]) : [];
  for (const eff of r1Effects) {
    const computed = computeSha256Hash(canonicalizeJson(eff.intent));
    if (computed !== eff.intentHash) {
      fail("EFFECT_HASH_MISMATCH", "R1 archive effect intent hash does not match.");
    }
  }
  const r1Ordered = [...r1Effects].sort(compareEffects);
  const r1Summary = {
    manifestVersion: r1Snapshot.manifestVersion,
    manifestRevision: r1Snapshot.manifestRevision,
    transactionId: r1Snapshot.transactionId,
    checkoutSessionId: r1Snapshot.checkoutSessionId,
    userId: r1Snapshot.userId,
    providerPaymentId: r1Snapshot.providerPaymentId,
    providerPaidAt: r1Snapshot.providerPaidAt,
    source: r1Snapshot.source,
    origin: r1Snapshot.origin,
    planType: r1Snapshot.planType,
    currency: r1Snapshot.currency,
    purchaseAmountCentavos: r1Snapshot.purchaseAmountCentavos,
    feeKnowledge: r1Snapshot.feeKnowledge,
    feeAmountCentavos: r1Snapshot.feeAmountCentavos,
    feeObservedAt: r1Snapshot.feeObservedAt,
    verifiedAt: r1Snapshot.verifiedAt,
    entitlementBefore: r1Snapshot.entitlementBefore,
    entitlementAfter: r1Snapshot.entitlementAfter,
    effects: r1Ordered.map((eff) => ({
      effectType: eff.effectType,
      effectKey: eff.effectKey,
      operationKey: eff.operationKey,
      status: eff.status,
      intentVersion: eff.intentVersion,
      intentHash: eff.intentHash,
    })),
  };
  if (computeSha256Hash(canonicalizeJson(r1Summary)) !== r1.manifestHash) {
    fail("MANIFEST_HASH_MISMATCH", "R1 archive root manifest hash does not match.");
  }

  // Validate R2 snapshot intents and root manifest hash
  const r2Snapshot = r2.snapshot as unknown as PaymentFinalizationManifestSnapshot;
  const r2Effects = Array.isArray(r2Snapshot?.effects) ? (r2Snapshot.effects as readonly EffectManifestSnapshot[]) : [];
  for (const eff of r2Effects) {
    const computed = computeSha256Hash(canonicalizeJson(eff.intent));
    if (computed !== eff.intentHash) {
      fail("EFFECT_HASH_MISMATCH", "R2 archive effect intent hash does not match.");
    }
  }
  const r2Ordered = [...r2Effects].sort(compareEffects);
  const r2Summary = {
    manifestVersion: r2Snapshot.manifestVersion,
    manifestRevision: r2Snapshot.manifestRevision,
    transactionId: r2Snapshot.transactionId,
    checkoutSessionId: r2Snapshot.checkoutSessionId,
    userId: r2Snapshot.userId,
    providerPaymentId: r2Snapshot.providerPaymentId,
    providerPaidAt: r2Snapshot.providerPaidAt,
    source: r2Snapshot.source,
    origin: r2Snapshot.origin,
    planType: r2Snapshot.planType,
    currency: r2Snapshot.currency,
    purchaseAmountCentavos: r2Snapshot.purchaseAmountCentavos,
    feeKnowledge: r2Snapshot.feeKnowledge,
    feeAmountCentavos: r2Snapshot.feeAmountCentavos,
    feeObservedAt: r2Snapshot.feeObservedAt,
    verifiedAt: r2Snapshot.verifiedAt,
    entitlementBefore: r2Snapshot.entitlementBefore,
    entitlementAfter: r2Snapshot.entitlementAfter,
    effects: r2Ordered.map((eff) => ({
      effectType: eff.effectType,
      effectKey: eff.effectKey,
      operationKey: eff.operationKey,
      status: eff.status,
      intentVersion: eff.intentVersion,
      intentHash: eff.intentHash,
    })),
  };
  if (computeSha256Hash(canonicalizeJson(r2Summary)) !== r2.manifestHash) {
    fail("MANIFEST_HASH_MISMATCH", "R2 archive root manifest hash does not match.");
  }

  // Verify current projection matches R2 archive
  if (parent.manifestHash !== r2.manifestHash) {
    fail("MANIFEST_HASH_MISMATCH", "Current PaymentFinalization manifestHash does not match R2 archive manifestHash.");
  }
}

function validateManifest(
  parent: LoadedFinalization
): readonly PaymentFinalizationEffect[] {
  if (
    parent.manifestVersion !== MANIFEST_VERSION ||
    (parent.manifestRevision !== 1 && parent.manifestRevision !== 2)
  ) {
    fail("UNSUPPORTED_VERSION", "The manifest version or revision is unsupported.");
  }
  if (parent.manifestRevision === 2) {
    validateRevision2Chain(parent);
  }
  if (!HASH_PATTERN.test(parent.manifestHash)) {
    fail("MANIFEST_HASH_MISMATCH", "The manifest hash representation is invalid.");
  }
  if (
    parent.transaction.id !== parent.transactionId ||
    parent.transaction.checkoutSessionId !== parent.checkoutSessionId ||
    parent.transaction.planType !== parent.planType
  ) {
    fail("TRANSACTION_IDENTITY_MISMATCH", "Parent and transaction identity do not match.");
  }
  if (
    parent.currency !== SUPPORTED_CURRENCY ||
    !SUPPORTED_PLAN_TYPES.includes(
      parent.planType as (typeof SUPPORTED_PLAN_TYPES)[number]
    ) ||
    !Number.isSafeInteger(parent.purchaseAmountCentavos) ||
    parent.purchaseAmountCentavos <= 0
  ) {
    fail("INVALID_IMMUTABLE_INTENT", "Parent immutable financial fields are invalid.");
  }

  const counts = new Map<PaymentFinalizationEffect["effectType"], number>();
  const effectKeys = new Set<string>();
  const operationKeys = new Set<string>();
  let hasTaxNone = false;
  let hasConfiguredTax = false;

  for (const effect of parent.effects) {
    if (effect.finalizationId !== parent.id) {
      fail("MANIFEST_TOPOLOGY_INVALID", "An effect belongs to another finalization.");
    }
    counts.set(effect.effectType, (counts.get(effect.effectType) ?? 0) + 1);
    if (effectKeys.has(effect.effectKey) || operationKeys.has(effect.operationKey)) {
      fail("MANIFEST_TOPOLOGY_INVALID", "The manifest has duplicate effect identities.");
    }
    effectKeys.add(effect.effectKey);
    operationKeys.add(effect.operationKey);

    const intent = requireRecord(
      effect.intent,
      "INVALID_IMMUTABLE_INTENT",
      "An effect intent is not a JSON object."
    );
    const computedIntentHash = computeSha256Hash(canonicalizeJson(effect.intent));
    if (!HASH_PATTERN.test(effect.intentHash) || computedIntentHash !== effect.intentHash) {
      fail("EFFECT_HASH_MISMATCH", "An effect intent hash does not match.");
    }
    validateEffectKey(effect, intent);
    if (effect.operationKey !== expectedOperationKey(parent.transactionId, effect, intent)) {
      fail("OPERATION_KEY_MISMATCH", "An effect operation key does not match.");
    }
    validateLifecycleAgainstIntent(effect, originalIntentStatus(effect));
    validateLinkage(effect, intent);
    validateCrossIntent(parent, effect, intent);
    if (effect.effectType === "TAX_PROVISION") {
      hasTaxNone ||= effect.taxConfigId === null;
      hasConfiguredTax ||= effect.taxConfigId !== null;
    }
  }

  const singletonTypes: readonly PaymentFinalizationEffect["effectType"][] = [
    "PAYMENT_LEDGER",
    "PROVIDER_FEE_LEDGER",
    "REFERRAL_REWARD",
    "PARTNER_COMMISSION",
    "PARTNER_LIABILITY_LEDGER",
    "RECONCILIATION",
  ];
  if (
    singletonTypes.some((type) => counts.get(type) !== 1) ||
    (counts.get("TAX_PROVISION") ?? 0) < 1 ||
    (hasTaxNone && hasConfiguredTax) ||
    (hasTaxNone && counts.get("TAX_PROVISION") !== 1)
  ) {
    fail("MANIFEST_TOPOLOGY_INVALID", "Effect topology or cardinality is invalid.");
  }

  const commission = parent.effects.find(
    (effect) => effect.effectType === "PARTNER_COMMISSION"
  );
  const liability = parent.effects.find(
    (effect) => effect.effectType === "PARTNER_LIABILITY_LEDGER"
  );
  if (!commission || !liability) {
    fail("MANIFEST_TOPOLOGY_INVALID", "The partner effect pair is incomplete.");
  }
  const commissionIntent = requireRecord(
    commission.intent,
    "INVALID_IMMUTABLE_INTENT",
    "Partner commission intent is invalid."
  );
  const liabilityIntent = requireRecord(
    liability.intent,
    "INVALID_IMMUTABLE_INTENT",
    "Partner liability intent is invalid."
  );
  if (
    commissionIntent.status !== liabilityIntent.status ||
    commissionIntent.partnerId !== liabilityIntent.partnerId ||
    (commissionIntent.status === "PENDING" &&
      commissionIntent.commissionAmountCentavos !== liabilityIntent.amountCentavos)
  ) {
    fail("MANIFEST_TOPOLOGY_INVALID", "The partner effect pair is inconsistent.");
  }

  const ordered = [...parent.effects].sort(compareEffects);
  const manifestSummary = {
    manifestVersion: parent.manifestVersion,
    manifestRevision: parent.manifestRevision,
    transactionId: parent.transactionId,
    checkoutSessionId: parent.checkoutSessionId,
    userId: parent.transaction.userId,
    providerPaymentId: parent.providerPaymentId,
    providerPaidAt: parent.providerPaidAt?.toISOString() ?? null,
    source: parent.source,
    origin: parent.origin,
    planType: parent.planType,
    currency: parent.currency,
    purchaseAmountCentavos: parent.purchaseAmountCentavos,
    feeKnowledge: parent.feeKnowledge,
    feeAmountCentavos: parent.feeAmountCentavos,
    feeObservedAt: parent.feeObservedAt?.toISOString() ?? null,
    verifiedAt: parent.verifiedAt.toISOString(),
    entitlementBefore: parent.entitlementBefore?.toISOString() ?? null,
    entitlementAfter: parent.entitlementAfter?.toISOString() ?? null,
    effects: ordered.map((effect) => ({
      effectType: effect.effectType,
      effectKey: effect.effectKey,
      operationKey: effect.operationKey,
      status: originalIntentStatus(effect),
      intentVersion: effect.intentVersion,
      intentHash: effect.intentHash,
    })),
  };
  const computedManifestHash = computeSha256Hash(canonicalizeJson(manifestSummary));
  if (computedManifestHash !== parent.manifestHash) {
    fail("MANIFEST_HASH_MISMATCH", "The immutable root manifest hash does not match.");
  }
  return ordered;
}

async function acquireTransactionRootLock(
  tx: Prisma.TransactionClient,
  transactionId: string
): Promise<void> {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${transactionId}, 0)
    )::text AS lock_result
  `;
}

async function loadFinalization(
  tx: Prisma.TransactionClient,
  finalizationId: string
): Promise<LoadedFinalization | null> {
  return tx.paymentFinalization.findUnique({
    where: { id: finalizationId },
    include: { transaction: true, effects: true, revisions: true },
  });
}

function requireOwnedLease(
  parent: LoadedFinalization,
  workerId: string,
  claimedGeneration: number,
  now: Date
): void {
  if (
    parent.status !== "PROCESSING" ||
    parent.leaseOwner !== workerId ||
    parent.attemptCount !== claimedGeneration ||
    parent.leaseExpiresAt === null ||
    parent.leaseExpiresAt.getTime() <= now.getTime()
  ) {
    throw new LeaseLostError();
  }
}

async function validateRefundState(
  tx: Prisma.TransactionClient,
  parent: LoadedFinalization
): Promise<void> {
  const reversalCount = await tx.financialLedgerEntry.count({
    where: {
      transactionId: parent.transactionId,
      transactionType: { in: ["REFUND_REVERSAL", "CHARGEBACK_REVERSAL"] },
    },
  });
  if (parent.transaction.status === "REFUNDED" || reversalCount > 0) {
    fail(
      "REFUND_CONFLICT",
      "Authoritative refund or chargeback evidence conflicts with finalization."
    );
  }
  if (parent.transaction.status !== "PAID") {
    fail("TRANSACTION_IDENTITY_MISMATCH", "The transaction is not paid.");
  }
}

function isRunnable(effect: PaymentFinalizationEffect, now: Date): boolean {
  return (
    effect.status === "PENDING" ||
    (effect.status === "FAILED_RETRYABLE" &&
      effect.nextAttemptAt.getTime() <= now.getTime())
  );
}

function _nextEffectGroup(
  parent: LoadedFinalization,
  ordered: readonly PaymentFinalizationEffect[],
  now: Date
): EffectGroup | null {
  const byType = (type: PaymentFinalizationEffect["effectType"]) =>
    ordered.filter((effect) => effect.effectType === type);
  const singleton = (
    type: PaymentFinalizationEffect["effectType"],
    kind: "PAYMENT" | "FEE" | "REFERRAL"
  ): EffectGroup | null => {
    const effect = byType(type)[0];
    return effect && isRunnable(effect, now)
      ? { kind, effectIds: [effect.id] }
      : null;
  };

  const payment = singleton("PAYMENT_LEDGER", "PAYMENT");
  if (payment) return payment;
  const fee = singleton("PROVIDER_FEE_LEDGER", "FEE");
  if (fee) return fee;
  const referral = singleton("REFERRAL_REWARD", "REFERRAL");
  if (referral) return referral;

  const commission = byType("PARTNER_COMMISSION")[0];
  const liability = byType("PARTNER_LIABILITY_LEDGER")[0];
  if (commission && liability) {
    const bothTerminal =
      (commission.status === "COMPLETE" && liability.status === "COMPLETE") ||
      (commission.status === "NOT_APPLICABLE" &&
        liability.status === "NOT_APPLICABLE");
    if (!bothTerminal && (isRunnable(commission, now) || isRunnable(liability, now))) {
      return {
        kind: "PARTNER_PAIR",
        effectIds: [commission.id, liability.id],
      };
    }
  }

  for (const tax of byType("TAX_PROVISION")) {
    if (isRunnable(tax, now)) {
      return { kind: "TAX", effectIds: [tax.id] };
    }
  }

  const reconciliation = byType("RECONCILIATION")[0];
  const siblingsTerminal = parent.effects
    .filter((effect) => effect.effectType !== "RECONCILIATION")
    .every(
      (effect) =>
        effect.status === "COMPLETE" || effect.status === "NOT_APPLICABLE"
    );
  if (reconciliation && siblingsTerminal && isRunnable(reconciliation, now)) {
    return { kind: "RECONCILIATION", effectIds: [reconciliation.id] };
  }
  return null;
}


function nextStrictEffectGroup(
  parent: LoadedFinalization,
  ordered: readonly PaymentFinalizationEffect[],
  now: Date
): EffectGroup | null {
  const byType = (type: PaymentFinalizationEffect["effectType"]) =>
    ordered.filter((effect) => effect.effectType === type);
  const terminal = (effect: PaymentFinalizationEffect) =>
    effect.status === "COMPLETE" || effect.status === "NOT_APPLICABLE";

  const payment = byType("PAYMENT_LEDGER")[0];
  if (!terminal(payment)) {
    return isRunnable(payment, now)
      ? { kind: "PAYMENT", effectIds: [payment.id] }
      : null;
  }
  const fee = byType("PROVIDER_FEE_LEDGER")[0];
  if (!terminal(fee) && fee.status !== "AWAITING_DATA") {
    return isRunnable(fee, now)
      ? { kind: "FEE", effectIds: [fee.id] }
      : null;
  }
  const referral = byType("REFERRAL_REWARD")[0];
  if (!terminal(referral)) {
    return isRunnable(referral, now)
      ? { kind: "REFERRAL", effectIds: [referral.id] }
      : null;
  }

  const commission = byType("PARTNER_COMMISSION")[0];
  const liability = byType("PARTNER_LIABILITY_LEDGER")[0];
  const partnerTerminal =
    (commission.status === "COMPLETE" && liability.status === "COMPLETE") ||
    (commission.status === "NOT_APPLICABLE" &&
      liability.status === "NOT_APPLICABLE");
  if (!partnerTerminal) {
    return isRunnable(commission, now) || isRunnable(liability, now)
      ? {
          kind: "PARTNER_PAIR",
          effectIds: [commission.id, liability.id],
        }
      : null;
  }

  for (const tax of byType("TAX_PROVISION")) {
    if (!terminal(tax)) {
      return isRunnable(tax, now)
        ? { kind: "TAX", effectIds: [tax.id] }
        : null;
    }
  }

  const reconciliation = byType("RECONCILIATION")[0];
  const siblingsTerminal = parent.effects
    .filter((effect) => effect.effectType !== "RECONCILIATION")
    .every(terminal);
  if (!siblingsTerminal) return null;
  if (!terminal(reconciliation)) {
    return isRunnable(reconciliation, now)
      ? { kind: "RECONCILIATION", effectIds: [reconciliation.id] }
      : null;
  }
  return null;
}

function isParkedAwaitingData(parent: LoadedFinalization): boolean {
  const feeEffects = parent.effects.filter(
    (effect) => effect.effectType === "PROVIDER_FEE_LEDGER"
  );
  const reconciliationEffects = parent.effects.filter(
    (effect) => effect.effectType === "RECONCILIATION"
  );
  if (
    feeEffects.length !== 1 ||
    feeEffects[0].status !== "AWAITING_DATA" ||
    reconciliationEffects.length !== 1 ||
    !["PENDING", "FAILED_RETRYABLE"].includes(reconciliationEffects[0].status)
  ) {
    return false;
  }
  if (
    !parent.effects.every(
      (effect) =>
        effect.effectType === "PROVIDER_FEE_LEDGER" ||
        effect.effectType === "RECONCILIATION" ||
        effect.status === "COMPLETE" ||
        effect.status === "NOT_APPLICABLE"
    )
  ) {
    return false;
  }
  try {
    validateManifest(parent);
    return true;
  } catch {
    return false;
  }
}

function earliestFutureRetry(
  parent: LoadedFinalization,
  now: Date
): Date | null {
  const candidates = parent.effects
    .filter(
      (effect) =>
        effect.status === "FAILED_RETRYABLE" &&
        effect.nextAttemptAt.getTime() > now.getTime()
    )
    .map((effect) => effect.nextAttemptAt.getTime());
  return candidates.length > 0 ? new Date(Math.min(...candidates)) : null;
}

function classifyExecutionError(error: unknown): FailureClassification {
  if (error instanceof IdempotentLedgerError) {
    return {
      retryable: error.code === "LEDGER_CONCURRENT_IDENTITY_CONFLICT",
      code: error.code,
      message: "Ledger execution failed with controlled code " + error.code + ".",
    };
  }
  if (
    error instanceof ReferralRewardExecutionError ||
    error instanceof PartnerCommissionExecutionError ||
    error instanceof TaxProvisionExecutionError ||
    error instanceof ReconciliationExecutionError
  ) {
    return {
      retryable:
        error.code === "CONCURRENT_IDENTITY_CONFLICT" ||
        error.code === "DATABASE_EXECUTION_FAILED",
      code: error.code,
      message: "Financial execution failed with controlled code " + error.code + ".",
    };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return {
      retryable: true,
      code: "P2034",
      message: "The database transaction requires a bounded retry.",
    };
  }
  if (error instanceof CoordinatorInvariantError) {
    return { retryable: false, code: error.code, message: error.message };
  }
  if (error instanceof LifecycleCasError) {
    return {
      retryable: false,
      code: "LIFECYCLE_INVALID",
      message: "A financial lifecycle compare-and-set was inconsistent.",
    };
  }
  return {
    retryable: false,
    code: "COORDINATOR_UNCLASSIFIED_ERROR",
    message: "An unclassified coordinator error requires manual review.",
  };
}

function makeResult(
  finalizationId: string,
  outcome: ExecuteFinalizationOutcome,
  completedEffectIds: readonly string[] = [],
  nextAttemptAt: Date | null = null,
  errorCode: string | null = null
): ExecuteFinalizationResult {
  return {
    finalizationId,
    outcome,
    completedEffectIds,
    nextAttemptAt,
    errorCode,
  };
}

class PaymentFinalizationCoordinatorEngine implements CoordinatorRuntime {
  constructor(
    private readonly dependencies: PaymentFinalizationCoordinatorTestDependencies
  ) {}

  async executeFinalization(
    input: ExecuteFinalizationInput
  ): Promise<ExecuteFinalizationResult> {
    return (await this.executeClaimed(input)).result;
  }

  async recoverDueFinalizations(
    input: RecoverDueFinalizationsInput
  ): Promise<RecoverDueFinalizationsResult> {
    const workerId = validateIdentifier(
      input.workerId,
      "workerId",
      WORKER_ID_MAX_LENGTH
    );
    const now = validateNow(input.now);
    const batchSize = validateBatchSize(input.batchSize);
    const candidateIds = await this.dependencies.findDueFinalizationIds(
      now,
      batchSize
    );
    const results: ExecuteFinalizationResult[] = [];
    let claimed = 0;
    for (const finalizationId of candidateIds) {
      const execution = await this.executeClaimed({
        finalizationId,
        workerId,
        now,
      });
      results.push(execution.result);
      if (execution.claimed) claimed++;
    }
    return { examined: candidateIds.length, claimed, results };
  }

  private async executeClaimed(
    input: ExecuteFinalizationInput
  ): Promise<ClaimedExecutionResult> {
    const finalizationId = validateIdentifier(
      input.finalizationId,
      "finalizationId",
      FINALIZATION_ID_MAX_LENGTH
    );
    const workerId = validateIdentifier(
      input.workerId,
      "workerId",
      WORKER_ID_MAX_LENGTH
    );
    const now = validateNow(input.now);
    const leaseExpiresAt = addMilliseconds(now, LEASE_DURATION_MS);

    const claim = await this.dependencies.runInTransaction(async (tx) => {
      const current = await loadFinalization(tx, finalizationId);
      if (!current) {
        return {
          kind: "TERMINAL" as const,
          result: makeResult(
            finalizationId,
            "MANUAL_REVIEW",
            [],
            null,
            "FINALIZATION_NOT_FOUND"
          ),
        };
      }
      if (current.status === "COMPLETE") {
        return {
          kind: "TERMINAL" as const,
          result: makeResult(finalizationId, "ALREADY_COMPLETE"),
        };
      }
      if (current.status === "MANUAL_REVIEW") {
        return {
          kind: "TERMINAL" as const,
          result: makeResult(
            finalizationId,
            "MANUAL_REVIEW",
            [],
            null,
            current.manualReviewReasonCode ?? current.lastErrorCode
          ),
        };
      }

      const hasOwner = current.leaseOwner !== null;
      const hasExpiry = current.leaseExpiresAt !== null;
      if (
        current.status === "PROCESSING" &&
        (hasOwner !== hasExpiry || (!hasOwner && !hasExpiry))
      ) {
        const invalidCas = await tx.paymentFinalization.updateMany({
          where: {
            id: current.id,
            status: current.status,
            leaseOwner: current.leaseOwner,
            leaseExpiresAt: current.leaseExpiresAt,
          },
          data: {
            status: "MANUAL_REVIEW",
            leaseOwner: null,
            leaseExpiresAt: null,
            lastAttemptAt: now,
            lastErrorCode: "LEASE_STATE_INVALID",
            lastErrorMessage: "The PROCESSING parent has an invalid lease structure.",
            manualReviewReasonCode: "LEASE_STATE_INVALID",
          },
        });
        return {
          kind: "TERMINAL" as const,
          result:
            invalidCas.count === 1
              ? makeResult(
                  finalizationId,
                  "MANUAL_REVIEW",
                  [],
                  null,
                  "LEASE_STATE_INVALID"
                )
              : makeResult(finalizationId, "LEASE_NOT_ACQUIRED"),
        };
      }

      if (
        current.status === "PENDING" &&
        !hasOwner &&
        !hasExpiry &&
        isParkedAwaitingData(current)
      ) {
        return {
          kind: "TERMINAL" as const,
          result: makeResult(finalizationId, "AWAITING_DATA"),
        };
      }

      const processingExpired =
        current.status === "PROCESSING" &&
        current.leaseOwner !== null &&
        current.leaseExpiresAt !== null &&
        current.leaseExpiresAt.getTime() <= now.getTime();
      const retryDue =
        current.status === "FAILED_RETRYABLE" &&
        current.nextAttemptAt.getTime() <= now.getTime();
      const claimable =
        current.status === "PENDING" || retryDue || processingExpired;
      if (!claimable) {
        return {
          kind: "TERMINAL" as const,
          result: makeResult(finalizationId, "LEASE_NOT_ACQUIRED"),
        };
      }

      if (current.attemptCount >= MAX_AUTOMATIC_PARENT_ATTEMPTS) {
        const maxCas = await tx.paymentFinalization.updateMany({
          where: {
            id: current.id,
            status: current.status,
            leaseOwner: current.leaseOwner,
            leaseExpiresAt: current.leaseExpiresAt,
            attemptCount: current.attemptCount,
          },
          data: {
            status: "MANUAL_REVIEW",
            leaseOwner: null,
            leaseExpiresAt: null,
            lastAttemptAt: now,
            lastErrorCode: "MAX_ATTEMPTS_EXCEEDED",
            lastErrorMessage: "The parent automatic-attempt limit was reached.",
            manualReviewReasonCode: "MAX_ATTEMPTS_EXCEEDED",
          },
        });
        return {
          kind: "TERMINAL" as const,
          result:
            maxCas.count === 1
              ? makeResult(
                  finalizationId,
                  "MANUAL_REVIEW",
                  [],
                  null,
                  "MAX_ATTEMPTS_EXCEEDED"
                )
              : makeResult(finalizationId, "LEASE_NOT_ACQUIRED"),
        };
      }

      const claimCas = await tx.paymentFinalization.updateMany({
        where: {
          id: current.id,
          status: current.status,
          leaseOwner: current.leaseOwner,
          leaseExpiresAt: current.leaseExpiresAt,
          attemptCount: current.attemptCount,
          ...(current.status === "FAILED_RETRYABLE"
            ? { nextAttemptAt: { lte: now } }
            : {}),
        },
        data: {
          status: "PROCESSING",
          leaseOwner: workerId,
          leaseExpiresAt,
          attemptCount: { increment: 1 },
          lastAttemptAt: now,
        },
      });
      if (claimCas.count !== 1) {
        return {
          kind: "TERMINAL" as const,
          result: makeResult(finalizationId, "LEASE_NOT_ACQUIRED"),
        };
      }
      return {
        kind: "CLAIMED" as const,
        transactionId: current.transactionId,
        claimedGeneration: current.attemptCount + 1,
      };
    });

    if (claim.kind === "TERMINAL") {
      return { claimed: false, result: claim.result };
    }

    const completedEffectIds: string[] = [];
    for (;;) {
      let parent: LoadedFinalization;
      try {
        parent = await this.dependencies.runInTransaction(async (tx) => {
          await acquireTransactionRootLock(tx, claim.transactionId);
          const loaded = await loadFinalization(tx, finalizationId);
          if (!loaded) {
            fail("FINALIZATION_NOT_FOUND", "The claimed finalization disappeared.");
          }
          requireOwnedLease(loaded, workerId, claim.claimedGeneration, now);
          validateManifest(loaded);
          await validateRefundState(tx, loaded);
          return loaded;
        });
      } catch (error: unknown) {
        if (error instanceof LeaseLostError) {
          return {
            claimed: true,
            result: makeResult(finalizationId, "LEASE_LOST", completedEffectIds),
          };
        }
        return {
          claimed: true,
          result: await this.recordPreflightFailure(
            finalizationId,
            claim.transactionId,
            workerId,
            claim.claimedGeneration,
            now,
            completedEffectIds,
            error
          ),
        };
      }

      if (parent.effects.some((effect) => effect.status === "MANUAL_REVIEW")) {
        return {
          claimed: true,
          result: await this.recordPreflightFailure(
            finalizationId,
            claim.transactionId,
            workerId,
            claim.claimedGeneration,
            now,
            completedEffectIds,
            new CoordinatorInvariantError(
              "LIFECYCLE_INVALID",
              "An effect is already in manual review."
            )
          ),
        };
      }

      const ordered = [...parent.effects].sort(compareEffects);
      const group = nextStrictEffectGroup(parent, ordered, now);
      if (group) {
        try {
          const success = await this.executeGroup(
            finalizationId,
            claim.transactionId,
            workerId,
            claim.claimedGeneration,
            now,
            group
          );
          completedEffectIds.push(...success.completedEffectIds);
          if (success.manualReview) {
            return {
              claimed: true,
              result: makeResult(
                finalizationId,
                "MANUAL_REVIEW",
                completedEffectIds,
                null,
                success.errorCode
              ),
            };
          }
          if (success.parentComplete) {
            return {
              claimed: true,
              result: makeResult(
                finalizationId,
                "COMPLETE",
                completedEffectIds
              ),
            };
          }
          continue;
        } catch (error: unknown) {
          if (error instanceof LeaseLostError) {
            return {
              claimed: true,
              result: makeResult(
                finalizationId,
                "LEASE_LOST",
                completedEffectIds
              ),
            };
          }
          return {
            claimed: true,
            result: await this.recordExecutionFailure(
              finalizationId,
              claim.transactionId,
              workerId,
              claim.claimedGeneration,
              now,
              group,
              completedEffectIds,
              error
            ),
          };
        }
      }

      const awaiting = parent.effects.some(
        (effect) => effect.status === "AWAITING_DATA"
      );
      if (awaiting) {
        return {
          claimed: true,
          result: await this.parkAwaitingData(
            finalizationId,
            claim.transactionId,
            workerId,
            claim.claimedGeneration,
            now,
            completedEffectIds
          ),
        };
      }

      const nextAttemptAt = earliestFutureRetry(parent, now);
      if (nextAttemptAt) {
        return {
          claimed: true,
          result: await this.releaseUntilRetry(
            finalizationId,
            claim.transactionId,
            workerId,
            claim.claimedGeneration,
            now,
            nextAttemptAt,
            completedEffectIds
          ),
        };
      }

      const allTerminal = parent.effects.every(
        (effect) =>
          effect.status === "COMPLETE" || effect.status === "NOT_APPLICABLE"
      );
      const reconciliation = parent.effects.find(
        (effect) => effect.effectType === "RECONCILIATION"
      );
      if (allTerminal && reconciliation?.status === "COMPLETE") {
        return {
          claimed: true,
          result: await this.completeRecoveredParent(
            finalizationId,
            claim.transactionId,
            workerId,
            claim.claimedGeneration,
            now,
            completedEffectIds
          ),
        };
      }

      return {
        claimed: true,
        result: await this.recordPreflightFailure(
          finalizationId,
          claim.transactionId,
          workerId,
          claim.claimedGeneration,
          now,
          completedEffectIds,
          new CoordinatorInvariantError(
            "LIFECYCLE_INVALID",
            "No valid deterministic transition exists for the current lifecycle."
          )
        ),
      };
    }
  }

  private async executeGroup(
    finalizationId: string,
    transactionId: string,
    workerId: string,
    claimedGeneration: number,
    now: Date,
    group: EffectGroup
  ): Promise<GroupSuccess> {
    return this.dependencies.runInTransaction(async (tx) => {
      await acquireTransactionRootLock(tx, transactionId);
      const parent = await loadFinalization(tx, finalizationId);
      if (!parent) {
        fail("FINALIZATION_NOT_FOUND", "The claimed finalization disappeared.");
      }
      requireOwnedLease(parent, workerId, claimedGeneration, now);
      const ordered = validateManifest(parent);
      await validateRefundState(tx, parent);

      const expected = nextStrictEffectGroup(parent, ordered, now);
      if (
        !expected ||
        expected.kind !== group.kind ||
        expected.effectIds.length !== group.effectIds.length ||
        expected.effectIds.some(
          (effectId, index) => effectId !== group.effectIds[index]
        )
      ) {
        fail("LIFECYCLE_INVALID", "The deterministic effect group changed.");
      }

      let reconciliationResult: ExecuteReconciliationEffectResult | null = null;
      switch (group.kind) {
        case "PAYMENT": {
          const effect = effectById(parent, group.effectIds[0]);
          const intent = requireRecord(
            effect.intent,
            "INVALID_IMMUTABLE_INTENT",
            "Payment ledger intent is invalid."
          );
          await this.dependencies.postLedger(
            {
              transactionId,
              finalizationEffectId: effect.id,
              operation: { kind: "PAYMENT" },
              operationKey: effect.operationKey,
              transactionType: "PAYMENT_RECEIVED",
              debitCategory: "CASH_PAYMONGO",
              creditCategory: "REVENUE_PREMIUM",
              amountCentavos: requirePositiveCentavos(
                intent.amountCentavos,
                "Payment ledger amount is invalid."
              ),
              currency: SUPPORTED_CURRENCY,
              sourceEntity: "PaymentFinalization",
              sourceId: parent.id,
              description: "Subscription payment " + parent.planType,
              effectiveDate: parent.verifiedAt,
              periodId: null,
              createdBy: null,
            },
            tx
          );
          break;
        }
        case "FEE": {
          const effect = effectById(parent, group.effectIds[0]);
          const intent = requireRecord(
            effect.intent,
            "INVALID_IMMUTABLE_INTENT",
            "Provider-fee intent is invalid."
          );
          await this.dependencies.postLedger(
            {
              transactionId,
              finalizationEffectId: effect.id,
              operation: { kind: "FEE" },
              operationKey: effect.operationKey,
              transactionType: "PAYMONGO_FEE",
              debitCategory: "EXPENSE_PAYMENT_FEE",
              creditCategory: "CASH_PAYMONGO",
              amountCentavos: requirePositiveCentavos(
                intent.feeAmountCentavos,
                "Provider-fee amount is invalid."
              ),
              currency: SUPPORTED_CURRENCY,
              sourceEntity: "PaymentFinalization",
              sourceId: parent.id,
              description: "Provider fee for transaction " + transactionId,
              effectiveDate: parent.verifiedAt,
              periodId: null,
              createdBy: null,
            },
            tx
          );
          break;
        }
        case "REFERRAL":
          await this.dependencies.executeReferral({
            transactionId,
            finalizationEffectId: group.effectIds[0],
            tx,
          });
          break;
        case "PARTNER_PAIR":
          await this.dependencies.executePartnerPair({
            transactionId,
            commissionEffectId: group.effectIds[0],
            liabilityEffectId: group.effectIds[1],
            tx,
          });
          break;
        case "TAX":
          await this.dependencies.executeTax({
            transactionId,
            taxEffectId: group.effectIds[0],
            tx,
          });
          break;
        case "RECONCILIATION":
          reconciliationResult = await this.dependencies.executeReconciliation({
            transactionId,
            reconciliationEffectId: group.effectIds[0],
            tx,
          });
          break;
      }

      const discrepancy = reconciliationResult?.outcome === "DISCREPANCY";
      for (const effectId of group.effectIds) {
        const loadedEffect = effectById(parent, effectId);
        const lifecycleCas = await tx.paymentFinalizationEffect.updateMany({
          where: {
            id: effectId,
            finalizationId,
            status: loadedEffect.status,
          },
          data: discrepancy
            ? {
                status: "MANUAL_REVIEW",
                attemptCount: { increment: 1 },
                lastAttemptAt: now,
                lastErrorCode: "RECONCILIATION_DISCREPANCY",
                lastErrorMessage: "Reconciliation produced a controlled discrepancy.",
                manualReviewReasonCode: "RECONCILIATION_DISCREPANCY",
              }
            : {
                status: "COMPLETE",
                attemptCount: { increment: 1 },
                lastAttemptAt: now,
                completedAt: loadedEffect.completedAt ?? now,
                lastErrorCode: null,
                lastErrorMessage: null,
                manualReviewReasonCode: null,
              },
        });
        if (lifecycleCas.count !== 1) throw new LifecycleCasError();
      }

      if (discrepancy) {
        await this.updateOwnedParent(
          tx,
          finalizationId,
          workerId,
          claimedGeneration,
          {
          status: "MANUAL_REVIEW",
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: "RECONCILIATION_DISCREPANCY",
          lastErrorMessage: "Reconciliation produced a controlled discrepancy.",
          manualReviewReasonCode: "RECONCILIATION_DISCREPANCY",
          }
        );
        return {
          completedEffectIds: [],
          parentComplete: false,
          manualReview: true,
          errorCode: "RECONCILIATION_DISCREPANCY",
        };
      }

      if (group.kind === "RECONCILIATION") {
        const siblingsTerminal = parent.effects
          .filter((effect) => effect.effectType !== "RECONCILIATION")
          .every(
            (effect) =>
              effect.status === "COMPLETE" ||
              effect.status === "NOT_APPLICABLE"
          );
        if (!siblingsTerminal) {
          fail(
            "LIFECYCLE_INVALID",
            "Reconciliation completed before every sibling was terminal."
          );
        }
        await this.updateOwnedParent(
          tx,
          finalizationId,
          workerId,
          claimedGeneration,
          {
          status: "COMPLETE",
          completedAt: now,
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          manualReviewReasonCode: null,
          }
        );
        return {
          completedEffectIds: group.effectIds,
          parentComplete: true,
          manualReview: false,
          errorCode: null,
        };
      }

      await this.updateOwnedParent(
        tx,
        finalizationId,
        workerId,
        claimedGeneration,
        {
        leaseExpiresAt: addMilliseconds(now, LEASE_DURATION_MS),
        lastErrorCode: null,
        lastErrorMessage: null,
        manualReviewReasonCode: null,
        }
      );
      return {
        completedEffectIds: group.effectIds,
        parentComplete: false,
        manualReview: false,
        errorCode: null,
      };
    });
  }

  private async updateOwnedParent(
    tx: Prisma.TransactionClient,
    finalizationId: string,
    workerId: string,
    claimedGeneration: number,
    data: Prisma.PaymentFinalizationUpdateManyMutationInput
  ): Promise<void> {
    const lifecycleCas = await tx.paymentFinalization.updateMany({
      where: {
        id: finalizationId,
        status: "PROCESSING",
        leaseOwner: workerId,
        attemptCount: claimedGeneration,
      },
      data,
    });
    if (lifecycleCas.count !== 1) throw new LeaseLostError();
  }

  private async recordPreflightFailure(
    finalizationId: string,
    transactionId: string,
    workerId: string,
    claimedGeneration: number,
    now: Date,
    completedEffectIds: readonly string[],
    error: unknown
  ): Promise<ExecuteFinalizationResult> {
    const classification = classifyExecutionError(error);
    try {
      const recorded = await this.dependencies.runInTransaction(async (tx) => {
        await acquireTransactionRootLock(tx, transactionId);
        const parent = await loadFinalization(tx, finalizationId);
        if (!parent) throw new LeaseLostError();
        requireOwnedLease(parent, workerId, claimedGeneration, now);
        const retryableP2034 =
          classification.retryable && classification.code === "P2034";
        const manual =
          !retryableP2034 ||
          parent.attemptCount >= MAX_AUTOMATIC_PARENT_ATTEMPTS;
        const code =
          retryableP2034 && manual
            ? "MAX_ATTEMPTS_EXCEEDED"
            : classification.code;
        const retryIndex = Math.min(
          Math.max(parent.attemptCount - 1, 0),
          RETRY_DELAYS_MS.length - 1
        );
        const nextAttemptAt = manual
          ? null
          : addMilliseconds(now, RETRY_DELAYS_MS[retryIndex]);
        await this.updateOwnedParent(
          tx,
          finalizationId,
          workerId,
          claimedGeneration,
          {
            status: manual ? "MANUAL_REVIEW" : "FAILED_RETRYABLE",
            leaseOwner: null,
            leaseExpiresAt: null,
            ...(nextAttemptAt ? { nextAttemptAt } : {}),
            lastErrorCode: code,
            lastErrorMessage: sanitizeMessage(classification.message),
            manualReviewReasonCode: manual ? code : null,
          }
        );
        return { manual, nextAttemptAt, code };
      });
      return makeResult(
        finalizationId,
        recorded.manual ? "MANUAL_REVIEW" : "RETRY_SCHEDULED",
        completedEffectIds,
        recorded.nextAttemptAt,
        recorded.code
      );
    } catch (recordError: unknown) {
      if (recordError instanceof LeaseLostError) {
        return makeResult(
          finalizationId,
          "LEASE_LOST",
          completedEffectIds
        );
      }
      throw recordError;
    }
  }

  private async recordExecutionFailure(
    finalizationId: string,
    transactionId: string,
    workerId: string,
    claimedGeneration: number,
    now: Date,
    group: EffectGroup,
    completedEffectIds: readonly string[],
    error: unknown
  ): Promise<ExecuteFinalizationResult> {
    const classification = classifyExecutionError(error);
    try {
      return await this.dependencies.runInTransaction(async (tx) => {
        await acquireTransactionRootLock(tx, transactionId);
        const parent = await loadFinalization(tx, finalizationId);
        if (!parent) throw new LeaseLostError();
        requireOwnedLease(parent, workerId, claimedGeneration, now);
        const effects = group.effectIds.map((id) => effectById(parent, id));
        const nextAttemptCount = Math.max(
          ...effects.map((effect) => effect.attemptCount + 1)
        );
        const manual =
          !classification.retryable ||
          nextAttemptCount >= MAX_AUTOMATIC_EFFECT_ATTEMPTS ||
          parent.attemptCount >= MAX_AUTOMATIC_PARENT_ATTEMPTS;
        const code =
          classification.retryable && manual
            ? "MAX_ATTEMPTS_EXCEEDED"
            : classification.code;
        const delay =
          RETRY_DELAYS_MS[
            Math.min(nextAttemptCount - 1, RETRY_DELAYS_MS.length - 1)
          ];
        const nextAttemptAt = manual ? null : addMilliseconds(now, delay);

        for (const effect of effects) {
          const effectCas = await tx.paymentFinalizationEffect.updateMany({
            where: {
              id: effect.id,
              finalizationId,
              status: effect.status,
            },
            data: {
              status: effect.status === "COMPLETE" ? "COMPLETE" : manual ? "MANUAL_REVIEW" : "FAILED_RETRYABLE",
              attemptCount: { increment: 1 },
              lastAttemptAt: now,
              ...(nextAttemptAt ? { nextAttemptAt } : {}),
              lastErrorCode: code,
              lastErrorMessage: sanitizeMessage(classification.message),
              manualReviewReasonCode: manual ? code : null,
            },
          });
          if (effectCas.count !== 1) throw new LifecycleCasError();
        }

        await this.updateOwnedParent(
          tx,
          finalizationId,
          workerId,
          claimedGeneration,
          {
          status: manual ? "MANUAL_REVIEW" : "FAILED_RETRYABLE",
          leaseOwner: null,
          leaseExpiresAt: null,
          ...(nextAttemptAt ? { nextAttemptAt } : {}),
          lastErrorCode: code,
          lastErrorMessage: sanitizeMessage(classification.message),
          manualReviewReasonCode: manual ? code : null,
          }
        );
        return makeResult(
          finalizationId,
          manual ? "MANUAL_REVIEW" : "RETRY_SCHEDULED",
          completedEffectIds,
          nextAttemptAt,
          code
        );
      });
    } catch (recordError: unknown) {
      if (recordError instanceof LeaseLostError) {
        return makeResult(
          finalizationId,
          "LEASE_LOST",
          completedEffectIds
        );
      }
      throw recordError;
    }
  }

  private async parkAwaitingData(
    finalizationId: string,
    transactionId: string,
    workerId: string,
    claimedGeneration: number,
    now: Date,
    completedEffectIds: readonly string[]
  ): Promise<ExecuteFinalizationResult> {
    try {
      await this.dependencies.runInTransaction(async (tx) => {
        await acquireTransactionRootLock(tx, transactionId);
        const parent = await loadFinalization(tx, finalizationId);
        if (!parent) {
          fail("FINALIZATION_NOT_FOUND", "The claimed finalization disappeared.");
        }
        requireOwnedLease(parent, workerId, claimedGeneration, now);
        validateManifest(parent);
        await validateRefundState(tx, parent);
        const awaiting = parent.effects.filter(
          (effect) => effect.status === "AWAITING_DATA"
        );
        if (
          awaiting.length !== 1 ||
          awaiting[0].effectType !== "PROVIDER_FEE_LEDGER" ||
          parent.effects.some(
            (effect) =>
              effect.effectType !== "RECONCILIATION" &&
              effect.status !== "COMPLETE" &&
              effect.status !== "NOT_APPLICABLE" &&
              effect.status !== "AWAITING_DATA"
          )
        ) {
          fail("LIFECYCLE_INVALID", "Awaiting-data parking prerequisites are invalid.");
        }
        await this.updateOwnedParent(
          tx,
          finalizationId,
          workerId,
          claimedGeneration,
          {
          status: "PENDING",
          leaseOwner: null,
          leaseExpiresAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          manualReviewReasonCode: null,
          }
        );
      });
      return makeResult(
        finalizationId,
        "AWAITING_DATA",
        completedEffectIds
      );
    } catch (error: unknown) {
      if (error instanceof LeaseLostError) {
        return makeResult(finalizationId, "LEASE_LOST", completedEffectIds);
      }
      return this.recordPreflightFailure(
        finalizationId,
        transactionId,
        workerId,
        claimedGeneration,
        now,
        completedEffectIds,
        error
      );
    }
  }

  private async releaseUntilRetry(
    finalizationId: string,
    transactionId: string,
    workerId: string,
    claimedGeneration: number,
    now: Date,
    nextAttemptAt: Date,
    completedEffectIds: readonly string[]
  ): Promise<ExecuteFinalizationResult> {
    try {
      await this.dependencies.runInTransaction(async (tx) => {
        await acquireTransactionRootLock(tx, transactionId);
        const parent = await loadFinalization(tx, finalizationId);
        if (!parent) {
          fail("FINALIZATION_NOT_FOUND", "The claimed finalization disappeared.");
        }
        requireOwnedLease(parent, workerId, claimedGeneration, now);
        validateManifest(parent);
        await validateRefundState(tx, parent);
        await this.updateOwnedParent(
          tx,
          finalizationId,
          workerId,
          claimedGeneration,
          {
          status: "FAILED_RETRYABLE",
          nextAttemptAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          }
        );
      });
      return makeResult(
        finalizationId,
        completedEffectIds.length > 0 ? "PROGRESSED" : "RETRY_SCHEDULED",
        completedEffectIds,
        nextAttemptAt
      );
    } catch (error: unknown) {
      if (error instanceof LeaseLostError) {
        return makeResult(finalizationId, "LEASE_LOST", completedEffectIds);
      }
      return this.recordPreflightFailure(
        finalizationId,
        transactionId,
        workerId,
        claimedGeneration,
        now,
        completedEffectIds,
        error
      );
    }
  }

  private async completeRecoveredParent(
    finalizationId: string,
    transactionId: string,
    workerId: string,
    claimedGeneration: number,
    now: Date,
    completedEffectIds: readonly string[]
  ): Promise<ExecuteFinalizationResult> {
    try {
      await this.dependencies.runInTransaction(async (tx) => {
        await acquireTransactionRootLock(tx, transactionId);
        const parent = await loadFinalization(tx, finalizationId);
        if (!parent) {
          fail("FINALIZATION_NOT_FOUND", "The claimed finalization disappeared.");
        }
        requireOwnedLease(parent, workerId, claimedGeneration, now);
        validateManifest(parent);
        await validateRefundState(tx, parent);
        const reconciliation = parent.effects.filter(
          (effect) => effect.effectType === "RECONCILIATION"
        );
        if (
          reconciliation.length !== 1 ||
          reconciliation[0].status !== "COMPLETE" ||
          !parent.effects.every(
            (effect) =>
              effect.status === "COMPLETE" ||
              effect.status === "NOT_APPLICABLE"
          )
        ) {
          fail("LIFECYCLE_INVALID", "Parent completion prerequisites are not satisfied.");
        }
        await this.updateOwnedParent(
          tx,
          finalizationId,
          workerId,
          claimedGeneration,
          {
            status: "COMPLETE",
            completedAt: now,
            leaseOwner: null,
            leaseExpiresAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            manualReviewReasonCode: null,
          }
        );
      });
      return makeResult(finalizationId, "COMPLETE", completedEffectIds);
    } catch (error: unknown) {
      if (error instanceof LeaseLostError) {
        return makeResult(finalizationId, "LEASE_LOST", completedEffectIds);
      }
      return this.recordPreflightFailure(
        finalizationId,
        transactionId,
        workerId,
        claimedGeneration,
        now,
        completedEffectIds,
        error
      );
    }
  }
}

const defaultDependencies: PaymentFinalizationCoordinatorTestDependencies = {
  runInTransaction: <T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> =>
    prisma.$transaction(operation, {
      timeout: TRANSACTION_TIMEOUT_MS,
      maxWait: TRANSACTION_MAX_WAIT_MS,
    }),
  findDueFinalizationIds: async (now, batchSize) => {
    const runnableNonReconciliation: Prisma.PaymentFinalizationWhereInput = {
      effects: {
        some: {
          effectType: { not: "RECONCILIATION" as const },
          OR: [
            { status: "PENDING" as const },
            {
              status: "FAILED_RETRYABLE" as const,
              nextAttemptAt: { lte: now },
            },
          ],
        },
      },
    };
    const runnableReconciliation: Prisma.PaymentFinalizationWhereInput = {
      effects: {
        some: {
          effectType: "RECONCILIATION" as const,
          OR: [
            { status: "PENDING" as const },
            {
              status: "FAILED_RETRYABLE" as const,
              nextAttemptAt: { lte: now },
            },
          ],
        },
        none: {
          effectType: { not: "RECONCILIATION" as const },
          status: { notIn: ["COMPLETE", "NOT_APPLICABLE"] },
        },
      },
    };
    const rows = await prisma.paymentFinalization.findMany({
      where: {
        AND: [
          {
            OR: [
              { status: "PENDING", nextAttemptAt: { lte: now } },
              { status: "FAILED_RETRYABLE", nextAttemptAt: { lte: now } },
              {
                status: "PROCESSING",
                leaseOwner: { not: null },
                leaseExpiresAt: { not: null, lte: now },
              },
            ],
          },
          { OR: [runnableNonReconciliation, runnableReconciliation] },
        ],
      },
      orderBy: [
        { nextAttemptAt: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      select: { id: true },
      take: batchSize,
    });
    return rows.map((row) => row.id);
  },
  postLedger: (params, tx) =>
    IdempotentLedgerService.postBalancedDoubleEntryIdempotent(params, tx),
  executeReferral: (params) =>
    IdempotentReferralRewardService.executeReferralRewardEffect(params),
  executePartnerPair: (params) =>
    IdempotentPartnerCommissionService.executePartnerCommissionAndLiability(
      params
    ),
  executeTax: (params) =>
    IdempotentTaxProvisionService.executeTaxProvisionEffect(params),
  executeReconciliation: (params) =>
    IdempotentReconciliationService.executeReconciliationEffect(params),
};

const defaultEngine = new PaymentFinalizationCoordinatorEngine(
  defaultDependencies
);

/** @internal Synthetic verification only; never imported by application code. */
export function createPaymentFinalizationCoordinatorForTesting(
  dependencies: PaymentFinalizationCoordinatorTestDependencies
): CoordinatorRuntime {
  return new PaymentFinalizationCoordinatorEngine(dependencies);
}

export class PaymentFinalizationCoordinator {
  static executeFinalization(
    input: ExecuteFinalizationInput
  ): Promise<ExecuteFinalizationResult> {
    return defaultEngine.executeFinalization(input);
  }

  static recoverDueFinalizations(
    input: RecoverDueFinalizationsInput
  ): Promise<RecoverDueFinalizationsResult> {
    return defaultEngine.recoverDueFinalizations(input);
  }
}
