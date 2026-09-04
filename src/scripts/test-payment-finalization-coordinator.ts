/**
 * Synthetic verification: dormant payment-finalization coordinator (Slice 8C).
 *
 * In-memory only. No live database, provider, notification, entitlement, or
 * application route is called. Real PostgreSQL behavior remains a later gate.
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  Prisma,
  type FinancialLedgerEntry,
  type PartnerCommission,
  type PaymentFinalization,
  type PaymentFinalizationEffect,
  type ReconciliationRecord,
  type ReferralReward,
  type TaxRecord,
  type Transaction,
} from "@prisma/client";
import {
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
} from "../lib/payment/paymentFinalizationContracts";
import type {
  ExecuteFinalizationResult,
  PaymentFinalizationCoordinatorTestDependencies,
  createPaymentFinalizationCoordinatorForTesting as CreateCoordinator,
} from "../lib/payment/paymentFinalizationCoordinator";
import type {
  PostBalancedDoubleEntryIdempotentParams,
  PostBalancedDoubleEntryResult,
} from "../lib/accounting/idempotent\u004cedgerService";
import type {
  ExecuteReferralRewardEffectParams,
  ExecuteReferralRewardEffectResult,
  ReferralRewardExecutionError as ReferralError,
} from "../lib/referral/idempotent\u0052eferralRewardService";
import type {
  ExecutePartnerCommissionAndLiabilityParams,
  ExecutePartnerCommissionAndLiabilityResult,
  PartnerCommissionExecutionError as PartnerError,
} from "../lib/accounting/idempotent\u0050artnerCommissionService";
import type {
  ExecuteTaxProvisionEffectParams,
  ExecuteTaxProvisionEffectResult,
  TaxProvisionExecutionError as TaxError,
} from "../lib/accounting/idempotentTaxProvisionService";
import type {
  ExecuteReconciliationEffectParams,
  ExecuteReconciliationEffectResult,
  ReconciliationExecutionError as ReconciliationError,
} from "../lib/accounting/idempotentReconciliationService";

type CoordinatorFactory = typeof CreateCoordinator;
type Runtime = ReturnType<CoordinatorFactory>;
type LoadedParent = PaymentFinalization & {
  transaction: Transaction;
  effects: PaymentFinalizationEffect[];
};
type MutableEffect = PaymentFinalizationEffect;
type InvocationKind =
  | "PAYMENT"
  | "FEE"
  | "REFERRAL"
  | "PARTNER_PAIR"
  | "TAX"
  | "RECONCILIATION";

interface Invocation {
  readonly kind: InvocationKind;
  readonly effectIds: readonly string[];
  readonly tx: Prisma.TransactionClient;
  readonly ledgerParams?: PostBalancedDoubleEntryIdempotentParams;
}

interface MockUpdateArgs {
  readonly where: Readonly<Record<string, unknown>>;
  readonly data: Readonly<Record<string, unknown>>;
}

interface MockStateOptions {
  readonly parentStatus?: PaymentFinalization["status"];
  readonly attemptCount?: number;
  readonly leaseOwner?: string | null;
  readonly leaseExpiresAt?: Date | null;
  readonly nextAttemptAt?: Date;
  readonly feeMode?: "KNOWN" | "ZERO" | "AWAITING";
  readonly effectStatuses?: Readonly<Record<string, PaymentFinalizationEffect["status"]>>;
  readonly effectAttempts?: Readonly<Record<string, number>>;
  readonly taxIds?: readonly string[];
  readonly transactionStatus?: string;
}

let createCoordinator: CoordinatorFactory;
let ReferralErrorClass: typeof ReferralError;
let _PartnerErrorClass: typeof PartnerError;
let TaxErrorClass: typeof TaxError;
let ReconciliationErrorClass: typeof ReconciliationError;

let totalGroups = 0;
let passedGroups = 0;
let failedGroups = 0;
let totalChecks = 0;

function check(condition: boolean, description: string): void {
  totalChecks++;
  if (!condition) throw new Error(description);
}

async function group(
  name: string,
  operation: () => Promise<void> | void
): Promise<void> {
  totalGroups++;
  try {
    await operation();
    passedGroups++;
    console.log("PASS GROUP " + totalGroups + ": " + name);
  } catch (error: unknown) {
    failedGroups++;
    const message = error instanceof Error ? error.message : String(error);
    console.error("FAIL GROUP " + totalGroups + ": " + name + " — " + message);
  }
}

function fixed(value: string): Date {
  return new Date(value);
}

const NOW = fixed("2026-09-03T10:00:00.000Z");
const IDS = {
  transaction: "txn_slice8c_001",
  finalization: "pfin_slice8c_001",
  checkout: "checkout_slice8c_001",
  user: "user_slice8c_001",
  referral: "referral_slice8c_001",
  partner: "partner_slice8c_001",
  tax: "tax_slice8c_001",
} as const;

const EFFECT_KEYS = {
  PAYMENT_LEDGER: "payment",
  PROVIDER_FEE_LEDGER: "fee",
  REFERRAL_REWARD: "referral",
  PARTNER_COMMISSION: "partner-commission",
  PARTNER_LIABILITY_LEDGER: "partner-liability",
  RECONCILIATION: "reconciliation",
} as const;

function effectId(type: PaymentFinalizationEffect["effectType"], key: string): string {
  return "effect_" + type.toLowerCase() + "_" + key.replace(/[^a-z0-9]/gi, "_");
}

function operationKey(
  type: PaymentFinalizationEffect["effectType"],
  taxConfigId: string | null = null
): string {
  switch (type) {
    case "PAYMENT_LEDGER":
      return buildPaymentFinalizationOperationKey(IDS.transaction, { kind: "PAYMENT" });
    case "PROVIDER_FEE_LEDGER":
      return buildPaymentFinalizationOperationKey(IDS.transaction, { kind: "FEE" });
    case "REFERRAL_REWARD":
      return buildPaymentFinalizationOperationKey(IDS.transaction, { kind: "REFERRAL" });
    case "PARTNER_COMMISSION":
      return buildPaymentFinalizationOperationKey(IDS.transaction, {
        kind: "PARTNER_COMMISSION",
      });
    case "PARTNER_LIABILITY_LEDGER":
      return buildPaymentFinalizationOperationKey(IDS.transaction, {
        kind: "PARTNER_LIABILITY",
      });
    case "TAX_PROVISION":
      return taxConfigId === null
        ? buildPaymentFinalizationOperationKey(IDS.transaction, { kind: "TAX_NONE" })
        : buildPaymentFinalizationOperationKey(IDS.transaction, {
            kind: "TAX",
            taxConfigId,
          });
    case "RECONCILIATION":
      return buildPaymentFinalizationOperationKey(IDS.transaction, {
        kind: "RECONCILIATION",
      });
  }
}

function makeTransaction(status: string): Transaction {
  return {
    id: IDS.transaction,
    userId: IDS.user,
    checkoutSessionId: IDS.checkout,
    paymentIntentId: "pay_slice8c_001",
    amount: 299,
    grossAmountCentavos: 29_900,
    discountAmountCentavos: 0,
    feeAmountCentavos: 900,
    netSettlementCentavos: 29_000,
    planType: "1_MONTH",
    status,
    receiptUrl: null,
    createdAt: fixed("2026-09-03T09:00:00.000Z"),
    updatedAt: NOW,
  };
}

function makeEffect(
  type: PaymentFinalizationEffect["effectType"],
  key: string,
  intent: Prisma.JsonObject,
  status: PaymentFinalizationEffect["status"],
  links: {
    readonly referralId?: string | null;
    readonly partnerId?: string | null;
    readonly taxConfigId?: string | null;
  } = {},
  attemptCount = 0
): MutableEffect {
  return {
    id: effectId(type, key),
    finalizationId: IDS.finalization,
    effectType: type,
    effectKey: key,
    operationKey: operationKey(type, links.taxConfigId ?? null),
    status,
    intentVersion: 1,
    intent,
    intentHash: computeSha256Hash(canonicalizeJson(intent)),
    referralId: links.referralId ?? null,
    partnerId: links.partnerId ?? null,
    taxConfigId: links.taxConfigId ?? null,
    attemptCount,
    lastAttemptAt: null,
    nextAttemptAt: NOW,
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    completedAt: status === "COMPLETE" ? NOW : null,
    createdAt: fixed("2026-09-03T09:30:00.000Z"),
    updatedAt: NOW,
  };
}

function buildEffects(options: MockStateOptions): MutableEffect[] {
  const feeMode = options.feeMode ?? "KNOWN";
  const paymentIntent: Prisma.JsonObject = {
    effectType: "PAYMENT_LEDGER",
    intentVersion: 1,
    status: "PENDING",
    amountCentavos: 29_900,
    userId: IDS.user,
    planType: "1_MONTH",
    debitCategory: "CASH_PAYMONGO",
    creditCategory: "REVENUE_PREMIUM",
  };
  const feeIntent: Prisma.JsonObject =
    feeMode === "KNOWN"
      ? {
          effectType: "PROVIDER_FEE_LEDGER",
          intentVersion: 1,
          feeKnowledge: "KNOWN",
          feeAmountCentavos: 900,
          status: "PENDING",
          debitCategory: "EXPENSE_PAYMENT_FEE",
          creditCategory: "CASH_PAYMONGO",
        }
      : feeMode === "ZERO"
        ? {
            effectType: "PROVIDER_FEE_LEDGER",
            intentVersion: 1,
            feeKnowledge: "KNOWN",
            feeAmountCentavos: 0,
            status: "NOT_APPLICABLE",
            notApplicableReason: "ZERO_PROVIDER_FEE",
            debitCategory: null,
            creditCategory: null,
          }
        : {
            effectType: "PROVIDER_FEE_LEDGER",
            intentVersion: 1,
            feeKnowledge: "UNKNOWN",
            feeAmountCentavos: null,
            status: "AWAITING_DATA",
            debitCategory: null,
            creditCategory: null,
          };
  const referralIntent: Prisma.JsonObject = {
    effectType: "REFERRAL_REWARD",
    intentVersion: 1,
    status: "PENDING",
    referralId: IDS.referral,
    inviterId: "inviter_slice8c_001",
    referredUserId: IDS.user,
    purchaseAmountCentavos: 29_900,
    rewardType: "PERCENTAGE",
    rewardRateBasisPoints: 1_000,
    rewardAmountCentavos: 2_990,
    currency: "PHP",
    holdingPeriodDays: 7,
    holdingUntil: "2026-09-10T10:00:00.000Z",
  };
  const commissionIntent: Prisma.JsonObject = {
    effectType: "PARTNER_COMMISSION",
    intentVersion: 1,
    status: "PENDING",
    partnerId: IDS.partner,
    partnerCode: "partner-code",
    commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
    commissionRateBasisPoints: 1_500,
    calculationBasis: "CUSTOMER_PAYMENT",
    baseAmountCentavos: 29_900,
    commissionAmountCentavos: 4_485,
    currency: "PHP",
    campaignSource: "synthetic",
    holdingPeriodDays: 7,
    holdingUntil: "2026-09-10T10:00:00.000Z",
  };
  const liabilityIntent: Prisma.JsonObject = {
    effectType: "PARTNER_LIABILITY_LEDGER",
    intentVersion: 1,
    status: "PENDING",
    partnerId: IDS.partner,
    amountCentavos: 4_485,
    debitCategory: "EXPENSE_PARTNER",
    creditCategory: "LIABILITY_PARTNER_PAYABLE",
  };
  const reconciliationIntent: Prisma.JsonObject = {
    effectType: "RECONCILIATION",
    intentVersion: 1,
    status: "PENDING",
    expectedPaymentCentavos: 29_900,
    expectedFeeCentavos: feeMode === "AWAITING" ? null : feeMode === "ZERO" ? 0 : 900,
    feeKnowledge: feeMode === "AWAITING" ? "UNKNOWN" : "KNOWN",
    sourceType: "INTERNAL_TRANSACTION",
  };

  const statusFor = (
    key: string,
    original: PaymentFinalizationEffect["status"]
  ): PaymentFinalizationEffect["status"] => options.effectStatuses?.[key] ?? original;
  const attemptsFor = (key: string): number => options.effectAttempts?.[key] ?? 0;

  const effects: MutableEffect[] = [
    makeEffect(
      "PAYMENT_LEDGER",
      EFFECT_KEYS.PAYMENT_LEDGER,
      paymentIntent,
      statusFor("payment", "PENDING"),
      {},
      attemptsFor("payment")
    ),
    makeEffect(
      "PROVIDER_FEE_LEDGER",
      EFFECT_KEYS.PROVIDER_FEE_LEDGER,
      feeIntent,
      statusFor(
        "fee",
        feeMode === "AWAITING"
          ? "AWAITING_DATA"
          : feeMode === "ZERO"
            ? "NOT_APPLICABLE"
            : "PENDING"
      ),
      {},
      attemptsFor("fee")
    ),
    makeEffect(
      "REFERRAL_REWARD",
      EFFECT_KEYS.REFERRAL_REWARD,
      referralIntent,
      statusFor("referral", "PENDING"),
      { referralId: IDS.referral },
      attemptsFor("referral")
    ),
    makeEffect(
      "PARTNER_COMMISSION",
      EFFECT_KEYS.PARTNER_COMMISSION,
      commissionIntent,
      statusFor("commission", "PENDING"),
      { partnerId: IDS.partner },
      attemptsFor("commission")
    ),
    makeEffect(
      "PARTNER_LIABILITY_LEDGER",
      EFFECT_KEYS.PARTNER_LIABILITY_LEDGER,
      liabilityIntent,
      statusFor("liability", "PENDING"),
      { partnerId: IDS.partner },
      attemptsFor("liability")
    ),
  ];

  for (const taxConfigId of options.taxIds ?? [IDS.tax]) {
    const taxIntent: Prisma.JsonObject = {
      effectType: "TAX_PROVISION",
      intentVersion: 1,
      status: "PENDING",
      taxConfigId,
      taxName: "Synthetic Tax " + taxConfigId,
      taxType: "VAT",
      calculationBasis: "CUSTOMER_PAYMENT",
      taxableAmountCentavos: 29_900,
      taxRateBasisPoints: 1_200,
      taxAmountCentavos: 3_588,
      debitCategory: "EXPENSE_TAX",
      creditCategory: "LIABILITY_TAX_PAYABLE",
    };
    effects.push(
      makeEffect(
        "TAX_PROVISION",
        "tax:" + taxConfigId,
        taxIntent,
        statusFor("tax:" + taxConfigId, "PENDING"),
        { taxConfigId },
        attemptsFor("tax:" + taxConfigId)
      )
    );
  }

  effects.push(
    makeEffect(
      "RECONCILIATION",
      EFFECT_KEYS.RECONCILIATION,
      reconciliationIntent,
      statusFor("reconciliation", "PENDING"),
      {},
      attemptsFor("reconciliation")
    )
  );
  return effects;
}

function compareManifestEffects(
  left: PaymentFinalizationEffect,
  right: PaymentFinalizationEffect
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
  const typeOrder = rank[left.effectType] - rank[right.effectType];
  if (typeOrder !== 0) return typeOrder;
  const keyOrder = left.effectKey.localeCompare(right.effectKey);
  return keyOrder !== 0 ? keyOrder : left.id.localeCompare(right.id);
}

function rootHash(parent: LoadedParent): string {
  const effects = [...parent.effects].sort(compareManifestEffects);
  return computeSha256Hash(
    canonicalizeJson({
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
      effects: effects.map((effect) => ({
        effectType: effect.effectType,
        effectKey: effect.effectKey,
        operationKey: effect.operationKey,
        status: (effect.intent as Prisma.JsonObject).status,
        intentVersion: effect.intentVersion,
        intentHash: effect.intentHash,
      })),
    })
  );
}

function refreshHashes(parent: LoadedParent): void {
  for (const effect of parent.effects) {
    effect.intentHash = computeSha256Hash(canonicalizeJson(effect.intent));
  }
  parent.manifestHash = rootHash(parent);
}

function makeParent(options: MockStateOptions = {}): LoadedParent {
  const feeMode = options.feeMode ?? "KNOWN";
  const effects = buildEffects(options);
  const parent: LoadedParent = {
    id: IDS.finalization,
    transactionId: IDS.transaction,
    checkoutSessionId: IDS.checkout,
    providerPaymentId: "pay_slice8c_001",
    providerPaidAt: NOW,
    source: "WEBHOOK",
    origin: "NEW_PAYMENT",
    status: options.parentStatus ?? "PENDING",
    manifestVersion: 1,
    manifestRevision: 1,
    manifestHash: "0".repeat(64),
    planType: "1_MONTH",
    currency: "PHP",
    purchaseAmountCentavos: 29_900,
    feeKnowledge: feeMode === "AWAITING" ? "UNKNOWN" : "KNOWN",
    feeAmountCentavos: feeMode === "AWAITING" ? null : feeMode === "ZERO" ? 0 : 900,
    feeObservedAt: feeMode === "AWAITING" ? null : NOW,
    entitlementBefore: null,
    entitlementAfter: fixed("2026-10-03T10:00:00.000Z"),
    verifiedAt: NOW,
    attemptCount: options.attemptCount ?? 0,
    lastAttemptAt: null,
    nextAttemptAt: options.nextAttemptAt ?? NOW,
    leaseOwner: options.leaseOwner ?? null,
    leaseExpiresAt: options.leaseExpiresAt ?? null,
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    completedAt:
      options.parentStatus === "COMPLETE" ? NOW : null,
    createdAt: fixed("2026-09-03T09:20:00.000Z"),
    updatedAt: NOW,
    transaction: makeTransaction(options.transactionStatus ?? "PAID"),
    effects,
  };
  refreshHashes(parent);
  return parent;
}

function cloneParent(parent: LoadedParent): LoadedParent {
  return structuredClone(parent);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  return left === right;
}

function matchesWhere(
  target: Readonly<Record<string, unknown>>,
  where: Readonly<Record<string, unknown>>
): boolean {
  for (const [key, expected] of Object.entries(where)) {
    const actual = target[key];
    if (isPlainObject(expected) && "lte" in expected) {
      const boundary = expected.lte;
      if (!(actual instanceof Date) || !(boundary instanceof Date)) return false;
      if (actual.getTime() > boundary.getTime()) return false;
    } else if (!sameValue(actual, expected)) {
      return false;
    }
  }
  return true;
}

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function applyData(
  target: Record<string, unknown>,
  data: Readonly<Record<string, unknown>>
): void {
  for (const [key, value] of Object.entries(data)) {
    if (isPlainObject(value) && typeof value.increment === "number") {
      const current = target[key];
      if (typeof current !== "number") throw new Error("Increment target is not numeric.");
      target[key] = current + value.increment;
    } else {
      target[key] = value;
    }
  }
}

function fakeLedgerResult(): PostBalancedDoubleEntryResult {
  return {
    debitEntry: {} as FinancialLedgerEntry,
    creditEntry: {} as FinancialLedgerEntry,
    isReplay: false,
  };
}

function fakeReferralResult(
  replay = false
): ExecuteReferralRewardEffectResult {
  return replay
    ? { outcome: "REPLAY", reward: {} as ReferralReward, isReplay: true }
    : { outcome: "CREATED", reward: {} as ReferralReward, isReplay: false };
}

function fakePartnerResult(
  replay = false
): ExecutePartnerCommissionAndLiabilityResult {
  return replay
    ? {
        outcome: "REPLAY",
        commission: {} as PartnerCommission,
        debitEntry: {} as FinancialLedgerEntry,
        creditEntry: {} as FinancialLedgerEntry,
        isReplay: true,
      }
    : {
        outcome: "CREATED",
        commission: {} as PartnerCommission,
        debitEntry: {} as FinancialLedgerEntry,
        creditEntry: {} as FinancialLedgerEntry,
        isReplay: false,
      };
}

function fakeTaxResult(replay = false): ExecuteTaxProvisionEffectResult {
  return replay
    ? {
        outcome: "REPLAY",
        taxRecord: {} as TaxRecord,
        debitEntry: {} as FinancialLedgerEntry,
        creditEntry: {} as FinancialLedgerEntry,
        isReplay: true,
      }
    : {
        outcome: "CREATED",
        taxRecord: {} as TaxRecord,
        debitEntry: {} as FinancialLedgerEntry,
        creditEntry: {} as FinancialLedgerEntry,
        isReplay: false,
      };
}

function fakeReconciliationResult(
  outcome: "MATCHED" | "DISCREPANCY" | "MANUALLY_RESOLVED"
): ExecuteReconciliationEffectResult {
  if (outcome === "DISCREPANCY") {
    return {
      outcome,
      record: {} as ReconciliationRecord,
      status: "MISMATCHED",
      isReplay: false,
    };
  }
  if (outcome === "MANUALLY_RESOLVED") {
    return {
      outcome,
      record: {} as ReconciliationRecord,
      isReplay: true,
    };
  }
  return {
    outcome,
    record: {} as ReconciliationRecord,
    isReplay: false,
  };
}

class MockCoordinatorStore {
  public parent: LoadedParent;
  public readonly invocations: Invocation[] = [];
  public readonly transactionOperations: string[][] = [];
  public readonly lifecycleTransactions: Prisma.TransactionClient[] = [];
  public domainWrites: string[] = [];
  public reversalCount = 0;
  public forceClaimCasFailure = false;
  public forceOwnedParentCasFailure = false;
  public externalOwnerAfterRollback: string | null = null;
  public externalGenerationAfterRollback: number | null = null;
  public takeoverAfterNextInvocation: {
    readonly workerId: string;
    readonly claimedGeneration: number;
  } | null = null;
  public takeoverObservedGeneration: number | null = null;
  public reconciliationOutcome:
    | "MATCHED"
    | "DISCREPANCY"
    | "MANUALLY_RESOLVED" = "MATCHED";
  public dueOverride: readonly string[] | null = null;
  private readonly failures = new Map<InvocationKind, Error[]>();
  private readonly rootLockFailures: Error[] = [];
  private writeBeforeFailure = new Set<InvocationKind>();

  constructor(options: MockStateOptions = {}) {
    this.parent = makeParent(options);
  }

  effect(key: string): MutableEffect {
    const found = this.parent.effects.find((effect) => effect.effectKey === key);
    if (!found) throw new Error("Missing synthetic effect: " + key);
    return found;
  }

  failNext(kind: InvocationKind, error: Error, writeBeforeFailure = false): void {
    const queue = this.failures.get(kind) ?? [];
    queue.push(error);
    this.failures.set(kind, queue);
    if (writeBeforeFailure) this.writeBeforeFailure.add(kind);
  }

  failNextRootLock(error: Error): void {
    this.rootLockFailures.push(error);
  }

  private nextFailure(kind: InvocationKind): Error | null {
    const queue = this.failures.get(kind);
    if (!queue || queue.length === 0) return null;
    const error = queue.shift() ?? null;
    if (queue.length === 0) this.failures.delete(kind);
    return error;
  }

  private invoke(
    kind: InvocationKind,
    effectIds: readonly string[],
    tx: Prisma.TransactionClient,
    ledgerParams?: PostBalancedDoubleEntryIdempotentParams
  ): void {
    this.invocations.push({ kind, effectIds, tx, ledgerParams });
    const failure = this.nextFailure(kind);
    if (failure) {
      if (this.writeBeforeFailure.has(kind)) {
        this.domainWrites.push(kind + ":PARTIAL");
        this.writeBeforeFailure.delete(kind);
      }
      throw failure;
    }
    this.domainWrites.push(kind + ":COMMITTED");
    if (this.takeoverAfterNextInvocation) {
      const takeover = this.takeoverAfterNextInvocation;
      this.takeoverObservedGeneration = this.parent.attemptCount;
      this.parent.status = "PROCESSING";
      this.parent.leaseOwner = takeover.workerId;
      this.parent.leaseExpiresAt = fixed("2026-09-03T10:05:00.000Z");
      this.parent.attemptCount = takeover.claimedGeneration;
      this.externalOwnerAfterRollback = takeover.workerId;
      this.externalGenerationAfterRollback = takeover.claimedGeneration;
      this.takeoverAfterNextInvocation = null;
    }
  }

  private loaded(): LoadedParent {
    return cloneParent(this.parent);
  }

  private makeTransactionClient(operations: string[]): Prisma.TransactionClient {
    const txShape = {
      $queryRaw: async (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ): Promise<unknown> => {
        let query = strings[0];
        for (let index = 0; index < values.length; index++) {
          query += String(values[index]) + strings[index + 1];
        }
        operations.push("root:" + query.replace(/\s+/g, " ").trim());
        const rootLockFailure = this.rootLockFailures.shift();
        if (rootLockFailure) throw rootLockFailure;
        return [{ lock_result: null }];
      },
      paymentFinalization: {
        findUnique: async (): Promise<LoadedParent> => {
          operations.push("parent:find");
          return this.loaded();
        },
        updateMany: async (args: MockUpdateArgs): Promise<{ count: number }> => {
          operations.push("parent:update");
          if (
            this.forceClaimCasFailure &&
            args.data.status === "PROCESSING"
          ) {
            this.forceClaimCasFailure = false;
            return { count: 0 };
          }
          if (
            this.forceOwnedParentCasFailure &&
            args.where.status === "PROCESSING" &&
            typeof args.where.leaseOwner === "string"
          ) {
            this.forceOwnedParentCasFailure = false;
            return { count: 0 };
          }
          const target = this.parent as unknown as Record<string, unknown>;
          if (!matchesWhere(target, args.where)) return { count: 0 };
          applyData(target, args.data);
          return { count: 1 };
        },
      },
      paymentFinalizationEffect: {
        updateMany: async (args: MockUpdateArgs): Promise<{ count: number }> => {
          operations.push("effect:update");
          this.lifecycleTransactions.push(txClient);
          const effect = this.parent.effects.find(
            (candidate) => candidate.id === args.where.id
          );
          if (!effect) return { count: 0 };
          const target = effect as unknown as Record<string, unknown>;
          if (!matchesWhere(target, args.where)) return { count: 0 };
          applyData(target, args.data);
          return { count: 1 };
        },
      },
      financialLedgerEntry: {
        count: async (): Promise<number> => {
          operations.push("refund:count");
          return this.reversalCount;
        },
      },
    };
    const txClient = txShape as unknown as Prisma.TransactionClient;
    return txClient;
  }

  public readonly dependencies: PaymentFinalizationCoordinatorTestDependencies = {
    runInTransaction: async <T>(
      operation: (tx: Prisma.TransactionClient) => Promise<T>
    ): Promise<T> => {
      const parentSnapshot = cloneParent(this.parent);
      const writesSnapshot = [...this.domainWrites];
      const operations: string[] = [];
      this.transactionOperations.push(operations);
      const tx = this.makeTransactionClient(operations);
      try {
        return await operation(tx);
      } catch (error: unknown) {
        this.parent = parentSnapshot;
        this.domainWrites = writesSnapshot;
        if (this.externalOwnerAfterRollback !== null) {
          this.parent.status = "PROCESSING";
          this.parent.leaseOwner = this.externalOwnerAfterRollback;
          this.parent.leaseExpiresAt = fixed("2026-09-03T10:05:00.000Z");
          if (this.externalGenerationAfterRollback !== null) {
            this.parent.attemptCount = this.externalGenerationAfterRollback;
          }
          this.externalOwnerAfterRollback = null;
          this.externalGenerationAfterRollback = null;
        }
        throw error;
      }
    },
    findDueFinalizationIds: async (
      now: Date,
      batchSize: number
    ): Promise<readonly string[]> => {
      if (this.dueOverride !== null) {
        return this.dueOverride.slice(0, batchSize);
      }
      const parent = this.parent;
      const parentDue =
        (parent.status === "PENDING" &&
          parent.nextAttemptAt.getTime() <= now.getTime()) ||
        (parent.status === "FAILED_RETRYABLE" &&
          parent.nextAttemptAt.getTime() <= now.getTime()) ||
        (parent.status === "PROCESSING" &&
          parent.leaseOwner !== null &&
          parent.leaseExpiresAt !== null &&
          parent.leaseExpiresAt.getTime() <= now.getTime());
      if (!parentDue) return [];
      const runnableNonReconciliation = parent.effects.some(
        (effect) =>
          effect.effectType !== "RECONCILIATION" &&
          (effect.status === "PENDING" ||
            (effect.status === "FAILED_RETRYABLE" &&
              effect.nextAttemptAt.getTime() <= now.getTime()))
      );
      const reconciliation = parent.effects.find(
        (effect) => effect.effectType === "RECONCILIATION"
      );
      const runnableReconciliation =
        reconciliation !== undefined &&
        (reconciliation.status === "PENDING" ||
          (reconciliation.status === "FAILED_RETRYABLE" &&
            reconciliation.nextAttemptAt.getTime() <= now.getTime())) &&
        parent.effects
          .filter((effect) => effect.effectType !== "RECONCILIATION")
          .every(
            (effect) =>
              effect.status === "COMPLETE" ||
              effect.status === "NOT_APPLICABLE"
          );
      return runnableNonReconciliation || runnableReconciliation
        ? [parent.id]
        : [];
    },
    postLedger: async (
      params: PostBalancedDoubleEntryIdempotentParams,
      tx: Prisma.TransactionClient
    ): Promise<PostBalancedDoubleEntryResult> => {
      const kind = params.operation.kind === "PAYMENT" ? "PAYMENT" : "FEE";
      this.invoke(kind, [params.finalizationEffectId], tx, params);
      return fakeLedgerResult();
    },
    executeReferral: async (
      params: ExecuteReferralRewardEffectParams
    ): Promise<ExecuteReferralRewardEffectResult> => {
      if (!params.tx) throw new Error("Coordinator omitted referral transaction.");
      this.invoke("REFERRAL", [params.finalizationEffectId], params.tx);
      return fakeReferralResult();
    },
    executePartnerPair: async (
      params: ExecutePartnerCommissionAndLiabilityParams
    ): Promise<ExecutePartnerCommissionAndLiabilityResult> => {
      if (!params.tx) throw new Error("Coordinator omitted partner transaction.");
      this.invoke(
        "PARTNER_PAIR",
        [params.commissionEffectId, params.liabilityEffectId],
        params.tx
      );
      return fakePartnerResult();
    },
    executeTax: async (
      params: ExecuteTaxProvisionEffectParams
    ): Promise<ExecuteTaxProvisionEffectResult> => {
      if (!params.tx) throw new Error("Coordinator omitted tax transaction.");
      this.invoke("TAX", [params.taxEffectId], params.tx);
      return fakeTaxResult();
    },
    executeReconciliation: async (
      params: ExecuteReconciliationEffectParams
    ): Promise<ExecuteReconciliationEffectResult> => {
      if (!params.tx) throw new Error("Coordinator omitted reconciliation transaction.");
      this.invoke("RECONCILIATION", [params.reconciliationEffectId], params.tx);
      return fakeReconciliationResult(this.reconciliationOutcome);
    },
  };
}

function coordinator(store: MockCoordinatorStore): Runtime {
  return createCoordinator(store.dependencies);
}

async function execute(store: MockCoordinatorStore): Promise<ExecuteFinalizationResult> {
  return coordinator(store).executeFinalization({
    finalizationId: IDS.finalization,
    workerId: "worker-a",
    now: NOW,
  });
}

function terminalExcept(
  store: MockCoordinatorStore,
  runnableKeys: readonly string[]
): void {
  for (const effect of store.parent.effects) {
    if (!runnableKeys.includes(effect.effectKey)) {
      effect.status = "COMPLETE";
      effect.completedAt = NOW;
    }
  }
}

async function _executeAt(
  store: MockCoordinatorStore,
  now: Date,
  workerId = "worker-a"
): Promise<ExecuteFinalizationResult> {
  return coordinator(store).executeFinalization({
    finalizationId: IDS.finalization,
    workerId,
    now,
  });
}

function markAllEffectsComplete(store: MockCoordinatorStore): void {
  for (const effect of store.parent.effects) {
    effect.status = "COMPLETE";
    effect.completedAt = NOW;
  }
}

async function runSuite(): Promise<void> {
  process.env.DATABASE_URL ??=
    "postgresql://synthetic:synthetic@localhost:5432/synthetic";

  const coordinatorModule = await import(
    "../lib/payment/paymentFinalizationCoordinator"
  );
  const referralModule = await import(
    "../lib/referral/idempotent\u0052eferralRewardService"
  );
  const partnerModule = await import(
    "../lib/accounting/idempotent\u0050artnerCommissionService"
  );
  const taxModule = await import(
    "../lib/accounting/idempotentTaxProvisionService"
  );
  const reconciliationModule = await import(
    "../lib/accounting/idempotentReconciliationService"
  );
  createCoordinator =
    coordinatorModule.createPaymentFinalizationCoordinatorForTesting;
  ReferralErrorClass = referralModule.ReferralRewardExecutionError;
  _PartnerErrorClass = partnerModule.PartnerCommissionExecutionError;
  TaxErrorClass = taxModule.TaxProvisionExecutionError;
  ReconciliationErrorClass =
    reconciliationModule.ReconciliationExecutionError;

  console.log("============================================================");
  console.log("SYNTHETIC SLICE 8C PAYMENT FINALIZATION COORDINATOR SUITE");
  console.log("============================================================");

  await group("fresh claim executes the deterministic DAG and completes", async () => {
    const store = new MockCoordinatorStore();
    const result = await execute(store);
    const kinds = store.invocations.map((invocation) => invocation.kind);
    check(result.outcome === "COMPLETE", "Fresh finalization must complete.");
    check(
      kinds.join(",") ===
        "PAYMENT,FEE,REFERRAL,PARTNER_PAIR,TAX,RECONCILIATION",
      "Effects must execute in the approved deterministic order."
    );
    check(store.parent.attemptCount === 1, "Parent claim must increment once.");
    check(
      store.parent.effects.every((effect) => effect.attemptCount === 1),
      "Every invoked effect must increment once."
    );
    check(store.parent.status === "COMPLETE", "Parent must be COMPLETE.");
    check(store.parent.completedAt?.getTime() === NOW.getTime(), "Completion time must use explicit now.");
    check(store.parent.leaseOwner === null, "Completion must clear lease owner.");
    check(store.parent.leaseExpiresAt === null, "Completion must clear lease expiry.");
    check(
      result.completedEffectIds.length === store.parent.effects.length,
      "Result must report every completed effect."
    );
  });

  await group("claim CAS, lease, and caller-owned transaction invariants hold", async () => {
    const store = new MockCoordinatorStore();
    const result = await execute(store);
    check(result.outcome === "COMPLETE", "Baseline execution must complete.");
    check(
      store.transactionOperations
        .filter((operations) => operations.some((item) => item.startsWith("root:")))
        .every((operations) => operations[0]?.startsWith("root:")),
      "Root advisory lock must be the first operation in every financial transaction."
    );
    check(
      store.transactionOperations
        .flat()
        .some(
          (item) =>
            item.includes("pg_advisory_xact_lock") &&
            item.includes("hashtextextended") &&
            item.includes(IDS.transaction)
        ),
      "Tagged root lock must use the raw transaction identity."
    );
    check(
      store.invocations.every((invocation) =>
        store.lifecycleTransactions.includes(invocation.tx)
      ),
      "The executor and lifecycle update must receive the same transaction object."
    );
    check(
      store.transactionOperations.length === 13,
      "Six effects must use six caller transactions without nested executor transactions."
    );
    check(
      store.invocations.filter((item) => item.kind === "PARTNER_PAIR").length === 1,
      "Partner commission and liability must use one executor invocation."
    );
  });

  await group("direct payment and provider-fee ledger mappings are immutable", async () => {
    const store = new MockCoordinatorStore();
    await execute(store);
    const payment = store.invocations.find((item) => item.kind === "PAYMENT")?.ledgerParams;
    const fee = store.invocations.find((item) => item.kind === "FEE")?.ledgerParams;
    check(payment?.transactionType === "PAYMENT_RECEIVED", "Payment operation must be PAYMENT_RECEIVED.");
    check(payment?.debitCategory === "CASH_PAYMONGO", "Payment debit must be CASH_PAYMONGO.");
    check(payment?.creditCategory === "REVENUE_PREMIUM", "Payment credit must be revenue.");
    check(payment?.amountCentavos === 29_900, "Payment amount must come from immutable intent.");
    check(payment?.sourceEntity === "PaymentFinalization", "Payment source entity must be finalization.");
    check(payment?.sourceId === IDS.finalization, "Payment source ID must be parent ID.");
    check(payment?.effectiveDate.getTime() === NOW.getTime(), "Payment date must be verifiedAt.");
    check(payment?.currency === "PHP", "Payment currency must be PHP.");
    check(fee?.transactionType === "PAYMONGO_FEE", "Fee operation must be PAYMONGO_FEE.");
    check(fee?.debitCategory === "EXPENSE_PAYMENT_FEE", "Fee debit must be fee expense.");
    check(fee?.creditCategory === "CASH_PAYMONGO", "Fee credit must be gateway cash.");
    check(fee?.amountCentavos === 900, "Fee amount must come from immutable intent.");
    check(fee?.sourceId === IDS.finalization, "Fee source ID must be parent ID.");
  });

  await group("competing claim CAS and active lease are excluded", async () => {
    const competing = new MockCoordinatorStore();
    competing.forceClaimCasFailure = true;
    const competingResult = await execute(competing);
    check(competingResult.outcome === "LEASE_NOT_ACQUIRED", "Lost claim CAS must not execute.");
    check(competing.invocations.length === 0, "Lost claim must have zero financial calls.");
    check(competing.parent.attemptCount === 0, "Lost claim must not increment parent.");

    const active = new MockCoordinatorStore({
      parentStatus: "PROCESSING",
      attemptCount: 2,
      leaseOwner: "worker-b",
      leaseExpiresAt: fixed("2026-09-03T10:01:00.000Z"),
    });
    const activeResult = await execute(active);
    check(activeResult.outcome === "LEASE_NOT_ACQUIRED", "Active lease must be excluded.");
    check(active.parent.attemptCount === 2, "Active lease exclusion must not increment.");
  });

  await group("expired valid lease takeover increments parent once", async () => {
    const store = new MockCoordinatorStore({
      parentStatus: "PROCESSING",
      attemptCount: 2,
      leaseOwner: "worker-old",
      leaseExpiresAt: fixed("2026-09-03T09:59:59.000Z"),
    });
    markAllEffectsComplete(store);
    const result = await execute(store);
    check(result.outcome === "COMPLETE", "Expired lease must be taken over.");
    check(store.parent.attemptCount === 3, "Takeover must increment parent exactly once.");
    check(store.parent.leaseOwner === null, "Recovered completion must clear lease.");
  });

  await group("same worker ID takeover rejects the stale claim generation", async () => {
    const store = new MockCoordinatorStore();
    store.takeoverAfterNextInvocation = {
      workerId: "worker-a",
      claimedGeneration: 2,
    };
    const result = await execute(store);
    check(result.outcome === "LEASE_LOST", "Stale generation must report lease loss.");
    check(
      store.takeoverObservedGeneration === 1,
      "Invocation A must hold claimed generation one."
    );
    check(
      store.parent.attemptCount === 2,
      "Invocation B must own claimed generation two."
    );
    check(
      store.parent.leaseOwner === "worker-a",
      "The newer lease may use the same worker ID."
    );
    check(
      store.parent.status === "PROCESSING",
      "Stale lifecycle handling must not overwrite the newer claim."
    );
    check(
      store.effect("payment").status === "PENDING" &&
        store.effect("payment").attemptCount === 0,
      "Stale lifecycle updates must roll back."
    );
    check(
      store.domainWrites.length === 0,
      "Stale financial writes must roll back with the generation CAS."
    );
  });

  await group("invalid and half leases fail closed without a claim attempt", async () => {
    const cases: MockStateOptions[] = [
      {
        parentStatus: "PROCESSING",
        leaseOwner: null,
        leaseExpiresAt: fixed("2026-09-03T09:59:00.000Z"),
      },
      {
        parentStatus: "PROCESSING",
        leaseOwner: "worker-old",
        leaseExpiresAt: null,
      },
      {
        parentStatus: "PROCESSING",
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    ];
    for (const options of cases) {
      const store = new MockCoordinatorStore(options);
      const result = await execute(store);
      check(result.outcome === "MANUAL_REVIEW", "Invalid lease must require review.");
      check(result.errorCode === "LEASE_STATE_INVALID", "Invalid lease code must be stable.");
      check(store.parent.attemptCount === 0, "Invalid lease must not increment attempts.");
      check(store.invocations.length === 0, "Invalid lease must not mutate finances.");
    }
  });

  await group("FAILED_RETRYABLE is claimable only when due", async () => {
    const due = new MockCoordinatorStore({
      parentStatus: "FAILED_RETRYABLE",
      attemptCount: 1,
      nextAttemptAt: NOW,
    });
    markAllEffectsComplete(due);
    const dueResult = await execute(due);
    check(dueResult.outcome === "COMPLETE", "Due retry parent must be claimable.");
    check(due.parent.attemptCount === 2, "Due retry claim must increment once.");

    const future = new MockCoordinatorStore({
      parentStatus: "FAILED_RETRYABLE",
      attemptCount: 1,
      nextAttemptAt: fixed("2026-09-03T10:01:00.000Z"),
    });
    const futureResult = await execute(future);
    check(futureResult.outcome === "LEASE_NOT_ACQUIRED", "Future retry must not be claimed.");
    check(future.parent.attemptCount === 1, "Future retry must not increment.");
  });

  await group("COMPLETE and MANUAL_REVIEW parents are automatic terminals", async () => {
    const complete = new MockCoordinatorStore({ parentStatus: "COMPLETE" });
    const completeResult = await execute(complete);
    check(completeResult.outcome === "ALREADY_COMPLETE", "Complete parent must be a no-op.");
    check(complete.invocations.length === 0, "Complete parent must have no executor calls.");

    const manual = new MockCoordinatorStore({ parentStatus: "MANUAL_REVIEW" });
    manual.parent.manualReviewReasonCode = "EXISTING_REVIEW";
    const manualResult = await execute(manual);
    check(manualResult.outcome === "MANUAL_REVIEW", "Manual parent must remain terminal.");
    check(manualResult.errorCode === "EXISTING_REVIEW", "Existing review code must be returned.");
    check(manual.parent.attemptCount === 0, "Manual parent must not increment.");
  });

  await group("NOT_APPLICABLE effects are immutable skips", async () => {
    const store = new MockCoordinatorStore({ feeMode: "ZERO" });
    const result = await execute(store);
    check(result.outcome === "COMPLETE", "Zero-fee manifest must complete.");
    check(
      !store.invocations.some((item) => item.kind === "FEE"),
      "Not-applicable fee must not be dispatched."
    );
    check(store.effect("fee").attemptCount === 0, "Not-applicable skip must not increment.");
    check(store.effect("fee").status === "NOT_APPLICABLE", "Not-applicable status must not mutate.");
  });

  await group("parked AWAITING_DATA allows independent work and avoids reselection", async () => {
    const store = new MockCoordinatorStore({ feeMode: "AWAITING" });
    const first = await execute(store);
    check(first.outcome === "AWAITING_DATA", "Awaiting fee must park the parent.");
    check(store.parent.status === "PENDING", "Parked parent must return to PENDING.");
    check(store.parent.leaseOwner === null, "Parked parent must clear lease owner.");
    check(store.parent.leaseExpiresAt === null, "Parked parent must clear lease expiry.");
    check(store.effect("fee").attemptCount === 0, "Awaiting observation must not increment.");
    check(store.effect("reconciliation").attemptCount === 0, "Blocked reconciliation must not increment.");
    check(
      !store.invocations.some(
        (item) => item.kind === "FEE" || item.kind === "RECONCILIATION"
      ),
      "Awaiting fee and blocked reconciliation must not dispatch."
    );
    check(
      store.invocations.some((item) => item.kind === "REFERRAL") &&
        store.invocations.some((item) => item.kind === "PARTNER_PAIR") &&
        store.invocations.some((item) => item.kind === "TAX"),
      "Independent siblings must still progress."
    );
    const parkedParentAttempts = store.parent.attemptCount;
    const parkedFeeAttempts = store.effect("fee").attemptCount;
    const parkedReconciliationAttempts =
      store.effect("reconciliation").attemptCount;
    const parkedInvocationCount = store.invocations.length;
    for (let repeat = 0; repeat < 3; repeat++) {
      const repeated = await execute(store);
      check(
        repeated.outcome === "AWAITING_DATA",
        "Repeated direct execution must preserve the parked outcome."
      );
    }
    check(
      store.parent.attemptCount === parkedParentAttempts,
      "Repeated direct execution must not consume parent attempts."
    );
    check(
      store.effect("fee").attemptCount === parkedFeeAttempts,
      "Repeated direct execution must not increment the fee attempt."
    );
    check(
      store.effect("reconciliation").attemptCount ===
        parkedReconciliationAttempts,
      "Repeated direct execution must not increment reconciliation."
    );
    check(
      store.invocations.length === parkedInvocationCount,
      "Repeated direct execution must make zero additional financial calls."
    );
    const recovered = await coordinator(store).recoverDueFinalizations({
      workerId: "worker-a",
      now: NOW,
      batchSize: 10,
    });
    check(recovered.examined === 0, "Parked awaiting-only parent must be excluded.");
  });

  await group("typed transient error schedules a deterministic retry", async () => {
    const store = new MockCoordinatorStore();
    store.failNext(
      "REFERRAL",
      new ReferralErrorClass(
        "CONCURRENT_IDENTITY_CONFLICT",
        "synthetic concurrent identity"
      )
    );
    const result = await execute(store);
    check(result.outcome === "RETRY_SCHEDULED", "Typed transient must schedule retry.");
    check(
      result.nextAttemptAt?.getTime() === NOW.getTime() + 60_000,
      "First failure must retry at exactly one minute."
    );
    check(store.parent.status === "FAILED_RETRYABLE", "Parent must be retryable.");
    check(store.parent.leaseOwner === null, "Retry must clear lease owner.");
    check(store.parent.leaseExpiresAt === null, "Retry must clear lease expiry.");
    check(store.effect("referral").attemptCount === 1, "Failed invocation must increment once.");
    check(store.effect("payment").attemptCount === 1, "Earlier success must remain durable.");
    check(store.effect("fee").attemptCount === 1, "Earlier fee success must remain durable.");
    check(
      result.completedEffectIds.length === 2,
      "Result must preserve earlier completed effect evidence."
    );
  });

  await group("closed retry schedule covers attempts one through four", async () => {
    const expectedDelays = [60_000, 300_000, 900_000, 3_600_000];
    for (let priorAttempts = 0; priorAttempts < expectedDelays.length; priorAttempts++) {
      const store = new MockCoordinatorStore({
        effectAttempts: { payment: priorAttempts },
      });
      store.failNext(
        "PAYMENT",
        new Prisma.PrismaClientKnownRequestError("synthetic serialization", {
          code: "P2034",
          clientVersion: "7.9.1",
        })
      );
      const result = await execute(store);
      check(result.outcome === "RETRY_SCHEDULED", "P2034 must be retryable before attempt five.");
      check(result.errorCode === "P2034", "P2034 code must remain controlled.");
      check(
        result.nextAttemptAt?.getTime() === NOW.getTime() + expectedDelays[priorAttempts],
        "Retry timestamp must follow the exact deterministic schedule."
      );
      check(
        store.effect("payment").attemptCount === priorAttempts + 1,
        "Effect failure count must increment once."
      );
    }
  });

  await group("coordinator-side P2034 uses bounded parent retry policy", async () => {
    const retryable = new MockCoordinatorStore();
    retryable.failNextRootLock(
      new Prisma.PrismaClientKnownRequestError("synthetic coordinator serialization", {
        code: "P2034",
        clientVersion: "7.9.1",
      })
    );
    const retryResult = await execute(retryable);
    check(
      retryResult.outcome === "RETRY_SCHEDULED",
      "Coordinator-side P2034 must schedule retry before the ceiling."
    );
    check(retryResult.errorCode === "P2034", "Coordinator P2034 code must remain controlled.");
    check(
      retryResult.nextAttemptAt?.getTime() === NOW.getTime() + 60_000,
      "Coordinator P2034 must use deterministic parent backoff."
    );
    check(
      retryable.parent.status === "FAILED_RETRYABLE" &&
        retryable.parent.attemptCount === 1,
      "Coordinator P2034 must preserve the claimed parent attempt."
    );
    check(
      retryable.parent.effects.every((effect) => effect.attemptCount === 0) &&
        retryable.invocations.length === 0,
      "Coordinator P2034 must not record or invoke a child effect."
    );

    const ceiling = new MockCoordinatorStore({ attemptCount: 4 });
    ceiling.failNextRootLock(
      new Prisma.PrismaClientKnownRequestError("synthetic coordinator serialization", {
        code: "P2034",
        clientVersion: "7.9.1",
      })
    );
    const ceilingResult = await execute(ceiling);
    check(
      ceilingResult.outcome === "MANUAL_REVIEW",
      "Fifth coordinator P2034 failure must require manual review."
    );
    check(
      ceilingResult.errorCode === "MAX_ATTEMPTS_EXCEEDED",
      "Coordinator P2034 ceiling code must be stable."
    );
    check(
      ceiling.parent.attemptCount === 5 &&
        ceiling.parent.status === "MANUAL_REVIEW",
      "Fifth parent attempt must be retained at manual review."
    );
  });

  await group("fifth effect and parent boundaries escalate to manual review", async () => {
    const effectBoundary = new MockCoordinatorStore({
      effectAttempts: { payment: 4 },
    });
    effectBoundary.failNext(
      "PAYMENT",
      new Prisma.PrismaClientKnownRequestError("synthetic serialization", {
        code: "P2034",
        clientVersion: "7.9.1",
      })
    );
    const effectResult = await execute(effectBoundary);
    check(effectResult.outcome === "MANUAL_REVIEW", "Fifth effect failure must be manual.");
    check(effectResult.errorCode === "MAX_ATTEMPTS_EXCEEDED", "Fifth effect code must be bounded.");
    check(effectBoundary.effect("payment").attemptCount === 5, "Fifth effect failure must be recorded.");
    check(effectBoundary.parent.leaseOwner === null, "Effect escalation must clear lease.");

    const parentBoundary = new MockCoordinatorStore({ attemptCount: 4 });
    parentBoundary.failNext(
      "PAYMENT",
      new Prisma.PrismaClientKnownRequestError("synthetic serialization", {
        code: "P2034",
        clientVersion: "7.9.1",
      })
    );
    const parentResult = await execute(parentBoundary);
    check(parentResult.outcome === "MANUAL_REVIEW", "Fifth parent claim failure must be manual.");
    check(parentBoundary.parent.attemptCount === 5, "Fifth parent claim must be recorded.");
    check(parentResult.errorCode === "MAX_ATTEMPTS_EXCEEDED", "Parent boundary code must be stable.");

    const exhausted = new MockCoordinatorStore({ attemptCount: 5 });
    const exhaustedResult = await execute(exhausted);
    check(exhaustedResult.outcome === "MANUAL_REVIEW", "Exhausted parent must not claim again.");
    check(exhausted.parent.attemptCount === 5, "Exhausted parent count must not advance.");
    check(exhausted.invocations.length === 0, "Exhausted parent must not dispatch.");
  });

  await group("typed financial inconsistency fails closed", async () => {
    const store = new MockCoordinatorStore();
    store.failNext(
      "TAX",
      new TaxErrorClass(
        "INVALID_IMMUTABLE_INTENT",
        "synthetic invalid immutable tax"
      )
    );
    const result = await execute(store);
    check(result.outcome === "MANUAL_REVIEW", "Typed invariant error must be manual.");
    check(result.errorCode === "INVALID_IMMUTABLE_INTENT", "Typed code must be preserved.");
    check(store.effect("tax:" + IDS.tax).attemptCount === 1, "Invoked tax failure must increment.");
    check(store.effect("tax:" + IDS.tax).status === "MANUAL_REVIEW", "Failed tax must be manual.");
    check(store.parent.status === "MANUAL_REVIEW", "Effect manual review must escalate parent.");
    check(store.parent.leaseOwner === null, "Manual review must clear lease.");
  });

  await group("unknown exceptions fail closed with sanitized controlled metadata", async () => {
    const store = new MockCoordinatorStore();
    store.failNext(
      "PAYMENT",
      new Error("secret-token=do-not-persist\nstack-like detail")
    );
    const result = await execute(store);
    check(result.outcome === "MANUAL_REVIEW", "Unknown exception must be manual.");
    check(
      result.errorCode === "COORDINATOR_UNCLASSIFIED_ERROR",
      "Unknown exception must use the closed coordinator code."
    );
    check(
      store.parent.lastErrorMessage ===
        "An unclassified coordinator error requires manual review.",
      "Unknown exception details must not be persisted."
    );
    check((store.parent.lastErrorMessage?.length ?? 0) <= 500, "Stored message must be bounded.");
  });

  await group("future-due failed stage blocks later financial stages", async () => {
    const store = new MockCoordinatorStore({
      effectStatuses: { payment: "FAILED_RETRYABLE" },
    });
    const future = fixed("2026-09-03T10:05:00.000Z");
    store.effect("payment").nextAttemptAt = future;
    const result = await execute(store);
    check(result.outcome === "RETRY_SCHEDULED", "Future effect must release until retry.");
    check(result.nextAttemptAt?.getTime() === future.getTime(), "Parent must use earliest effect retry.");
    check(store.invocations.length === 0, "Later stages must not bypass a failed earlier stage.");
    check(store.parent.status === "FAILED_RETRYABLE", "Parent must remain retryable.");
    check(store.parent.leaseOwner === null, "Deferred retry must clear lease.");
  });

  await group("executor rollback removes domain and lifecycle partial state", async () => {
    const store = new MockCoordinatorStore();
    store.failNext(
      "REFERRAL",
      new ReferralErrorClass(
        "DATABASE_EXECUTION_FAILED",
        "synthetic database failure"
      ),
      true
    );
    const result = await execute(store);
    check(result.outcome === "RETRY_SCHEDULED", "Bounded database failure must retry.");
    check(
      !store.domainWrites.includes("REFERRAL:PARTIAL"),
      "Aborted executor transaction must roll back partial domain state."
    );
    check(store.effect("referral").status === "FAILED_RETRYABLE", "Fresh transaction must record retry.");
    check(store.effect("referral").attemptCount === 1, "Retry metadata must increment once.");
    check(
      store.transactionOperations
        .filter((operations) => operations.some((item) => item.startsWith("root:")))
        .every((operations) => operations[0]?.startsWith("root:")),
      "Failure metadata transaction must also lock root first."
    );
  });

  await group("stale lease-owner lifecycle CAS rolls back the financial group", async () => {
    const store = new MockCoordinatorStore();
    store.forceOwnedParentCasFailure = true;
    store.externalOwnerAfterRollback = "worker-b";
    const result = await execute(store);
    check(result.outcome === "LEASE_LOST", "Stale worker must report lease loss.");
    check(store.parent.leaseOwner === "worker-b", "New owner must not be overwritten.");
    check(store.effect("payment").status === "PENDING", "Effect lifecycle must roll back.");
    check(store.effect("payment").attemptCount === 0, "Rolled-back attempt must not persist.");
    check(store.domainWrites.length === 0, "Domain write must roll back with failed lease CAS.");
  });

  await group("timeout uncertainty can resolve through exact executor replay", async () => {
    const store = new MockCoordinatorStore();
    terminalExcept(store, ["referral", "reconciliation"]);
    const result = await execute(store);
    check(result.outcome === "COMPLETE", "Replay-capable executor success must complete.");
    check(
      store.invocations.map((item) => item.kind).join(",") ===
        "REFERRAL,RECONCILIATION",
      "Only unresolved replay and reconciliation effects must run."
    );
    check(store.effect("referral").attemptCount === 1, "Exact replay must increment once.");
  });

  await group("ambiguous legacy executor evidence requires manual review", async () => {
    const store = new MockCoordinatorStore();
    terminalExcept(store, ["reconciliation"]);
    store.failNext(
      "RECONCILIATION",
      new ReconciliationErrorClass(
        "LEGACY_RECONCILIATION_REQUIRES_CLASSIFICATION",
        "synthetic ambiguous legacy evidence"
      )
    );
    const result = await execute(store);
    check(result.outcome === "MANUAL_REVIEW", "Ambiguous legacy evidence must be manual.");
    check(
      result.errorCode === "LEGACY_RECONCILIATION_REQUIRES_CLASSIFICATION",
      "Legacy classifier code must be preserved."
    );
    check(store.effect("reconciliation").attemptCount === 1, "Invoked legacy failure must count.");
  });

  await group("manifest, effect hash, and operation-key corruption fail closed", async () => {
    const rootMismatch = new MockCoordinatorStore();
    rootMismatch.parent.manifestHash = "b".repeat(64);
    const rootResult = await execute(rootMismatch);
    check(rootResult.errorCode === "MANIFEST_HASH_MISMATCH", "Root hash mismatch must be detected.");
    check(rootMismatch.invocations.length === 0, "Root hash mismatch must precede dispatch.");

    const effectMismatch = new MockCoordinatorStore();
    (effectMismatch.effect("payment").intent as Prisma.JsonObject).amountCentavos = 1;
    const effectResult = await execute(effectMismatch);
    check(effectResult.errorCode === "EFFECT_HASH_MISMATCH", "Effect hash mismatch must be detected.");
    check(effectMismatch.effect("payment").attemptCount === 0, "Preflight rejection must not increment effect.");

    const operationMismatch = new MockCoordinatorStore();
    operationMismatch.effect("payment").operationKey = "pfin:wrong:payment";
    refreshHashes(operationMismatch.parent);
    const operationResult = await execute(operationMismatch);
    check(operationResult.errorCode === "OPERATION_KEY_MISMATCH", "Operation-key mismatch must be detected.");
    check(operationMismatch.invocations.length === 0, "Operation-key mismatch must precede dispatch.");
  });

  await group("unsupported versions, topology, and transaction identity fail closed", async () => {
    const unsupported = new MockCoordinatorStore();
    unsupported.parent.manifestVersion = 2;
    refreshHashes(unsupported.parent);
    const unsupportedResult = await execute(unsupported);
    check(unsupportedResult.errorCode === "UNSUPPORTED_VERSION", "Unsupported manifest must be manual.");

    const intentVersion = new MockCoordinatorStore();
    intentVersion.effect("payment").intentVersion = 2;
    refreshHashes(intentVersion.parent);
    const intentVersionResult = await execute(intentVersion);
    check(intentVersionResult.errorCode === "UNSUPPORTED_VERSION", "Unsupported intent must be manual.");

    const topology = new MockCoordinatorStore();
    topology.parent.effects = topology.parent.effects.filter(
      (effect) => effect.effectType !== "RECONCILIATION"
    );
    refreshHashes(topology.parent);
    const topologyResult = await execute(topology);
    check(topologyResult.errorCode === "MANIFEST_TOPOLOGY_INVALID", "Missing reconciliation must be manual.");

    const identity = new MockCoordinatorStore();
    identity.parent.transaction.checkoutSessionId = "different-checkout";
    refreshHashes(identity.parent);
    const identityResult = await execute(identity);
    check(identityResult.errorCode === "TRANSACTION_IDENTITY_MISMATCH", "Checkout mismatch must be manual.");
  });

  await group("root hashing uses original intent status after lifecycle progress", async () => {
    const store = new MockCoordinatorStore();
    markAllEffectsComplete(store);
    const unchangedHash = store.parent.manifestHash;
    const result = await execute(store);
    check(result.outcome === "COMPLETE", "Completed effect replay evidence must validate.");
    check(store.parent.manifestHash === unchangedHash, "Lifecycle progress must not rewrite root hash.");
    check(store.invocations.length === 0, "Complete effects must be skipped.");
    check(
      store.parent.effects.every((effect) => effect.attemptCount === 0),
      "Complete skips must not increment attempts."
    );
  });

  await group("partner pair is atomic, deterministic, and replay-repair bounded", async () => {
    const store = new MockCoordinatorStore();
    terminalExcept(store, ["partner-commission", "partner-liability", "reconciliation"]);
    const result = await execute(store);
    check(result.outcome === "COMPLETE", "Partner pair flow must complete.");
    check(
      store.invocations.filter((item) => item.kind === "PARTNER_PAIR").length === 1,
      "Partner pair must invoke exactly once."
    );
    check(store.effect("partner-commission").attemptCount === 1, "Commission attempt must increment.");
    check(store.effect("partner-liability").attemptCount === 1, "Liability attempt must increment.");

    const mixed = new MockCoordinatorStore();
    markAllEffectsComplete(mixed);
    mixed.effect("partner-liability").status = "PENDING";
    mixed.effect("partner-liability").completedAt = null;
    mixed.effect("reconciliation").status = "PENDING";
    mixed.effect("reconciliation").completedAt = null;
    const mixedResult = await execute(mixed);
    check(mixedResult.outcome === "COMPLETE", "Supported mixed lifecycle replay must recover.");
    check(
      mixed.invocations.filter((item) => item.kind === "PARTNER_PAIR").length === 1,
      "Mixed pair must still use one pair executor."
    );
    check(mixed.effect("partner-commission").attemptCount === 1, "Pair replay increments commission once.");
    check(mixed.effect("partner-liability").attemptCount === 1, "Pair replay increments liability once.");

    const impossible = new MockCoordinatorStore();
    (impossible.effect("partner-liability").intent as Prisma.JsonObject).status =
      "NOT_APPLICABLE";
    refreshHashes(impossible.parent);
    const impossibleResult = await execute(impossible);
    check(impossibleResult.outcome === "MANUAL_REVIEW", "Impossible split intent must fail closed.");
    check(impossible.invocations.length === 0, "Impossible pair must not dispatch.");
  });

  await group("multiple taxes execute by effectKey then ID before reconciliation", async () => {
    const store = new MockCoordinatorStore({ taxIds: ["z_tax", "a_tax"] });
    terminalExcept(store, ["tax:z_tax", "tax:a_tax", "reconciliation"]);
    const result = await execute(store);
    const invokedIds = store.invocations
      .filter((item) => item.kind === "TAX")
      .map((item) => item.effectIds[0]);
    check(result.outcome === "COMPLETE", "Multiple-tax manifest must complete.");
    check(invokedIds.length === 2, "Each tax must have its own atomic group.");
    check(
      invokedIds[0] === store.effect("tax:a_tax").id &&
        invokedIds[1] === store.effect("tax:z_tax").id,
      "Taxes must execute in canonical key order."
    );
    check(
      store.invocations.at(-1)?.kind === "RECONCILIATION",
      "Reconciliation must always execute last."
    );
  });

  await group("reconciliation discrepancy atomically escalates parent and effect", async () => {
    const store = new MockCoordinatorStore();
    terminalExcept(store, ["reconciliation"]);
    store.reconciliationOutcome = "DISCREPANCY";
    const result = await execute(store);
    check(result.outcome === "MANUAL_REVIEW", "Discrepancy must require manual review.");
    check(result.errorCode === "RECONCILIATION_DISCREPANCY", "Discrepancy code must be stable.");
    check(store.effect("reconciliation").status === "MANUAL_REVIEW", "Reconciliation effect must be manual.");
    check(store.effect("reconciliation").attemptCount === 1, "Discrepancy invocation must count.");
    check(store.parent.status === "MANUAL_REVIEW", "Discrepancy must escalate parent.");
    check(store.parent.completedAt === null, "Discrepancy must not complete parent.");
    check(store.parent.leaseOwner === null, "Discrepancy must clear lease.");
  });

  await group("manually resolved reconciliation replay is accepted", async () => {
    const store = new MockCoordinatorStore();
    terminalExcept(store, ["reconciliation"]);
    store.reconciliationOutcome = "MANUALLY_RESOLVED";
    const result = await execute(store);
    check(result.outcome === "COMPLETE", "Approved manually resolved replay must complete.");
    check(store.effect("reconciliation").status === "COMPLETE", "Replay effect must complete.");
    check(store.parent.status === "COMPLETE", "Replay must atomically complete parent.");
  });

  await group("refund status and partial reversal evidence block financial execution", async () => {
    const fullRefund = new MockCoordinatorStore({ transactionStatus: "REFUNDED" });
    const fullResult = await execute(fullRefund);
    check(fullResult.errorCode === "REFUND_CONFLICT", "REFUNDED transaction must conflict.");
    check(fullRefund.invocations.length === 0, "Full refund must block dispatch.");
    check(fullRefund.effect("payment").attemptCount === 0, "Refund preflight must not increment effect.");

    const partialRefund = new MockCoordinatorStore({ transactionStatus: "PAID" });
    partialRefund.reversalCount = 1;
    const partialResult = await execute(partialRefund);
    check(partialResult.errorCode === "REFUND_CONFLICT", "Reversal ledger evidence must conflict.");
    check(partialRefund.invocations.length === 0, "Partial refund evidence must block dispatch.");
    check(partialRefund.parent.status === "MANUAL_REVIEW", "Refund conflict must escalate parent.");
    check(partialRefund.parent.leaseOwner === null, "Refund conflict must clear lease.");
  });

  await group("due recovery is bounded, sequential, and counts successful claims", async () => {
    const store = new MockCoordinatorStore();
    const result = await coordinator(store).recoverDueFinalizations({
      workerId: "worker-recovery",
      now: NOW,
      batchSize: 1,
    });
    check(result.examined === 1, "Due recovery must examine selected candidates only.");
    check(result.claimed === 1, "Due recovery must count a successful claim.");
    check(result.results.length === 1, "Due recovery must return per-parent result.");
    check(result.results[0].outcome === "COMPLETE", "Due candidate must complete.");

    const active = new MockCoordinatorStore({
      parentStatus: "PROCESSING",
      leaseOwner: "other-worker",
      leaseExpiresAt: fixed("2026-09-03T10:01:00.000Z"),
    });
    const excluded = await coordinator(active).recoverDueFinalizations({
      workerId: "worker-recovery",
      now: NOW,
      batchSize: 10,
    });
    check(excluded.examined === 0, "Active lease must be excluded by due selection.");
  });

  await group("public inputs are explicit and bounded", async () => {
    const store = new MockCoordinatorStore();
    let workerRejected = false;
    try {
      await coordinator(store).recoverDueFinalizations({
        workerId: "x".repeat(65),
        now: NOW,
        batchSize: 1,
      });
    } catch (error: unknown) {
      workerRejected = error instanceof TypeError;
    }
    check(workerRejected, "Overlong worker ID must be rejected.");

    let batchRejected = false;
    try {
      await coordinator(store).recoverDueFinalizations({
        workerId: "worker-a",
        now: NOW,
        batchSize: 101,
      });
    } catch (error: unknown) {
      batchRejected = error instanceof TypeError;
    }
    check(batchRejected, "Unbounded batch size must be rejected.");

    let dateRejected = false;
    try {
      await coordinator(store).executeFinalization({
        finalizationId: IDS.finalization,
        workerId: "worker-a",
        now: new Date(Number.NaN),
      });
    } catch (error: unknown) {
      dateRejected = error instanceof TypeError;
    }
    check(dateRejected, "Invalid ambient-like date must be rejected.");
  });

  await group("static dormancy, scope, and safety invariants hold", () => {
    const repositoryRoot = process.cwd();
    const coordinatorPath = path.join(
      repositoryRoot,
      "src/lib/payment/paymentFinalizationCoordinator.ts"
    );
    const testPath = path.join(
      repositoryRoot,
      "src/scripts/test-payment-finalization-coordinator.ts"
    );
    const coordinatorSource = fs.readFileSync(coordinatorPath, "utf8");
    const testSource = fs.readFileSync(testPath, "utf8");
    const unsafeQuery = "$queryRaw" + "Unsafe";
    const unsafeExecute = "$executeRaw" + "Unsafe";
    const taggedQuery = "$queryRaw" + String.fromCharCode(96);
    const rootIdentity = "hashtextextended($" + "{transactionId}, 0)";
    const unsafeTopType = new RegExp("\\b" + "an" + "y\\b");
    const applicationRoot = path.join(repositoryRoot, "src/app");

    check(fs.existsSync(coordinatorPath), "Authorized coordinator file must exist.");
    check(fs.existsSync(testPath), "Authorized focused test file must exist.");
    check(!unsafeTopType.test(coordinatorSource), "Coordinator must contain no unsafe top type.");
    check(!unsafeTopType.test(testSource), "Focused test must contain no unsafe top type.");
    check(!coordinatorSource.includes(unsafeQuery), "Coordinator must contain no unsafe raw query.");
    check(!coordinatorSource.includes(unsafeExecute), "Coordinator must contain no unsafe raw execute.");
    check(coordinatorSource.includes(taggedQuery), "Coordinator must use tagged raw query.");
    check(
      coordinatorSource.includes("pg_advisory_xact_lock") &&
        coordinatorSource.includes(rootIdentity),
      "Coordinator root lock SQL must use raw transactionId and seed zero."
    );
    check(
      !coordinatorSource.includes("Promise.all"),
      "Coordinator financial execution must be sequential."
    );
    check(
      !/fetch\s*\(|axios|paymongo.*(?:get|post|request)/i.test(coordinatorSource),
      "Coordinator must make zero provider calls."
    );
    check(
      !/createNotification|notificationService|sendEmail|resend/i.test(
        coordinatorSource
      ),
      "Coordinator must make zero notification calls."
    );
    check(
      coordinatorSource.includes("const LEASE_DURATION_MS = 120_000;") &&
        coordinatorSource.includes("const TRANSACTION_TIMEOUT_MS = 25_000;") &&
        coordinatorSource.includes("const TRANSACTION_MAX_WAIT_MS = 15_000;") &&
        coordinatorSource.includes("const MAX_AUTOMATIC_PARENT_ATTEMPTS = 5;") &&
        coordinatorSource.includes("const MAX_AUTOMATIC_EFFECT_ATTEMPTS = 5;") &&
        coordinatorSource.includes(
          "const RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000] as const;"
        ),
      "Approved policy constants must remain local and exact."
    );
    check(
      coordinatorSource.includes("class PaymentFinalizationCoordinator") &&
        coordinatorSource.includes("static executeFinalization(") &&
        coordinatorSource.includes("static recoverDueFinalizations("),
      "Coordinator must expose the approved operational methods."
    );

    const sourceFiles = (directory: string): string[] => {
      const results: string[] = [];
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          results.push(...sourceFiles(absolute));
        } else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) {
          results.push(absolute);
        }
      }
      return results;
    };
    const applicationFiles = sourceFiles(applicationRoot);
    const coordinatorCallers = applicationFiles.filter((file) =>
      fs.readFileSync(file, "utf8").includes("paymentFinalizationCoordinator")
    );
    check(coordinatorCallers.length === 0, "Coordinator must have zero application callers.");

    const executorNames = [
      "Idempotent" + "LedgerService",
      "Idempotent" + "ReferralRewardService",
      "Idempotent" + "PartnerCommissionService",
      "IdempotentTaxProvisionService",
      "IdempotentReconciliationService",
    ];
    for (const executorName of executorNames) {
      const newApplicationCallers = applicationFiles.filter((file) =>
        fs.readFileSync(file, "utf8").includes(executorName)
      );
      check(
        newApplicationCallers.length === 0,
        executorName + " must have zero application callers."
      );
    }

    const trackedDiff = execFileSync("git", ["diff", "--name-only"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).trim();
    check(trackedDiff === "", "Tracked modified count must remain zero.");

    const protectedTrackedPaths = [
      "prisma/schema.prisma",
      "prisma/migrations",
      "src/lib/payment/paymentFinalizationService.ts",
    ];
    const protectedDiff = execFileSync(
      "git",
      ["diff", "--name-only", "--", ...protectedTrackedPaths],
      { cwd: repositoryRoot, encoding: "utf8" }
    ).trim();
    check(
      protectedDiff === "",
      "Schema, migrations, and legacy finalizer must remain unchanged."
    );

    const stagedDiff = execFileSync(
      "git",
      ["diff", "--cached", "--name-only"],
      { cwd: repositoryRoot, encoding: "utf8" }
    ).trim();
    check(stagedDiff === "", "Staged tracked changes must remain zero.");

    const expectedSlicePaths = [
      "src/lib/payment/paymentFinalizationCoordinator.ts",
      "src/scripts/test-payment-finalization-coordinator.ts",
    ].sort((left, right) => left.localeCompare(right));

    const trackedSlicePaths = execFileSync(
      "git",
      ["ls-files", "--", ...expectedSlicePaths],
      { cwd: repositoryRoot, encoding: "utf8" }
    )
      .split(/\r?\n/)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));

    check(
      JSON.stringify(trackedSlicePaths) === JSON.stringify(expectedSlicePaths),
      "Both Slice 8C checkpoint files must be tracked."
    );
  });

  console.log("============================================================");
  console.log(
    "SLICE 8C RESULT: " +
      passedGroups +
      "/" +
      totalGroups +
      " groups passed; " +
      totalChecks +
      " checks"
  );
  console.log("============================================================");

  if (failedGroups > 0) {
    process.exitCode = 1;
  }
}

runSuite().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FATAL SYNTHETIC SUITE FAILURE: " + message);
  process.exitCode = 1;
});
