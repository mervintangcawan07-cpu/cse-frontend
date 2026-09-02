// Relative Path: src/scripts/test-idempotent-reconciliation.ts
/**
 * Synthetic Test Suite: GovStudyX Internal Finalization Reconciliation (P1-001 / Slice 6C)
 *
 * STRICTLY SYNTHETIC / IN-MEMORY.
 * ZERO LIVE DATABASE WRITES.
 * ZERO PROVIDER CALLS.
 * ZERO PRODUCTION CALLERS.
 */

import fs from "fs";
import path from "path";
import {
  Prisma,
  type FinancialLedgerEntry,
  type PartnerCommission,
  type PaymentFinalizationEffect,
  type ReconciliationRecord,
  type ReferralReward,
  type TaxRecord,
} from "@prisma/client";
import {
  IdempotentReconciliationService,
  ReconciliationExecutionError,
} from "../lib/accounting/idempotentReconciliationService";
import {
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
} from "../lib/payment/paymentFinalizationContracts";

let totalGroups = 0;
let passedGroups = 0;
let failedGroups = 0;
let totalChecks = 0;

function check(condition: boolean, message: string): void {
  totalChecks++;
  if (!condition) {
    throw new Error(message);
  }
}

async function group(name: string, fn: () => Promise<void> | void): Promise<void> {
  totalGroups++;
  try {
    await fn();
    passedGroups++;
    console.log(`PASS GROUP ${totalGroups}: ${name}`);
  } catch (error: unknown) {
    failedGroups++;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL GROUP ${totalGroups}: ${name} — ${message}`);
  }
}

const TX = "txn_recon_001";
const FIN = "pfin_recon_001";
const REC = "eff_reconciliation";
const PAY = "eff_payment";
const FEE = "eff_fee";
const REF = "eff_referral";
const COMM = "eff_partner_commission";
const LIAB = "eff_partner_liability";
const TAX = "eff_tax_none";
const VERIFIED = new Date("2026-09-01T05:00:00.000Z");
const PURCHASE = 29_900;
const FEE_AMOUNT = 1_500;

type JsonRecord = Record<string, unknown>;

function hashIntent(intent: JsonRecord): string {
  return computeSha256Hash(canonicalizeJson(intent));
}

function baseFinalization() {
  return {
    id: FIN,
    transactionId: TX,
    checkoutSessionId: "cs_recon_001",
    providerPaymentId: "pay_recon_001",
    providerPaidAt: VERIFIED,
    source: "WEBHOOK",
    origin: "NEW_PAYMENT",
    status: "PROCESSING",
    manifestVersion: 1,
    manifestRevision: 1,
    manifestHash: "a".repeat(64),
    planType: "1_YEAR",
    currency: "PHP",
    purchaseAmountCentavos: PURCHASE,
    feeKnowledge: "KNOWN",
    feeAmountCentavos: FEE_AMOUNT as number | null,
    feeObservedAt: VERIFIED,
    entitlementBefore: null,
    entitlementAfter: null,
    verifiedAt: VERIFIED,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: VERIFIED,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    completedAt: null,
    createdAt: VERIFIED,
    updatedAt: VERIFIED,
    transaction: {
      id: TX,
      userId: "user_recon_001",
      checkoutSessionId: "cs_recon_001",
      paymentIntentId: null,
      amount: 299,
      grossAmountCentavos: PURCHASE,
      discountAmountCentavos: 0,
      feeAmountCentavos: FEE_AMOUNT,
      netSettlementCentavos: PURCHASE - FEE_AMOUNT,
      planType: "1_YEAR",
      status: "PAID",
      receiptUrl: null,
      createdAt: VERIFIED,
      updatedAt: VERIFIED,
    },
  };
}

function effect(
  id: string,
  effectType: string,
  effectKey: string,
  operationKey: string,
  status: string,
  intent: JsonRecord,
  links?: { referralId?: string | null; partnerId?: string | null; taxConfigId?: string | null }
): PaymentFinalizationEffect {
  return {
    id,
    finalizationId: FIN,
    effectType,
    effectKey,
    operationKey,
    status,
    intentVersion: 1,
    intent: intent as unknown as PaymentFinalizationEffect["intent"],
    intentHash: hashIntent(intent),
    referralId: links?.referralId ?? null,
    partnerId: links?.partnerId ?? null,
    taxConfigId: links?.taxConfigId ?? null,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: VERIFIED,
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    completedAt: status === "COMPLETE" || status === "NOT_APPLICABLE" ? VERIFIED : null,
    createdAt: VERIFIED,
    updatedAt: VERIFIED,
  } as PaymentFinalizationEffect;
}

function reconciliationIntent(): JsonRecord {
  return {
    effectType: "RECONCILIATION",
    intentVersion: 1,
    status: "PENDING",
    expectedPaymentCentavos: PURCHASE,
    expectedFeeCentavos: FEE_AMOUNT,
    feeKnowledge: "KNOWN",
    sourceType: "INTERNAL_TRANSACTION",
  };
}

function paymentIntent(): JsonRecord {
  return {
    effectType: "PAYMENT_LEDGER",
    intentVersion: 1,
    status: "PENDING",
    amountCentavos: PURCHASE,
    userId: "user_recon_001",
    planType: "1_YEAR",
    debitCategory: "CASH_PAYMONGO",
    creditCategory: "REVENUE_PREMIUM",
  };
}

function feeIntent(): JsonRecord {
  return {
    effectType: "PROVIDER_FEE_LEDGER",
    intentVersion: 1,
    feeKnowledge: "KNOWN",
    feeAmountCentavos: FEE_AMOUNT,
    status: "PENDING",
    debitCategory: "EXPENSE_PAYMENT_FEE",
    creditCategory: "CASH_PAYMONGO",
  };
}

function referralNAIntent(): JsonRecord {
  return {
    effectType: "REFERRAL_REWARD",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: "NO_REFERRAL_ATTRIBUTION",
    referralId: null,
    inviterId: null,
    referredUserId: "user_recon_001",
    purchaseAmountCentavos: PURCHASE,
    rewardType: null,
    rewardRateBasisPoints: null,
    rewardAmountCentavos: 0,
    currency: "PHP",
    holdingPeriodDays: null,
    holdingUntil: null,
  };
}

function partnerCommissionNAIntent(): JsonRecord {
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
    campaignSource: null,
    holdingPeriodDays: null,
    holdingUntil: null,
  };
}

function partnerLiabilityNAIntent(): JsonRecord {
  return {
    effectType: "PARTNER_LIABILITY_LEDGER",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: "NO_PARTNER_COMMISSION",
    partnerId: null,
    amountCentavos: 0,
    debitCategory: null,
    creditCategory: null,
  };
}

function taxNoneIntent(): JsonRecord {
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

function makeReconEffect(parent = baseFinalization()) {
  const i = reconciliationIntent();
  return {
    ...effect(
      REC,
      "RECONCILIATION",
      "reconciliation",
      buildPaymentFinalizationOperationKey(TX, { kind: "RECONCILIATION" }),
      "PENDING",
      i
    ),
    finalization: parent,
  };
}

function baseSiblings(): PaymentFinalizationEffect[] {
  return [
    effect(
      PAY,
      "PAYMENT_LEDGER",
      "payment",
      buildPaymentFinalizationOperationKey(TX, { kind: "PAYMENT" }),
      "COMPLETE",
      paymentIntent()
    ),
    effect(
      FEE,
      "PROVIDER_FEE_LEDGER",
      "fee",
      buildPaymentFinalizationOperationKey(TX, { kind: "FEE" }),
      "COMPLETE",
      feeIntent()
    ),
    effect(
      REF,
      "REFERRAL_REWARD",
      "referral",
      buildPaymentFinalizationOperationKey(TX, { kind: "REFERRAL" }),
      "NOT_APPLICABLE",
      referralNAIntent()
    ),
    effect(
      COMM,
      "PARTNER_COMMISSION",
      "partner-commission",
      buildPaymentFinalizationOperationKey(TX, { kind: "PARTNER_COMMISSION" }),
      "NOT_APPLICABLE",
      partnerCommissionNAIntent()
    ),
    effect(
      LIAB,
      "PARTNER_LIABILITY_LEDGER",
      "partner-liability",
      buildPaymentFinalizationOperationKey(TX, { kind: "PARTNER_LIABILITY" }),
      "NOT_APPLICABLE",
      partnerLiabilityNAIntent()
    ),
    effect(
      TAX,
      "TAX_PROVISION",
      "tax:none",
      buildPaymentFinalizationOperationKey(TX, { kind: "TAX_NONE" }),
      "NOT_APPLICABLE",
      taxNoneIntent()
    ),
  ];
}

function ledgerPair(args: {
  idPrefix: string;
  effectId: string;
  operationKey: string;
  transactionType: FinancialLedgerEntry["transactionType"];
  debit: FinancialLedgerEntry["accountCategory"];
  credit: FinancialLedgerEntry["accountCategory"];
  amount: number;
  sourceEntity: string;
  sourceId: string;
}): FinancialLedgerEntry[] {
  const common = {
    transactionId: TX,
    transactionType: args.transactionType,
    amountCentavos: args.amount,
    currency: "PHP",
    sourceEntity: args.sourceEntity,
    sourceId: args.sourceId,
    operationKey: args.operationKey,
    finalizationEffectId: args.effectId,
    effectiveDate: VERIFIED,
    periodId: null,
    createdBy: null,
    createdAt: VERIFIED,
  };
  return [
    {
      id: `${args.idPrefix}_dr`,
      entryNumber: `${args.idPrefix}_DR`,
      entryType: "DEBIT",
      accountCategory: args.debit,
      description: `${args.idPrefix} (DR)`,
      ...common,
    },
    {
      id: `${args.idPrefix}_cr`,
      entryNumber: `${args.idPrefix}_CR`,
      entryType: "CREDIT",
      accountCategory: args.credit,
      description: `${args.idPrefix} (CR)`,
      ...common,
    },
  ];
}

function baseLedger(): FinancialLedgerEntry[] {
  return [
    ...ledgerPair({
      idPrefix: "payment",
      effectId: PAY,
      operationKey: buildPaymentFinalizationOperationKey(TX, { kind: "PAYMENT" }),
      transactionType: "PAYMENT_RECEIVED",
      debit: "CASH_PAYMONGO",
      credit: "REVENUE_PREMIUM",
      amount: PURCHASE,
      sourceEntity: "PaymentFinalization",
      sourceId: FIN,
    }),
    ...ledgerPair({
      idPrefix: "fee",
      effectId: FEE,
      operationKey: buildPaymentFinalizationOperationKey(TX, { kind: "FEE" }),
      transactionType: "PAYMONGO_FEE",
      debit: "EXPENSE_PAYMENT_FEE",
      credit: "CASH_PAYMONGO",
      amount: FEE_AMOUNT,
      sourceEntity: "PaymentFinalization",
      sourceId: FIN,
    }),
  ];
}

function cloneEffect(e: PaymentFinalizationEffect): PaymentFinalizationEffect {
  return structuredClone(e);
}

function replaceIntent(e: PaymentFinalizationEffect, intent: JsonRecord): PaymentFinalizationEffect {
  const cloned = cloneEffect(e);
  cloned.intent = intent as unknown as PaymentFinalizationEffect["intent"];
  cloned.intentHash = hashIntent(intent);
  return cloned;
}

function makeRecord(overrides?: Partial<ReconciliationRecord>): ReconciliationRecord {
  return {
    id: "rec_durable_001",
    sourceType: "INTERNAL_TRANSACTION",
    sourceId: TX,
    matchedTransactionId: TX,
    finalizationEffectId: REC,
    status: "MATCHED",
    discrepancyCentavos: 0,
    discrepancyNotes: "ALL_EVIDENCE_MATCHED",
    reconciledBy: null,
    reconciledAt: new Date("2026-09-01T06:00:00.000Z"),
    createdAt: new Date("2026-09-01T06:00:00.000Z"),
    updatedAt: new Date("2026-09-01T06:00:00.000Z"),
    ...overrides,
  };
}

class MockTx {
  public reconEffect = makeReconEffect();
  public siblings = baseSiblings();
  public ledger = baseLedger();
  public rewards: ReferralReward[] = [];
  public commissions: PartnerCommission[] = [];
  public taxes: TaxRecord[] = [];
  public reconciliations: ReconciliationRecord[] = [];
  public rawQueries: string[] = [];
  public writeCount = 0;
  public postAbortCallCount = 0;
  public aborted = false;
  public simulateReconCreateError: unknown = null;

  public noteCall(): void {
    if (this.aborted) this.postAbortCallCount++;
  }

  public asClient(): Prisma.TransactionClient {
    return this as unknown as Prisma.TransactionClient;
  }

  public $queryRaw = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown> => {
    this.noteCall();
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += String(values[i]) + strings[i + 1];
    this.rawQueries.push(text.replace(/\s+/g, " ").trim());
    return [{ ok: true }];
  };

}

// Define Prisma-like members outside the class literal so TypeScript inference stays simple.
Object.defineProperty(MockTx.prototype, "paymentFinalizationEffect", {
  configurable: true,
  get: function (this: MockTx) {
    return {
      findUnique: async (args: { where: { id: string } }) => {
        this.noteCall();
        if (args.where.id === REC) return this.reconEffect;
        return this.siblings.find((x) => x.id === args.where.id) ?? null;
      },
      findMany: async (args: {
        where: { finalizationId: string; id?: { not?: string } };
      }) => {
        this.noteCall();
        return this.siblings
          .filter((x) => x.finalizationId === args.where.finalizationId)
          .filter((x) => x.id !== args.where.id?.not)
          .slice()
          .sort((a, b) =>
            `${a.effectType}:${a.effectKey}:${a.id}`.localeCompare(
              `${b.effectType}:${b.effectKey}:${b.id}`
            )
          );
      },
    };
  },
});

Object.defineProperty(MockTx.prototype, "financialLedgerEntry", {
  configurable: true,
  get: function (this: MockTx) {
    return {
      findMany: async (args: {
        where: { operationKey?: string; finalizationEffectId?: string };
      }) => {
        this.noteCall();
        let rows = [...this.ledger];
        if (args.where.operationKey !== undefined) {
          rows = rows.filter((r) => r.operationKey === args.where.operationKey);
        }
        if (args.where.finalizationEffectId !== undefined) {
          rows = rows.filter((r) => r.finalizationEffectId === args.where.finalizationEffectId);
        }
        return rows.sort((a, b) =>
          `${a.entryType}:${a.id}`.localeCompare(`${b.entryType}:${b.id}`)
        );
      },
    };
  },
});

Object.defineProperty(MockTx.prototype, "referralReward", {
  configurable: true,
  get: function (this: MockTx) {
    return {
      findUnique: async (args: {
        where: {
          finalizationEffectId?: string;
          transactionId?: string;
          referralId?: string;
        };
      }) => {
        this.noteCall();
        if (args.where.finalizationEffectId !== undefined) {
          return this.rewards.find((r) => r.finalizationEffectId === args.where.finalizationEffectId) ?? null;
        }
        if (args.where.transactionId !== undefined) {
          return this.rewards.find((r) => r.transactionId === args.where.transactionId) ?? null;
        }
        if (args.where.referralId !== undefined) {
          return this.rewards.find((r) => r.referralId === args.where.referralId) ?? null;
        }
        return null;
      },
    };
  },
});

Object.defineProperty(MockTx.prototype, "partnerCommission", {
  configurable: true,
  get: function (this: MockTx) {
    return {
      findUnique: async (args: {
        where: { finalizationEffectId?: string; transactionId?: string };
      }) => {
        this.noteCall();
        if (args.where.finalizationEffectId !== undefined) {
          return this.commissions.find((r) => r.finalizationEffectId === args.where.finalizationEffectId) ?? null;
        }
        if (args.where.transactionId !== undefined) {
          return this.commissions.find((r) => r.transactionId === args.where.transactionId) ?? null;
        }
        return null;
      },
    };
  },
});

Object.defineProperty(MockTx.prototype, "taxRecord", {
  configurable: true,
  get: function (this: MockTx) {
    return {
      findUnique: async (args: { where: { finalizationEffectId: string } }) => {
        this.noteCall();
        return this.taxes.find((r) => r.finalizationEffectId === args.where.finalizationEffectId) ?? null;
      },
      findMany: async (args: {
        where: { transactionId?: string; taxConfigId?: string };
      }) => {
        this.noteCall();
        return this.taxes
          .filter((r) =>
            args.where.transactionId === undefined || r.transactionId === args.where.transactionId
          )
          .filter((r) =>
            args.where.taxConfigId === undefined || r.taxConfigId === args.where.taxConfigId
          )
          .slice()
          .sort((a, b) => a.id.localeCompare(b.id));
      },
    };
  },
});

Object.defineProperty(MockTx.prototype, "reconciliationRecord", {
  configurable: true,
  get: function (this: MockTx) {
    return {
      findUnique: async (args: { where: { finalizationEffectId: string } }) => {
        this.noteCall();
        return this.reconciliations.find(
          (r) => r.finalizationEffectId === args.where.finalizationEffectId
        ) ?? null;
      },
      findMany: async (args: {
        where: { sourceType: string; sourceId: string };
      }) => {
        this.noteCall();
        return this.reconciliations
          .filter(
            (r) =>
              r.sourceType === args.where.sourceType &&
              r.sourceId === args.where.sourceId
          )
          .slice()
          .sort((a, b) => a.id.localeCompare(b.id));
      },
      create: async (args: {
        data: Omit<ReconciliationRecord, "id" | "createdAt" | "updatedAt">;
      }) => {
        this.noteCall();
        this.writeCount++;
        if (this.simulateReconCreateError) {
          this.aborted = true;
          throw this.simulateReconCreateError;
        }
        const now = new Date("2026-09-01T06:30:00.000Z");
        const row: ReconciliationRecord = {
          id: `rec_created_${this.reconciliations.length + 1}`,
          createdAt: now,
          updatedAt: now,
          ...args.data,
        };
        this.reconciliations.push(row);
        return row;
      },
      update: async (args: {
        where: { id: string };
        data: Partial<ReconciliationRecord>;
      }) => {
        this.noteCall();
        this.writeCount++;
        const index = this.reconciliations.findIndex((r) => r.id === args.where.id);
        if (index < 0) throw new Error("mock update target missing");
        const row: ReconciliationRecord = {
          ...this.reconciliations[index],
          ...args.data,
          updatedAt: new Date("2026-09-01T06:31:00.000Z"),
        };
        this.reconciliations[index] = row;
        return row;
      },
    };
  },
});

async function execute(mock: MockTx) {
  return IdempotentReconciliationService.executeReconciliationEffect({
    transactionId: TX,
    reconciliationEffectId: REC,
    tx: mock.asClient(),
  });
}

async function expectCode(mock: MockTx, code: string): Promise<void> {
  let observed: string | null = null;
  try {
    await execute(mock);
  } catch (error: unknown) {
    if (error instanceof ReconciliationExecutionError) observed = error.code;
  }
  check(observed === code, `expected ${code}, observed ${String(observed)}`);
}

function findSibling(mock: MockTx, type: string): PaymentFinalizationEffect {
  const found = mock.siblings.find((x) => x.effectType === type);
  if (!found) throw new Error(`missing sibling ${type}`);
  return found;
}

function setSiblingStatus(
  mock: MockTx,
  type: string,
  status: PaymentFinalizationEffect["status"]
): void {
  const sibling = findSibling(mock, type);
  sibling.status = status;
}

function corruptHash(mock: MockTx, type: string): void {
  findSibling(mock, type).intentHash = "b".repeat(64);
}

function activeReferralScenario(mock: MockTx): void {
  const holding = new Date(VERIFIED.getTime() + 7 * 86400000).toISOString();
  const intent: JsonRecord = {
    effectType: "REFERRAL_REWARD",
    intentVersion: 1,
    status: "PENDING",
    referralId: "ref_001",
    inviterId: "user_inviter",
    referredUserId: "user_recon_001",
    purchaseAmountCentavos: PURCHASE,
    rewardType: "PERCENTAGE",
    rewardRateBasisPoints: 2000,
    rewardAmountCentavos: 5980,
    currency: "PHP",
    holdingPeriodDays: 7,
    holdingUntil: holding,
  };
  const index = mock.siblings.findIndex((x) => x.effectType === "REFERRAL_REWARD");
  mock.siblings[index] = effect(
    REF,
    "REFERRAL_REWARD",
    "referral",
    buildPaymentFinalizationOperationKey(TX, { kind: "REFERRAL" }),
    "COMPLETE",
    intent,
    { referralId: "ref_001" }
  );
  mock.rewards = [{
    id: "reward_001",
    referralId: "ref_001",
    inviterId: "user_inviter",
    referredUserId: "user_recon_001",
    transactionId: TX,
    finalizationEffectId: REF,
    purchaseAmountCentavos: PURCHASE,
    rewardType: "PERCENTAGE",
    effectiveRate: 20,
    rewardAmountCentavos: 5980,
    currency: "PHP",
    status: "PENDING",
    holdingUntil: new Date(holding),
    availableAt: null,
    reversalReason: null,
    reversedAt: null,
    createdAt: VERIFIED,
    updatedAt: VERIFIED,
  }];
}

function activePartnerScenario(mock: MockTx): void {
  const holding = new Date(VERIFIED.getTime() + 7 * 86400000).toISOString();
  const commIntent: JsonRecord = {
    effectType: "PARTNER_COMMISSION",
    intentVersion: 1,
    status: "PENDING",
    partnerId: "partner_001",
    partnerCode: "PTR001",
    commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
    commissionRateBasisPoints: 1000,
    calculationBasis: "CUSTOMER_PAYMENT",
    baseAmountCentavos: PURCHASE,
    commissionAmountCentavos: 2990,
    currency: "PHP",
    campaignSource: "direct",
    holdingPeriodDays: 7,
    holdingUntil: holding,
  };
  const liabIntent: JsonRecord = {
    effectType: "PARTNER_LIABILITY_LEDGER",
    intentVersion: 1,
    status: "PENDING",
    partnerId: "partner_001",
    amountCentavos: 2990,
    debitCategory: "EXPENSE_PARTNER",
    creditCategory: "LIABILITY_PARTNER_PAYABLE",
  };
  const ci = mock.siblings.findIndex((x) => x.effectType === "PARTNER_COMMISSION");
  const li = mock.siblings.findIndex((x) => x.effectType === "PARTNER_LIABILITY_LEDGER");
  mock.siblings[ci] = effect(
    COMM,
    "PARTNER_COMMISSION",
    "partner-commission",
    buildPaymentFinalizationOperationKey(TX, { kind: "PARTNER_COMMISSION" }),
    "COMPLETE",
    commIntent,
    { partnerId: "partner_001" }
  );
  mock.siblings[li] = effect(
    LIAB,
    "PARTNER_LIABILITY_LEDGER",
    "partner-liability",
    buildPaymentFinalizationOperationKey(TX, { kind: "PARTNER_LIABILITY" }),
    "COMPLETE",
    liabIntent,
    { partnerId: "partner_001" }
  );
  mock.commissions = [{
    id: "commission_001",
    partnerId: "partner_001",
    transactionId: TX,
    finalizationEffectId: COMM,
    purchaseAmountCentavos: PURCHASE,
    commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
    effectiveRate: 10,
    commissionAmountCentavos: 2990,
    currency: "PHP",
    status: "PENDING",
    campaignSource: "direct",
    holdingUntil: new Date(holding),
    availableAt: null,
    reversedAt: null,
    reversalReason: null,
    createdAt: VERIFIED,
    updatedAt: VERIFIED,
  }];
  mock.ledger.push(
    ...ledgerPair({
      idPrefix: "partner",
      effectId: LIAB,
      operationKey: buildPaymentFinalizationOperationKey(TX, { kind: "PARTNER_LIABILITY" }),
      transactionType: "PARTNER_COMMISSION",
      debit: "EXPENSE_PARTNER",
      credit: "LIABILITY_PARTNER_PAYABLE",
      amount: 2990,
      sourceEntity: "PartnerCommission",
      sourceId: "commission_001",
    })
  );
}

function activeTaxScenario(mock: MockTx, configId = "tax_vat_12", effectId = "eff_tax_vat"): void {
  mock.siblings = mock.siblings.filter((x) => x.effectType !== "TAX_PROVISION");
  const intent: JsonRecord = {
    effectType: "TAX_PROVISION",
    intentVersion: 1,
    status: "PENDING",
    taxConfigId: configId,
    taxName: "VAT",
    taxType: "VAT",
    calculationBasis: "CUSTOMER_PAYMENT",
    taxableAmountCentavos: PURCHASE,
    taxRateBasisPoints: 1200,
    taxAmountCentavos: 3588,
    debitCategory: "EXPENSE_TAX",
    creditCategory: "LIABILITY_TAX_PAYABLE",
  };
  mock.siblings.push(
    effect(
      effectId,
      "TAX_PROVISION",
      `tax:${configId}`,
      buildPaymentFinalizationOperationKey(TX, { kind: "TAX", taxConfigId: configId }),
      "COMPLETE",
      intent,
      { taxConfigId: configId }
    )
  );
  mock.taxes.push({
    id: `record_${configId}`,
    taxConfigId: configId,
    transactionId: TX,
    partnerPayoutId: null,
    referralPayoutId: null,
    finalizationEffectId: effectId,
    taxableAmountCentavos: PURCHASE,
    appliedRate: 12,
    taxAmountCentavos: 3588,
    calculationBasis: "CUSTOMER_PAYMENT",
    status: "PROVISIONED",
    effectiveDate: VERIFIED,
    createdAt: VERIFIED,
  });
  mock.ledger.push(
    ...ledgerPair({
      idPrefix: `tax_${configId}`,
      effectId,
      operationKey: buildPaymentFinalizationOperationKey(TX, { kind: "TAX", taxConfigId: configId }),
      transactionType: "TAX_PROVISION",
      debit: "EXPENSE_TAX",
      credit: "LIABILITY_TAX_PAYABLE",
      amount: 3588,
      sourceEntity: "TaxRecord",
      sourceId: `record_${configId}`,
    })
  );
}

async function runSuite(): Promise<void> {
  await group("fresh all-terminal exact evidence creates MATCHED", async () => {
    const mock = new MockTx();
    const result = await execute(mock);
    check(result.outcome === "MATCHED", "expected MATCHED");
    check(result.isReplay === false, "fresh result must not be replay");
    check(mock.writeCount === 1, "fresh match creates one reconciliation row");
  });

  await group("exact MATCHED record replays with zero writes", async () => {
    const mock = new MockTx();
    const row = makeRecord();
    mock.reconciliations = [row];
    const before = row.reconciledAt?.toISOString();
    const result = await execute(mock);
    check(result.outcome === "MATCHED" && result.isReplay, "expected MATCHED replay");
    check(mock.writeCount === 0, "replay must not write");
    check(result.record.reconciledAt?.toISOString() === before, "reconciledAt preserved");
  });

  await group("exact discrepancy record updates when evidence is repaired", async () => {
    const mock = new MockTx();
    mock.reconciliations = [makeRecord({
      status: "MISSING",
      discrepancyCentavos: PURCHASE,
      discrepancyNotes: "PAYMENT_LEDGER_MISSING",
    })];
    const result = await execute(mock);
    check(result.outcome === "MATCHED", "repaired state becomes MATCHED");
    check(result.isReplay === false, "changed evaluation is update not replay");
    check(mock.writeCount === 1, "exact automatic record updated once");
  });

  await group("manual resolution is returned untouched", async () => {
    const mock = new MockTx();
    const manual = makeRecord({
      status: "MANUALLY_RESOLVED",
      reconciledBy: "admin_001",
      discrepancyNotes: "human-reviewed",
    });
    mock.reconciliations = [manual];
    const result = await execute(mock);
    check(result.outcome === "MANUALLY_RESOLVED", "manual outcome preserved");
    check(result.record.reconciledBy === "admin_001", "manual reconciler preserved");
    check(mock.writeCount === 0, "manual resolution never overwritten");
  });

  await group("legacy null-effect source row fails closed", async () => {
    const mock = new MockTx();
    mock.reconciliations = [makeRecord({
      id: `rec_${TX}`,
      finalizationEffectId: null,
    })];
    await expectCode(mock, "LEGACY_RECONCILIATION_REQUIRES_CLASSIFICATION");
  });

  await group("duplicate source identities fail closed", async () => {
    const mock = new MockTx();
    mock.reconciliations = [
      makeRecord({ id: "rec_1" }),
      makeRecord({ id: "rec_2", finalizationEffectId: null }),
    ];
    await expectCode(mock, "RECONCILIATION_IDENTITY_CONFLICT");
  });

  await group("crossed effect/source identity fails closed", async () => {
    const mock = new MockTx();
    mock.reconciliations = [
      makeRecord({ id: "rec_effect", sourceId: "other_tx" }),
      makeRecord({ id: "rec_source", finalizationEffectId: null }),
    ];
    await expectCode(mock, "RECONCILIATION_IDENTITY_CONFLICT");
  });

  await group("missing reconciliation effect fails closed", async () => {
    const mock = new MockTx();
    mock.reconEffect = null as unknown as ReturnType<typeof makeReconEffect>;
    await expectCode(mock, "EFFECT_NOT_FOUND");
  });

  await group("wrong reconciliation effect type fails closed", async () => {
    const mock = new MockTx();
    mock.reconEffect.effectType = "PAYMENT_LEDGER";
    await expectCode(mock, "WRONG_EFFECT_TYPE");
  });

  await group("malformed reconciliation hash fails closed", async () => {
    const mock = new MockTx();
    mock.reconEffect.intentHash = "broken";
    await expectCode(mock, "INTENT_HASH_MISMATCH");
  });

  await group("reconciliation hash mismatch fails closed", async () => {
    const mock = new MockTx();
    mock.reconEffect.intentHash = "c".repeat(64);
    await expectCode(mock, "INTENT_HASH_MISMATCH");
  });

  await group("unsupported reconciliation intent version fails closed", async () => {
    const mock = new MockTx();
    mock.reconEffect.intentVersion = 2;
    await expectCode(mock, "UNSUPPORTED_INTENT_VERSION");
  });

  await group("extra reconciliation intent key fails closed", async () => {
    const mock = new MockTx();
    const i = { ...reconciliationIntent(), extra: true };
    mock.reconEffect.intent = i as unknown as PaymentFinalizationEffect["intent"];
    mock.reconEffect.intentHash = hashIntent(i);
    await expectCode(mock, "INVALID_IMMUTABLE_INTENT");
  });

  await group("wrong reconciliation effectKey fails closed", async () => {
    const mock = new MockTx();
    mock.reconEffect.effectKey = "wrong";
    await expectCode(mock, "MANIFEST_LINKAGE_MISMATCH");
  });

  await group("wrong reconciliation operationKey fails closed", async () => {
    const mock = new MockTx();
    mock.reconEffect.operationKey = "pfin:txn_recon_001:payment";
    await expectCode(mock, "MANIFEST_LINKAGE_MISMATCH");
  });

  await group("transaction identity mismatch fails closed", async () => {
    const mock = new MockTx();
    mock.reconEffect.finalization.transactionId = "txn_other";
    await expectCode(mock, "TRANSACTION_IDENTITY_MISMATCH");
  });

  await group("foreign reconciliation linkage columns fail closed", async () => {
    const mock = new MockTx();
    mock.reconEffect.partnerId = "partner_forbidden";
    await expectCode(mock, "MANIFEST_LINKAGE_MISMATCH");
  });

  await group("parent MANUAL_REVIEW blocks reconciliation", async () => {
    const mock = new MockTx();
    mock.reconEffect.finalization.status = "MANUAL_REVIEW";
    await expectCode(mock, "INVALID_LIFECYCLE");
  });

  await group("reconciliation effect AWAITING_DATA is invalid", async () => {
    const mock = new MockTx();
    mock.reconEffect.status = "AWAITING_DATA";
    await expectCode(mock, "INVALID_LIFECYCLE");
  });

  await group("COMPLETE reconciliation without record is replay-only failure", async () => {
    const mock = new MockTx();
    mock.reconEffect.status = "COMPLETE";
    await expectCode(mock, "INVALID_LIFECYCLE");
  });

  for (const [status, label] of [
    ["PENDING", "PENDING sibling blocks"],
    ["AWAITING_DATA", "AWAITING_DATA sibling blocks"],
    ["FAILED_RETRYABLE", "FAILED_RETRYABLE sibling blocks"],
    ["MANUAL_REVIEW", "MANUAL_REVIEW sibling blocks"],
  ] as const) {
    await group(label, async () => {
      const mock = new MockTx();
      setSiblingStatus(mock, "PAYMENT_LEDGER", status);
      await expectCode(mock, "PREREQUISITE_NOT_TERMINAL");
    });
  }

  await group("corrupted sibling intent hash fails closed", async () => {
    const mock = new MockTx();
    corruptHash(mock, "PAYMENT_LEDGER");
    await expectCode(mock, "SIBLING_INTENT_INVALID");
  });

  await group("missing PAYMENT_LEDGER sibling fails topology", async () => {
    const mock = new MockTx();
    mock.siblings = mock.siblings.filter((x) => x.effectType !== "PAYMENT_LEDGER");
    await expectCode(mock, "SIBLING_INTENT_INVALID");
  });

  await group("second reconciliation sibling fails topology", async () => {
    const mock = new MockTx();
    mock.siblings.push(effect(
      "eff_recon_2",
      "RECONCILIATION",
      "reconciliation-2",
      "pfin:txn_recon_001:reconciliation-2",
      "COMPLETE",
      reconciliationIntent()
    ));
    await expectCode(mock, "SIBLING_INTENT_INVALID");
  });

  await group("missing all TAX_PROVISION siblings fails topology", async () => {
    const mock = new MockTx();
    mock.siblings = mock.siblings.filter((x) => x.effectType !== "TAX_PROVISION");
    await expectCode(mock, "SIBLING_INTENT_INVALID");
  });

  await group("tax:none cannot coexist with configured tax", async () => {
    const mock = new MockTx();
    const configured = effect(
      "eff_tax_extra",
      "TAX_PROVISION",
      "tax:tax_extra",
      buildPaymentFinalizationOperationKey(TX, { kind: "TAX", taxConfigId: "tax_extra" }),
      "NOT_APPLICABLE",
      {
        effectType: "TAX_PROVISION",
        intentVersion: 1,
        status: "NOT_APPLICABLE",
        notApplicableReason: "ZERO_TAX_CALCULATED",
        taxConfigId: "tax_extra",
        taxName: "Extra",
        taxType: "VAT",
        calculationBasis: "CUSTOMER_PAYMENT",
        taxableAmountCentavos: PURCHASE,
        taxRateBasisPoints: 0,
        taxAmountCentavos: 0,
        debitCategory: null,
        creditCategory: null,
      },
      { taxConfigId: "tax_extra" }
    );
    mock.siblings.push(configured);
    await expectCode(mock, "SIBLING_INTENT_INVALID");
  });

  await group("missing payment ledger creates MISSING discrepancy", async () => {
    const mock = new MockTx();
    mock.ledger = mock.ledger.filter((r) => r.finalizationEffectId !== PAY);
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected MISSING");
    check(result.record.discrepancyNotes?.includes("PAYMENT_LEDGER_MISSING") === true, "missing token");
    check(result.record.discrepancyCentavos === PURCHASE, "payment amount is primary discrepancy");
  });

  await group("one-sided payment ledger creates MISSING", async () => {
    const mock = new MockTx();
    mock.ledger = mock.ledger.filter((r) => !(r.finalizationEffectId === PAY && r.entryType === "CREDIT"));
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected MISSING");
    check(result.record.discrepancyCentavos === PURCHASE, "one-sided payment uses expected amount");
  });

  await group("duplicate payment ledger creates DUPLICATE", async () => {
    const mock = new MockTx();
    mock.ledger.push({ ...mock.ledger.find((r) => r.finalizationEffectId === PAY)!, id: "payment_extra" });
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "DUPLICATE", "expected DUPLICATE");
  });

  await group("payment amount mismatch creates MISMATCHED", async () => {
    const mock = new MockTx();
    for (const row of mock.ledger.filter((r) => r.finalizationEffectId === PAY)) row.amountCentavos = 20_000;
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISMATCHED", "expected MISMATCHED");
    check(result.record.discrepancyCentavos === 9_900, "deterministic amount difference");
  });

  await group("credit-only payment amount mismatch creates nonzero MISMATCHED", async () => {
    const mock = new MockTx();
    const credit = mock.ledger.find(
      (r) => r.finalizationEffectId === PAY && r.entryType === "CREDIT"
    );
    if (!credit) throw new Error("missing payment credit fixture");
    credit.amountCentavos = 20_000;
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISMATCHED", "expected MISMATCHED");
    check(result.record.discrepancyCentavos === 9_900, "credit deviation determines discrepancy");
  });

  await group("payment source mismatch creates MISMATCHED", async () => {
    const mock = new MockTx();
    for (const row of mock.ledger.filter((r) => r.finalizationEffectId === PAY)) row.sourceEntity = "Transaction";
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISMATCHED", "expected MISMATCHED");
  });

  await group("missing fee ledger creates MISSING", async () => {
    const mock = new MockTx();
    mock.ledger = mock.ledger.filter((r) => r.finalizationEffectId !== FEE);
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected MISSING");
    check(result.record.discrepancyNotes?.includes("FEE_LEDGER_MISSING") === true, "fee missing token");
  });

  await group("one-sided fee ledger creates expected-amount MISSING", async () => {
    const mock = new MockTx();
    mock.ledger = mock.ledger.filter(
      (r) => !(r.finalizationEffectId === FEE && r.entryType === "CREDIT")
    );
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected MISSING");
    check(result.record.discrepancyCentavos === FEE_AMOUNT, "one-sided fee uses expected amount");
  });

  await group("duplicate fee ledger creates DUPLICATE", async () => {
    const mock = new MockTx();
    mock.ledger.push({ ...mock.ledger.find((r) => r.finalizationEffectId === FEE)!, id: "fee_extra" });
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "DUPLICATE", "expected DUPLICATE");
  });

  await group("fee amount mismatch creates MISMATCHED", async () => {
    const mock = new MockTx();
    for (const row of mock.ledger.filter((r) => r.finalizationEffectId === FEE)) row.amountCentavos = 999;
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISMATCHED", "expected MISMATCHED");
  });

  await group("not-applicable fee forbids ledger evidence", async () => {
    const mock = new MockTx();
    mock.reconEffect.finalization.feeAmountCentavos = 0;
    const ri = { ...reconciliationIntent(), expectedFeeCentavos: 0 };
    mock.reconEffect.intent = ri as unknown as PaymentFinalizationEffect["intent"];
    mock.reconEffect.intentHash = hashIntent(ri);
    const fee = findSibling(mock, "PROVIDER_FEE_LEDGER");
    const fi = {
      effectType: "PROVIDER_FEE_LEDGER",
      intentVersion: 1,
      feeKnowledge: "KNOWN",
      feeAmountCentavos: 0,
      status: "NOT_APPLICABLE",
      notApplicableReason: "ZERO_PROVIDER_FEE",
      debitCategory: null,
      creditCategory: null,
    };
    const replacement = replaceIntent(fee, fi);
    replacement.status = "NOT_APPLICABLE";
    mock.siblings[mock.siblings.indexOf(fee)] = replacement;
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY", "unexpected fee evidence must be discrepancy");
    check(result.record.discrepancyNotes?.includes("FEE_LEDGER") === true, "fee unexpected token");
  });

  await group("active referral exact evidence reconciles", async () => {
    const mock = new MockTx();
    activeReferralScenario(mock);
    const result = await execute(mock);
    check(result.outcome === "MATCHED", "active referral exact evidence should match");
  });

  await group("active referral missing evidence creates MISSING", async () => {
    const mock = new MockTx();
    activeReferralScenario(mock);
    mock.rewards = [];
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected referral MISSING");
  });

  await group("active referral mismatched evidence creates MISMATCHED", async () => {
    const mock = new MockTx();
    activeReferralScenario(mock);
    mock.rewards[0].rewardAmountCentavos = 5000;
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISMATCHED", "expected referral mismatch");
  });

  await group("active referral split identities create DUPLICATE", async () => {
    const mock = new MockTx();
    activeReferralScenario(mock);

    mock.rewards[0].transactionId = "txn_other_referral";
    mock.rewards[0].referralId = "ref_other";
    mock.rewards.push({
      ...mock.rewards[0],
      id: "reward_002",
      transactionId: TX,
      referralId: "ref_001",
      finalizationEffectId: null,
    });

    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "DUPLICATE", "expected referral duplicate");
  });

  await group("not-applicable referral forbids reward evidence", async () => {
    const mock = new MockTx();
    mock.rewards = [{
      id: "unexpected_reward",
      referralId: "ref_unexpected",
      inviterId: "user_inviter",
      referredUserId: "user_recon_001",
      transactionId: TX,
      finalizationEffectId: REF,
      purchaseAmountCentavos: PURCHASE,
      rewardType: "PERCENTAGE",
      effectiveRate: 20,
      rewardAmountCentavos: 5980,
      currency: "PHP",
      status: "PENDING",
      holdingUntil: null,
      availableAt: null,
      reversalReason: null,
      reversedAt: null,
      createdAt: VERIFIED,
      updatedAt: VERIFIED,
    }];
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY", "unexpected referral reward must be discrepancy");
  });

  await group("active partner exact commission and liability reconcile", async () => {
    const mock = new MockTx();
    activePartnerScenario(mock);
    const result = await execute(mock);
    check(result.outcome === "MATCHED", "active partner exact evidence should match");
  });

  await group("active partner missing commission creates MISSING", async () => {
    const mock = new MockTx();
    activePartnerScenario(mock);
    mock.commissions = [];
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected partner commission missing");
  });

  await group("active partner commission mismatch creates MISMATCHED", async () => {
    const mock = new MockTx();
    activePartnerScenario(mock);
    mock.commissions[0].commissionAmountCentavos = 2000;
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISMATCHED", "expected commission mismatch");
  });

  await group("active partner split commission identities creates DUPLICATE", async () => {
    const mock = new MockTx();
    activePartnerScenario(mock);

    mock.commissions[0].transactionId = "txn_other_partner";
    mock.commissions.push({
      ...mock.commissions[0],
      id: "commission_002",
      transactionId: TX,
      finalizationEffectId: null,
    });

    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "DUPLICATE", "expected commission duplicate");
  });

  await group("active partner liability missing creates MISSING", async () => {
    const mock = new MockTx();
    activePartnerScenario(mock);
    mock.ledger = mock.ledger.filter((r) => r.finalizationEffectId !== LIAB);
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected liability missing");
  });

  await group("one-sided partner liability creates expected-amount MISSING", async () => {
    const mock = new MockTx();
    activePartnerScenario(mock);
    mock.ledger = mock.ledger.filter(
      (r) => !(r.finalizationEffectId === LIAB && r.entryType === "CREDIT")
    );
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected liability missing");
    check(result.record.discrepancyCentavos === 2_990, "one-sided liability uses expected amount");
  });

  await group("active partner liability mismatch creates MISMATCHED", async () => {
    const mock = new MockTx();
    activePartnerScenario(mock);
    for (const row of mock.ledger.filter((r) => r.finalizationEffectId === LIAB)) row.amountCentavos = 1000;
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISMATCHED", "expected liability mismatch");
  });

  await group("not-applicable partner forbids commission evidence", async () => {
    const mock = new MockTx();
    mock.commissions = [{
      id: "unexpected_comm",
      partnerId: "partner_001",
      transactionId: TX,
      finalizationEffectId: COMM,
      purchaseAmountCentavos: PURCHASE,
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      effectiveRate: 10,
      commissionAmountCentavos: 2990,
      currency: "PHP",
      status: "PENDING",
      campaignSource: "direct",
      holdingUntil: null,
      availableAt: null,
      reversedAt: null,
      reversalReason: null,
      createdAt: VERIFIED,
      updatedAt: VERIFIED,
    }];
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY", "unexpected partner commission must be discrepancy");
  });

  await group("active configured tax exact evidence reconciles", async () => {
    const mock = new MockTx();
    activeTaxScenario(mock);
    const result = await execute(mock);
    check(result.outcome === "MATCHED", "active tax exact evidence should match");
  });

  await group("active tax record missing creates MISSING", async () => {
    const mock = new MockTx();
    activeTaxScenario(mock);
    mock.taxes = [];
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected tax missing");
  });

  await group("active tax record mismatch creates MISMATCHED", async () => {
    const mock = new MockTx();
    activeTaxScenario(mock);
    mock.taxes[0].taxAmountCentavos = 3000;
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISMATCHED", "expected tax mismatch");
  });

  await group("active tax ledger missing creates MISSING", async () => {
    const mock = new MockTx();
    activeTaxScenario(mock);
    mock.ledger = mock.ledger.filter((r) => r.finalizationEffectId !== "eff_tax_vat");
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected tax ledger missing");
  });

  await group("one-sided tax ledger creates expected-amount MISSING", async () => {
    const mock = new MockTx();
    activeTaxScenario(mock);
    mock.ledger = mock.ledger.filter(
      (r) => !(r.finalizationEffectId === "eff_tax_vat" && r.entryType === "CREDIT")
    );
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "MISSING", "expected tax ledger missing");
    check(result.record.discrepancyCentavos === 3_588, "one-sided tax uses expected amount");
  });

  await group("active tax duplicate record creates DUPLICATE", async () => {
    const mock = new MockTx();
    activeTaxScenario(mock);
    mock.taxes.push({ ...mock.taxes[0], id: "record_tax_vat_12_dup", finalizationEffectId: null });
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "DUPLICATE", "expected tax duplicate");
  });

  await group("tax:none forbids tax or ledger evidence", async () => {
    const mock = new MockTx();
    mock.taxes.push({
      id: "unexpected_tax",
      taxConfigId: "legacy_tax",
      transactionId: TX,
      partnerPayoutId: null,
      referralPayoutId: null,
      finalizationEffectId: null,
      taxableAmountCentavos: PURCHASE,
      appliedRate: 0,
      taxAmountCentavos: 1,
      calculationBasis: "CUSTOMER_PAYMENT",
      status: "PROVISIONED",
      effectiveDate: VERIFIED,
      createdAt: VERIFIED,
    });
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY", "unexpected tax:none evidence must be discrepancy");
  });

  await group("multiple configured taxes reconcile independently", async () => {
    const mock = new MockTx();
    activeTaxScenario(mock, "tax_vat_12", "eff_tax_vat");
    const firstTax = mock.siblings.find((x) => x.effectType === "TAX_PROVISION")!;
    const secondIntent: JsonRecord = {
      effectType: "TAX_PROVISION",
      intentVersion: 1,
      status: "PENDING",
      taxConfigId: "tax_pct_3",
      taxName: "Percentage",
      taxType: "PERCENTAGE_TAX",
      calculationBasis: "CUSTOMER_PAYMENT",
      taxableAmountCentavos: PURCHASE,
      taxRateBasisPoints: 1200,
      taxAmountCentavos: 3588,
      debitCategory: "EXPENSE_TAX",
      creditCategory: "LIABILITY_TAX_PAYABLE",
    };
    const second = effect(
      "eff_tax_pct",
      "TAX_PROVISION",
      "tax:tax_pct_3",
      buildPaymentFinalizationOperationKey(TX, { kind: "TAX", taxConfigId: "tax_pct_3" }),
      "COMPLETE",
      secondIntent,
      { taxConfigId: "tax_pct_3" }
    );
    mock.siblings = mock.siblings.filter((x) => x.id !== firstTax.id);
    mock.siblings.push(firstTax, second);
    mock.taxes.push({
      id: "record_tax_pct_3",
      taxConfigId: "tax_pct_3",
      transactionId: TX,
      partnerPayoutId: null,
      referralPayoutId: null,
      finalizationEffectId: "eff_tax_pct",
      taxableAmountCentavos: PURCHASE,
      appliedRate: 12,
      taxAmountCentavos: 3588,
      calculationBasis: "CUSTOMER_PAYMENT",
      status: "PROVISIONED",
      effectiveDate: VERIFIED,
      createdAt: VERIFIED,
    });
    mock.ledger.push(...ledgerPair({
      idPrefix: "tax_pct_3",
      effectId: "eff_tax_pct",
      operationKey: buildPaymentFinalizationOperationKey(TX, { kind: "TAX", taxConfigId: "tax_pct_3" }),
      transactionType: "TAX_PROVISION",
      debit: "EXPENSE_TAX",
      credit: "LIABILITY_TAX_PAYABLE",
      amount: 3588,
      sourceEntity: "TaxRecord",
      sourceId: "record_tax_pct_3",
    }));
    const result = await execute(mock);
    check(result.outcome === "MATCHED", "multiple configured taxes should match");
  });

  await group("severity precedence DUPLICATE > MISMATCHED > MISSING", async () => {
    const mock = new MockTx();
    mock.ledger = mock.ledger.filter((r) => r.finalizationEffectId !== FEE);
    for (const row of mock.ledger.filter((r) => r.finalizationEffectId === PAY)) row.amountCentavos = 20_000;
    mock.rewards = [{
      id: "unexpected_effect",
      referralId: "r_effect",
      inviterId: "i1",
      referredUserId: "user_recon_001",
      transactionId: "txn_other_effect",
      finalizationEffectId: REF,
      purchaseAmountCentavos: PURCHASE,
      rewardType: "PERCENTAGE",
      effectiveRate: 20,
      rewardAmountCentavos: 1,
      currency: "PHP",
      status: "PENDING",
      holdingUntil: null,
      availableAt: null,
      reversalReason: null,
      reversedAt: null,
      createdAt: VERIFIED,
      updatedAt: VERIFIED,
    }, {
      id: "unexpected_transaction",
      referralId: "r_transaction",
      inviterId: "i2",
      referredUserId: "user_recon_001",
      transactionId: TX,
      finalizationEffectId: null,
      purchaseAmountCentavos: PURCHASE,
      rewardType: "PERCENTAGE",
      effectiveRate: 20,
      rewardAmountCentavos: 1,
      currency: "PHP",
      status: "PENDING",
      holdingUntil: null,
      availableAt: null,
      reversalReason: null,
      reversedAt: null,
      createdAt: VERIFIED,
      updatedAt: VERIFIED,
    }];
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && result.status === "DUPLICATE", "DUPLICATE precedence");
  });

  await group("discrepancy notes are deterministic and sorted", async () => {
    const mock = new MockTx();
    mock.ledger = [];
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY", "expected discrepancy");
    const notes = result.record.discrepancyNotes ?? "";
    const tokens = notes.split(";");
    check(JSON.stringify(tokens) === JSON.stringify([...tokens].sort()), "tokens sorted");
    check(new Set(tokens).size === tokens.length, "tokens deduplicated");
  });

  await group("automatic exact record with changed evidence updates once", async () => {
    const mock = new MockTx();
    mock.reconciliations = [makeRecord()];
    mock.ledger = mock.ledger.filter((r) => r.finalizationEffectId !== PAY);
    const result = await execute(mock);
    check(result.outcome === "DISCREPANCY" && !result.isReplay, "changed state updates");
    check(mock.writeCount === 1, "one update only");
  });

  await group("COMPLETE parent rejects changed automatic reconciliation record", async () => {
    const mock = new MockTx();
    mock.reconEffect.finalization.status = "COMPLETE";
    mock.reconciliations = [makeRecord()];
    mock.ledger = mock.ledger.filter((r) => r.finalizationEffectId !== PAY);
    await expectCode(mock, "INVALID_LIFECYCLE");
  });

  await group("recognized reconciliation P2002 maps to concurrent conflict", async () => {
    const mock = new MockTx();
    mock.simulateReconCreateError = {
      code: "P2002",
      meta: { target: ["finalizationEffectId"] },
    };
    await expectCode(mock, "CONCURRENT_IDENTITY_CONFLICT");
    check(mock.postAbortCallCount === 0, "no SQL after aborted P2002");
  });

  await group("named reconciliation P2002 target is recognized", async () => {
    const mock = new MockTx();
    mock.simulateReconCreateError = {
      code: "P2002",
      meta: { target: "ReconciliationRecord_finalizationEffectId_key" },
    };
    await expectCode(mock, "CONCURRENT_IDENTITY_CONFLICT");
  });

  await group("unrelated P2002 maps to generic database failure", async () => {
    const mock = new MockTx();
    mock.simulateReconCreateError = {
      code: "P2002",
      meta: { target: ["id"] },
    };
    await expectCode(mock, "DATABASE_EXECUTION_FAILED");
  });

  await group("advisory lock order begins transaction -> effect -> operation", async () => {
    const mock = new MockTx();
    await execute(mock);
    const locks = mock.rawQueries.filter((q) => q.includes("pg_advisory_xact_lock"));
    check(locks.length >= 3, "expected at least three advisory locks");
    check(locks[0].includes(TX), "first lock is transaction root");
    check(locks[1].includes(`reconciliation:effect:${REC}`), "second lock is reconciliation effect");
    check(locks[2].includes(`reconciliation:operation:pfin:${TX}:reconciliation`), "third lock is reconciliation operation");
  });

  await group("sibling row locks occur in sorted ID order", async () => {
    const mock = new MockTx();
    await execute(mock);
    const siblingIds = mock.siblings.map((s) => s.id).sort();
    const raw = mock.rawQueries.join("\n");
    let lastIndex = -1;
    for (const id of siblingIds) {
      const index = raw.indexOf(id);
      check(index > lastIndex, `expected sorted sibling lock order for ${id}`);
      lastIndex = index;
    }
  });

  await group("service writes reconciliation domain only", async () => {
    const service = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentReconciliationService.ts"),
      "utf8"
    );
    check(!service.includes(".financialLedgerEntry.create"), "no ledger creates");
    check(!service.includes(".financialLedgerEntry.update"), "no ledger updates");
    check(!service.includes(".referralReward.create"), "no referral creates");
    check(!service.includes(".partnerCommission.create"), "no partner creates");
    check(!service.includes(".taxRecord.create"), "no tax creates");
    check(service.includes(".reconciliationRecord.create"), "reconciliation create allowed");
    check(service.includes(".reconciliationRecord.update"), "reconciliation update allowed");
  });

  await group("service imports no child executor or ledger primitive", async () => {
    const service = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentReconciliationService.ts"),
      "utf8"
    );
    check(!service.includes("IdempotentLedgerService"), "no ledger primitive import");
    check(!service.includes("IdempotentPartnerCommissionService"), "no partner executor import");
    check(!service.includes("IdempotentTaxProvisionService"), "no tax executor import");
    check(!service.includes("IdempotentReferralRewardService"), "no referral executor import");
  });

  await group("service has zero PayMongo/provider execution imports", async () => {
    const service = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentReconciliationService.ts"),
      "utf8"
    );
    check(!service.includes("paymongo"), "no PayMongo dependency");
    check(!service.includes("fetch("), "no network fetch");
  });

  await group("service uses zero unsafe SQL and zero raw mutation", async () => {
    const service = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentReconciliationService.ts"),
      "utf8"
    );
    check(!service.includes("$queryRawUnsafe"), "no unsafe raw SQL");
    check(!service.includes("$executeRaw"), "no raw SQL mutation");
  });

  await group("service has zero explicit any types", async () => {
    const service = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentReconciliationService.ts"),
      "utf8"
    );
    const dynamicAny = new RegExp(":\\s*a" + "ny\\b|as\\s+a" + "ny\\b|<a" + "ny>|\\ba" + "ny\\[\\]");
    check(!dynamicAny.test(service), "service contains zero any types");
  });

  await group("service has caller-owned transaction path without nested transaction", async () => {
    const service = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentReconciliationService.ts"),
      "utf8"
    );
    check(service.includes("if (params.tx)"), "caller-owned branch exists");
    check(service.includes("prisma.$transaction"), "self-owned transaction path exists");
  });

  await group("service contains no lifecycle write methods", async () => {
    const service = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentReconciliationService.ts"),
      "utf8"
    );
    check(!service.includes("paymentFinalization.update"), "no finalization lifecycle update");
    check(!service.includes("paymentFinalizationEffect.update"), "no effect lifecycle update");
  });

  await group("zero src/app production callers", async () => {
    function listFiles(root: string): string[] {
      if (!fs.existsSync(root)) return [];
      const result: string[] = [];
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const full = path.join(root, entry.name);
        if (entry.isDirectory()) result.push(...listFiles(full));
        else result.push(full);
      }
      return result;
    }
    const consumers = listFiles(path.resolve(process.cwd(), "src/app"))
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .filter((file) => {
        const source = fs.readFileSync(file, "utf8");
        return source.includes("IdempotentReconciliationService") ||
          source.includes("idempotentReconciliationService");
      });
    check(consumers.length === 0, `zero src/app callers; found ${consumers.join(", ")}`);
  });

  await group("new reconciliation service is not an IdempotentLedgerService consumer", async () => {
    const service = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentReconciliationService.ts"),
      "utf8"
    );
    check(!service.includes("IdempotentLedgerService"), "Slice 3 allowlist remains unchanged");
  });

  await group("legacy reconciliation service remains untouched and separate", async () => {
    const legacy = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/reconciliationService.ts"),
      "utf8"
    );
    const durable = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentReconciliationService.ts"),
      "utf8"
    );
    check(legacy.includes("class ReconciliationService"), "legacy class still exists");
    check(durable.includes("class IdempotentReconciliationService"), "durable class separate");
    check(!durable.includes("transaction.amount > 5000"), "no legacy amount heuristic");
  });

  await group("reconciliation intent source type is exact INTERNAL_TRANSACTION", async () => {
    const mock = new MockTx();
    const i = { ...reconciliationIntent(), sourceType: "PAYMONGO_PAYMENT" };
    mock.reconEffect.intent = i as unknown as PaymentFinalizationEffect["intent"];
    mock.reconEffect.intentHash = hashIntent(i);
    await expectCode(mock, "INVALID_IMMUTABLE_INTENT");
  });

  await group("known reconciliation fee must match finalization fee snapshot", async () => {
    const mock = new MockTx();
    const i = { ...reconciliationIntent(), expectedFeeCentavos: 100 };
    mock.reconEffect.intent = i as unknown as PaymentFinalizationEffect["intent"];
    mock.reconEffect.intentHash = hashIntent(i);
    await expectCode(mock, "MANIFEST_LINKAGE_MISMATCH");
  });

  await group("unknown fee requires null expected fee and blocks via awaiting sibling", async () => {
    const mock = new MockTx();
    mock.reconEffect.finalization.feeKnowledge = "UNKNOWN";
    mock.reconEffect.finalization.feeAmountCentavos = null;
    const ri = {
      ...reconciliationIntent(),
      feeKnowledge: "UNKNOWN",
      expectedFeeCentavos: null,
    };
    mock.reconEffect.intent = ri as unknown as PaymentFinalizationEffect["intent"];
    mock.reconEffect.intentHash = hashIntent(ri);

    const fee = findSibling(mock, "PROVIDER_FEE_LEDGER");
    const fi = {
      effectType: "PROVIDER_FEE_LEDGER",
      intentVersion: 1,
      feeKnowledge: "UNKNOWN",
      feeAmountCentavos: null,
      status: "AWAITING_DATA",
      debitCategory: null,
      creditCategory: null,
    };
    const replacement = replaceIntent(fee, fi);
    replacement.status = "AWAITING_DATA";
    mock.siblings[mock.siblings.indexOf(fee)] = replacement;

    await expectCode(mock, "PREREQUISITE_NOT_TERMINAL");
  });

  await group("automatic PENDING reconciliation records are never accepted as replay", async () => {
    const mock = new MockTx();
    mock.reconciliations = [makeRecord({ status: "PENDING" })];
    await expectCode(mock, "RECONCILIATION_IDENTITY_CONFLICT");
  });

  await group("exact automatic record with reconciledBy set fails closed", async () => {
    const mock = new MockTx();
    mock.reconciliations = [makeRecord({ reconciledBy: "unexpected_user" })];
    await expectCode(mock, "RECONCILIATION_IDENTITY_CONFLICT");
  });

  await group("fresh automatic record sets matched transaction/source/effect identities", async () => {
    const mock = new MockTx();
    const result = await execute(mock);
    check(result.record.sourceType === "INTERNAL_TRANSACTION", "sourceType exact");
    check(result.record.sourceId === TX, "sourceId exact");
    check(result.record.matchedTransactionId === TX, "matched transaction exact");
    check(result.record.finalizationEffectId === REC, "effect identity exact");
  });

  await group("fresh automatic reconciliation audit timestamp is populated", async () => {
    const mock = new MockTx();
    const result = await execute(mock);
    check(result.record.reconciledAt instanceof Date, "reconciledAt populated");
    check(Number.isFinite(result.record.reconciledAt?.getTime()), "reconciledAt valid");
  });

  await group("discrepancy centavos remains PostgreSQL Int bounded", async () => {
    const mock = new MockTx();
    mock.ledger = mock.ledger.filter((r) => r.finalizationEffectId !== PAY);
    const result = await execute(mock);
    check(result.record.discrepancyCentavos >= 0, "nonnegative discrepancy");
    check(result.record.discrepancyCentavos <= 2_147_483_647, "PostgreSQL Int bounded");
  });

  await group("discrepancy notes are bounded to 1000 characters", async () => {
    const mock = new MockTx();
    activeTaxScenario(mock);
    for (let n = 0; n < 25; n++) {
      const cfg = `tax_${String(n).padStart(2, "0")}_${"x".repeat(20)}`;
      const intent: JsonRecord = {
        effectType: "TAX_PROVISION",
        intentVersion: 1,
        status: "PENDING",
        taxConfigId: cfg,
        taxName: "Tax",
        taxType: "VAT",
        calculationBasis: "CUSTOMER_PAYMENT",
        taxableAmountCentavos: PURCHASE,
        taxRateBasisPoints: 1200,
        taxAmountCentavos: 3588,
        debitCategory: "EXPENSE_TAX",
        creditCategory: "LIABILITY_TAX_PAYABLE",
      };
      mock.siblings.push(effect(
        `eff_${cfg}`,
        "TAX_PROVISION",
        `tax:${cfg}`,
        buildPaymentFinalizationOperationKey(TX, { kind: "TAX", taxConfigId: cfg }),
        "COMPLETE",
        intent,
        { taxConfigId: cfg }
      ));
    }
    mock.taxes = [];
    mock.ledger = mock.ledger.filter((r) => !String(r.operationKey ?? "").includes(":tax:"));
    const result = await execute(mock);
    check((result.record.discrepancyNotes ?? "").length <= 1000, "notes length bounded");
  });

  console.log("============================================================");
  console.log(
    `Slice 6C synthetic summary: ${passedGroups}/${totalGroups} groups passed; ${totalChecks} checks executed; ${failedGroups} groups failed.`
  );
  console.log(
    "LIMITATION: synthetic tests cannot prove real PostgreSQL lock waiting, isolation behavior, unique-race scheduling, transaction abort semantics, or deadlock freedom."
  );
  if (failedGroups > 0) process.exit(1);
}

runSuite().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Unhandled synthetic test failure:", message);
  process.exit(1);
});
