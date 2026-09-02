// Relative Path: src/scripts/test-idempotent-partner-commission.ts
/**
 * Synthetic Test Suite: Idempotent Partner Commission & Liability Executor (P1-001 / Slice 5)
 *
 * In-memory only. No real database, provider, notification, or production call.
 * Real PostgreSQL lock waiting, abort semantics, and deadlock freedom require a
 * later separately authorized disposable-database test.
 */

import fs from "node:fs";
import path from "node:path";
import {
  Prisma,
  type FinancialLedgerEntry,
  type Partner,
  type PartnerCommission,
  type PaymentFinalization,
  type PaymentFinalizationEffect,
  type Transaction,
} from "@prisma/client";
import {
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
} from "../lib/payment/paymentFinalizationContracts";
import {
  IdempotentPartnerCommissionService,
  PartnerCommissionExecutionError,
  type ExecutePartnerCommissionAndLiabilityParams,
  type ExecutePartnerCommissionAndLiabilityResult,
  type PartnerCommissionExecutionErrorCode,
  type V1PartnerCommissionNotApplicableReason,
} from "../lib/accounting/idempotentPartnerCommissionService";
import {
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
} from "../lib/accounting/idempotentLedgerService";
import { prisma } from "../lib/prisma";

type LoadedEffect = PaymentFinalizationEffect & {
  finalization: PaymentFinalization & {
    transaction: Transaction;
  };
};

interface MockRawCall {
  readonly query: string;
  readonly values: readonly unknown[];
}

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
  run: () => Promise<void> | void
): Promise<void> {
  totalGroups++;
  try {
    await run();
    passedGroups++;
    console.log(`PASS GROUP ${totalGroups}: ${name}`);
  } catch (error: unknown) {
    failedGroups++;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL GROUP ${totalGroups}: ${name} — ${message}`);
  }
}

function fixedDate(value: string): Date {
  return new Date(value);
}

const IDS = {
  transaction: "txn_partner_slice5_001",
  commissionEffect: "effect_partner_comm_slice5_001",
  liabilityEffect: "effect_partner_liab_slice5_001",
  finalization: "finalization_slice5_001",
  partner: "partner_slice5_001",
  partnerCode: "PARTNER_CODE_001",
  user: "user_customer_slice5_001",
  checkout: "checkout_slice5_001",
} as const;

const VERIFIED_AT = "2026-08-31T10:00:00.000Z";
const HOLDING_UNTIL = "2026-09-07T10:00:00.000Z";
const COMM_OP_KEY = buildPaymentFinalizationOperationKey(
  IDS.transaction,
  { kind: "PARTNER_COMMISSION" }
);
const LIAB_OP_KEY = buildPaymentFinalizationOperationKey(
  IDS.transaction,
  { kind: "PARTNER_LIABILITY" }
);

function activeCommIntent(
  overrides: Record<string, Prisma.JsonValue> = {}
): Prisma.JsonObject {
  return {
    effectType: "PARTNER_COMMISSION",
    intentVersion: 1,
    status: "PENDING",
    partnerId: IDS.partner,
    partnerCode: IDS.partnerCode,
    commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
    commissionRateBasisPoints: 2_000,
    calculationBasis: "CUSTOMER_PAYMENT",
    baseAmountCentavos: 29_900,
    commissionAmountCentavos: 5_980,
    currency: "PHP",
    campaignSource: "direct",
    holdingPeriodDays: 7,
    holdingUntil: HOLDING_UNTIL,
    ...overrides,
  };
}

function activeLiabIntent(
  overrides: Record<string, Prisma.JsonValue> = {}
): Prisma.JsonObject {
  return {
    effectType: "PARTNER_LIABILITY_LEDGER",
    intentVersion: 1,
    status: "PENDING",
    partnerId: IDS.partner,
    amountCentavos: 5_980,
    debitCategory: "EXPENSE_PARTNER",
    creditCategory: "LIABILITY_PARTNER_PAYABLE",
    ...overrides,
  };
}

function notApplicableCommIntent(
  reason: V1PartnerCommissionNotApplicableReason,
  overrides: Record<string, Prisma.JsonValue> = {}
): Prisma.JsonObject {
  const isNoAttr = reason === "NO_PARTNER_ATTRIBUTION";
  const isZero = reason === "ZERO_COMMISSION_CALCULATED";
  return {
    effectType: "PARTNER_COMMISSION",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: reason,
    partnerId: isNoAttr ? null : IDS.partner,
    partnerCode: isNoAttr ? null : IDS.partnerCode,
    commissionModel: isNoAttr
      ? null
      : isZero
      ? "PERCENTAGE_OF_CUSTOMER_PAYMENT"
      : "PERCENTAGE_OF_CUSTOMER_PAYMENT",
    commissionRateBasisPoints: isNoAttr ? null : isZero ? 0 : null,
    calculationBasis: isNoAttr ? null : isZero ? "CUSTOMER_PAYMENT" : null,
    baseAmountCentavos: isNoAttr ? null : isZero ? 29_900 : null,
    commissionAmountCentavos: 0,
    currency: "PHP",
    campaignSource: isNoAttr ? null : "direct",
    holdingPeriodDays: isNoAttr ? null : isZero ? 7 : null,
    holdingUntil: null,
    ...overrides,
  };
}

function notApplicableLiabIntent(
  partnerId: string | null = IDS.partner,
  overrides: Record<string, Prisma.JsonValue> = {}
): Prisma.JsonObject {
  return {
    effectType: "PARTNER_LIABILITY_LEDGER",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: "NO_PARTNER_COMMISSION",
    partnerId,
    amountCentavos: 0,
    debitCategory: null,
    creditCategory: null,
    ...overrides,
  };
}

function makeTransaction(): Transaction {
  return {
    id: IDS.transaction,
    userId: IDS.user,
    checkoutSessionId: IDS.checkout,
    paymentIntentId: "pay_slice5_001",
    amount: 299,
    grossAmountCentavos: 29_900,
    discountAmountCentavos: 0,
    feeAmountCentavos: 0,
    netSettlementCentavos: 29_900,
    planType: "1_MONTH",
    status: "PAID",
    receiptUrl: null,
    createdAt: fixedDate("2026-08-31T09:59:00.000Z"),
    updatedAt: fixedDate("2026-08-31T10:00:00.000Z"),
  };
}

function makeFinalization(transaction: Transaction): PaymentFinalization {
  return {
    id: IDS.finalization,
    transactionId: IDS.transaction,
    checkoutSessionId: IDS.checkout,
    providerPaymentId: "pay_slice5_001",
    providerPaidAt: fixedDate(VERIFIED_AT),
    source: "WEBHOOK",
    origin: "NEW_PAYMENT",
    status: "PENDING",
    manifestVersion: 1,
    manifestRevision: 1,
    manifestHash: "a".repeat(64),
    planType: "1_MONTH",
    currency: "PHP",
    purchaseAmountCentavos: 29_900,
    feeKnowledge: "UNKNOWN",
    feeAmountCentavos: null,
    feeObservedAt: null,
    entitlementBefore: null,
    entitlementAfter: null,
    verifiedAt: fixedDate(VERIFIED_AT),
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: fixedDate(VERIFIED_AT),
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    completedAt: null,
    createdAt: fixedDate(VERIFIED_AT),
    updatedAt: fixedDate(VERIFIED_AT),
  };
}

function makeCommissionEffect(
  intent: Prisma.JsonObject,
  overrides: Partial<PaymentFinalizationEffect> = {}
): LoadedEffect {
  const transaction = makeTransaction();
  const finalization = makeFinalization(transaction);
  return {
    id: IDS.commissionEffect,
    finalizationId: IDS.finalization,
    effectType: "PARTNER_COMMISSION",
    effectKey: "partner-commission",
    operationKey: COMM_OP_KEY,
    status:
      intent.status === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "PENDING",
    intentVersion: 1,
    intent,
    intentHash: computeSha256Hash(canonicalizeJson(intent)),
    referralId: null,
    partnerId: typeof intent.partnerId === "string" ? intent.partnerId : null,
    taxConfigId: null,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: fixedDate(VERIFIED_AT),
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    completedAt: null,
    createdAt: fixedDate(VERIFIED_AT),
    updatedAt: fixedDate(VERIFIED_AT),
    finalization: { ...finalization, transaction },
    ...overrides,
  };
}

function makeLiabilityEffect(
  intent: Prisma.JsonObject,
  overrides: Partial<PaymentFinalizationEffect> = {}
): LoadedEffect {
  const transaction = makeTransaction();
  const finalization = makeFinalization(transaction);
  return {
    id: IDS.liabilityEffect,
    finalizationId: IDS.finalization,
    effectType: "PARTNER_LIABILITY_LEDGER",
    effectKey: "partner-liability",
    operationKey: LIAB_OP_KEY,
    status:
      intent.status === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "PENDING",
    intentVersion: 1,
    intent,
    intentHash: computeSha256Hash(canonicalizeJson(intent)),
    referralId: null,
    partnerId: typeof intent.partnerId === "string" ? intent.partnerId : null,
    taxConfigId: null,
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: fixedDate(VERIFIED_AT),
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    completedAt: null,
    createdAt: fixedDate(VERIFIED_AT),
    updatedAt: fixedDate(VERIFIED_AT),
    finalization: { ...finalization, transaction },
    ...overrides,
  };
}

function makePartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: IDS.partner,
    partnerId: "PT-000123",
    code: IDS.partnerCode,
    slug: "partner-test",
    name: "Partner Test",
    passwordHash: null,
    tempPasswordHash: null,
    mustChangePassword: false,
    setupToken: null,
    setupTokenExpires: null,
    resetToken: null,
    resetTokenExpires: null,
    type: "AFFILIATE",
    tagline: null,
    badgeText: "Official Partner",
    description: null,
    discountPercent: 0.0,
    avatarUrl: null,
    facebookUrl: null,
    websiteUrl: null,
    contactName: null,
    contactEmail: "partner@test.com",
    contactPhone: null,
    status: "ACTIVE",
    commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
    commissionRate: 20.0,
    fixedCommissionCentavos: null,
    holdingPeriodDays: 7,
    minPayoutCentavos: 15000,
    agreementStart: fixedDate("2026-08-01T00:00:00.000Z"),
    agreementEnd: null,
    payoutMethod: "GCASH",
    accountNumberEncrypted: null,
    accountName: null,
    bankName: null,
    notes: null,
    createdBy: null,
    createdAt: fixedDate("2026-08-01T00:00:00.000Z"),
    updatedAt: fixedDate("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeCommission(
  overrides: Partial<PartnerCommission> = {}
): PartnerCommission {
  return {
    id: "comm_slice5_001",
    partnerId: IDS.partner,
    transactionId: IDS.transaction,
    finalizationEffectId: IDS.commissionEffect,
    purchaseAmountCentavos: 29_900,
    commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
    effectiveRate: 20.0,
    commissionAmountCentavos: 5_980,
    currency: "PHP",
    status: "PENDING",
    campaignSource: "direct",
    holdingUntil: fixedDate(HOLDING_UNTIL),
    availableAt: null,
    reversedAt: null,
    reversalReason: null,
    createdAt: fixedDate(VERIFIED_AT),
    updatedAt: fixedDate(VERIFIED_AT),
    ...overrides,
  };
}

function makeLedgerPair(
  commissionId: string = "comm_slice5_001",
  amount: number = 5_980
): [FinancialLedgerEntry, FinancialLedgerEntry] {
  const debit: FinancialLedgerEntry = {
    id: "led_slice5_debit_001",
    entryNumber: "LED-000001",
    transactionId: IDS.transaction,
    transactionType: "PARTNER_COMMISSION",
    accountCategory: "EXPENSE_PARTNER",
    entryType: "DEBIT",
    amountCentavos: amount,
    currency: "PHP",
    sourceEntity: "PartnerCommission",
    sourceId: commissionId,
    operationKey: LIAB_OP_KEY,
    finalizationEffectId: IDS.liabilityEffect,
    description: `Partner commission liability for transaction ${IDS.transaction}`,
    effectiveDate: fixedDate(VERIFIED_AT),
    periodId: null,
    createdBy: null,
    createdAt: fixedDate(VERIFIED_AT),
  };
  const credit: FinancialLedgerEntry = {
    id: "led_slice5_credit_001",
    entryNumber: "LED-000002",
    transactionId: IDS.transaction,
    transactionType: "PARTNER_COMMISSION",
    accountCategory: "LIABILITY_PARTNER_PAYABLE",
    entryType: "CREDIT",
    amountCentavos: amount,
    currency: "PHP",
    sourceEntity: "PartnerCommission",
    sourceId: commissionId,
    operationKey: LIAB_OP_KEY,
    finalizationEffectId: IDS.liabilityEffect,
    description: `Partner commission liability for transaction ${IDS.transaction}`,
    effectiveDate: fixedDate(VERIFIED_AT),
    periodId: null,
    createdBy: null,
    createdAt: fixedDate(VERIFIED_AT),
  };
  return [debit, credit];
}

class MockPartnerTransactionClient {
  public commEffect: LoadedEffect;
  public liabEffect: LoadedEffect;
  public partners: Partner[];
  public commissions: PartnerCommission[];
  public ledgerEntries: FinancialLedgerEntry[];
  public rawCalls: MockRawCall[] = [];
  public advisoryLocks: string[] = [];
  public effectRowLocks: string[] = [];
  public commissionRowLocks: string[] = [];
  public readCallCount = 0;
  public writeCallCount = 0;
  public postAbortCallCount = 0;
  public simulateP2002Target: unknown = null;
  public simulateLedgerFailure: Error | null = null;
  public simulateRawFailure: Error | null = null;
  private aborted = false;
  private nextCommId = 10;
  private nextLedgerId = 10;

  constructor(options?: {
    readonly commIntent?: Prisma.JsonObject;
    readonly liabIntent?: Prisma.JsonObject;
    readonly partner?: Partner | null;
    readonly commissions?: PartnerCommission[];
    readonly ledgerEntries?: FinancialLedgerEntry[];
  }) {
    this.commEffect = makeCommissionEffect(
      options?.commIntent ?? activeCommIntent()
    );
    this.liabEffect = makeLiabilityEffect(
      options?.liabIntent ?? activeLiabIntent()
    );
    this.partners =
      options?.partner === null ? [] : [options?.partner ?? makePartner()];
    this.commissions = options?.commissions
      ? structuredClone(options.commissions)
      : [];
    this.ledgerEntries = options?.ledgerEntries
      ? structuredClone(options.ledgerEntries)
      : [];
  }

  public asTransactionClient(): Prisma.TransactionClient {
    return this as unknown as Prisma.TransactionClient;
  }

  private beforeCall(write: boolean): void {
    if (this.aborted) {
      this.postAbortCallCount++;
      throw new Error("Synthetic client was used after transaction abort.");
    }
    if (write) this.writeCallCount++;
    else this.readCallCount++;
  }

  private throwP2002(): never {
    this.aborted = true;
    throw {
      code: "P2002",
      meta: { target: this.simulateP2002Target },
    };
  }

  public async $queryRaw(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown> {
    this.beforeCall(false);
    if (this.simulateRawFailure) {
      this.aborted = true;
      throw this.simulateRawFailure;
    }
    let rendered = strings[0];
    for (let i = 0; i < values.length; i++) {
      rendered += String(values[i]) + strings[i + 1];
    }
    rendered = rendered.replace(/\s+/g, " ").trim();
    this.rawCalls.push({ query: rendered, values });

    if (rendered.includes("pg_advisory_xact_lock")) {
      const lockName = String(values[0]);
      this.advisoryLocks.push(lockName);
      return [{ lock_result: "" }];
    }

    if (rendered.includes('FROM "PaymentFinalizationEffect"')) {
      const effectId = String(values[0]);
      this.effectRowLocks.push(effectId);
      return [{ id: effectId }];
    }

    if (rendered.includes('FROM "PartnerCommission"')) {
      const id = String(values[0]);
      this.commissionRowLocks.push(id);
      return [{ id }];
    }

    return [];
  }

  public readonly paymentFinalizationEffect = {
    findUnique: async (args: { where: { id: string } }) => {
      this.beforeCall(false);
      if (args.where.id === this.commEffect.id) return this.commEffect;
      if (args.where.id === this.liabEffect.id) return this.liabEffect;
      return null;
    },
  };

  public readonly partner = {
    findUnique: async (args: { where: { id: string } }) => {
      this.beforeCall(false);
      return this.partners.find((p) => p.id === args.where.id) ?? null;
    },
  };

  public readonly partnerCommission = {
    findUnique: async (args: {
      where: { transactionId?: string; finalizationEffectId?: string };
    }) => {
      this.beforeCall(false);
      if (args.where.transactionId) {
        return (
          this.commissions.find(
            (c) => c.transactionId === args.where.transactionId
          ) ?? null
        );
      }
      if (args.where.finalizationEffectId) {
        return (
          this.commissions.find(
            (c) => c.finalizationEffectId === args.where.finalizationEffectId
          ) ?? null
        );
      }
      return null;
    },
    create: async (args: { data: Prisma.PartnerCommissionCreateInput }) => {
      this.beforeCall(true);
      if (this.simulateP2002Target) {
        this.throwP2002();
      }
      const data = args.data as Record<string, unknown>;
      const newCommission: PartnerCommission = {
        id: `comm_mock_${this.nextCommId++}`,
        partnerId: String(data.partnerId || (data.partner as { connect: { id: string } })?.connect?.id),
        transactionId: String(data.transactionId || (data.transaction as { connect: { id: string } })?.connect?.id),
        finalizationEffectId: (data.finalizationEffectId as string) || null,
        purchaseAmountCentavos: Number(data.purchaseAmountCentavos),
        commissionModel: data.commissionModel as PartnerCommission["commissionModel"],
        effectiveRate: Number(data.effectiveRate),
        commissionAmountCentavos: Number(data.commissionAmountCentavos),
        currency: String(data.currency || "PHP"),
        status: (data.status as PartnerCommission["status"]) || "PENDING",
        campaignSource: (data.campaignSource as string) || null,
        holdingUntil: (data.holdingUntil as Date) || null,
        availableAt: null,
        reversedAt: null,
        reversalReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.commissions.push(newCommission);
      return newCommission;
    },
  };

  public readonly financialLedgerEntry = {
    findMany: async (args: {
      where: { operationKey?: string; finalizationEffectId?: string };
      orderBy?: { entryType: "asc" };
    }) => {
      this.beforeCall(false);
      if (args.where.operationKey) {
        return this.ledgerEntries.filter(
          (e) => e.operationKey === args.where.operationKey
        );
      }
      if (args.where.finalizationEffectId) {
        return this.ledgerEntries.filter(
          (e) => e.finalizationEffectId === args.where.finalizationEffectId
        );
      }
      return [];
    },
    createManyAndReturn: async (args: {
      data: Prisma.FinancialLedgerEntryCreateManyInput[];
    }) => {
      this.beforeCall(true);
      if (this.simulateLedgerFailure) {
        throw this.simulateLedgerFailure;
      }
      const created: FinancialLedgerEntry[] = [];
      for (const item of args.data) {
        const effDate =
          item.effectiveDate instanceof Date
            ? item.effectiveDate
            : typeof item.effectiveDate === "string" || typeof item.effectiveDate === "number"
            ? new Date(item.effectiveDate)
            : new Date();

        const entry: FinancialLedgerEntry = {
          id: `led_mock_${this.nextLedgerId++}`,
          entryNumber: String(item.entryNumber),
          transactionId: item.transactionId ?? null,
          transactionType: item.transactionType,
          accountCategory: item.accountCategory,
          entryType: item.entryType,
          amountCentavos: item.amountCentavos,
          currency: item.currency ?? "PHP",
          sourceEntity: item.sourceEntity,
          sourceId: item.sourceId,
          operationKey: item.operationKey ?? null,
          finalizationEffectId: item.finalizationEffectId ?? null,
          description: item.description,
          effectiveDate: effDate,
          periodId: item.periodId ?? null,
          createdBy: item.createdBy ?? null,
          createdAt: new Date(),
        };
        this.ledgerEntries.push(entry);
        created.push(entry);
      }
      return created;
    },
  };
}

async function executeWithMock(
  mock: MockPartnerTransactionClient,
  overrides: Partial<Omit<ExecutePartnerCommissionAndLiabilityParams, "tx">> = {}
): Promise<ExecutePartnerCommissionAndLiabilityResult> {
  return IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
    transactionId: IDS.transaction,
    commissionEffectId: IDS.commissionEffect,
    liabilityEffectId: IDS.liabilityEffect,
    ...overrides,
    tx: mock.asTransactionClient(),
  });
}

async function captureExecutionError(
  mock: MockPartnerTransactionClient,
  overrides: Partial<Omit<ExecutePartnerCommissionAndLiabilityParams, "tx">> = {}
): Promise<PartnerCommissionExecutionError | null> {
  try {
    await executeWithMock(mock, overrides);
    return null;
  } catch (error: unknown) {
    return error instanceof PartnerCommissionExecutionError ? error : null;
  }
}

function mutateBothFinalizations(
  mock: MockPartnerTransactionClient,
  mutate: (finalization: PaymentFinalization) => void
): void {
  mutate(mock.commEffect.finalization);
  mutate(mock.liabEffect.finalization);
}

function listSourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(resolved));
    } else if (entry.isFile()) {
      files.push(resolved);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function runSuite(): Promise<void> {
  console.log("============================================================");
  console.log("SYNTHETIC SLICE 5 ATOMIC PARTNER COMMISSION SUITE");
  console.log("============================================================");

  // Group 1: Fresh percentage customer-payment creation
  await group("fresh percentage customer-payment creation is atomic and balanced", async () => {
    const mock = new MockPartnerTransactionClient();
    const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });

    check(result.outcome === "CREATED", "outcome is CREATED");
    if (result.outcome === "CREATED") {
      check(result.commission !== null, "commission row created");
      check(result.commission.commissionAmountCentavos === 5_980, "commission amount is 5980");
      check(result.commission.purchaseAmountCentavos === 29_900, "purchaseAmount matches finalization");
      check(result.debitEntry !== null && result.creditEntry !== null, "ledger pair created");
      check(result.debitEntry.transactionType === "PARTNER_COMMISSION", "ledger transactionType is PARTNER_COMMISSION");
      check(result.debitEntry.accountCategory === "EXPENSE_PARTNER", "debit category is EXPENSE_PARTNER");
      check(result.creditEntry.accountCategory === "LIABILITY_PARTNER_PAYABLE", "credit category is LIABILITY_PARTNER_PAYABLE");
    }
  });

  // Group 2: Fresh percentage gross creation
  await group("fresh percentage gross creation calculates from gross base", async () => {
    const comm = activeCommIntent({
      commissionModel: "PERCENTAGE_OF_GROSS",
      calculationBasis: "GROSS_PRICE",
      baseAmountCentavos: 50_000,
      commissionRateBasisPoints: 1_000,
      commissionAmountCentavos: 5_000,
    });
    const liab = activeLiabIntent({ amountCentavos: 5_000 });
    const mock = new MockPartnerTransactionClient({ commIntent: comm, liabIntent: liab });
    const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });

    check(result.outcome === "CREATED", "gross commission created");
    if (result.outcome === "CREATED") {
      check(result.commission.commissionAmountCentavos === 5_000, "commission amount is 5000");
      check(result.commission.purchaseAmountCentavos === 29_900, "purchaseAmount retains finalization purchase");
    }
  });

  // Group 3: Fresh fixed-per-purchase creation
  await group("fresh fixed-per-purchase creation uses fixed basis and rateBps 0", async () => {
    const comm = activeCommIntent({
      commissionModel: "FIXED_PER_PURCHASE",
      commissionRateBasisPoints: 0,
      calculationBasis: "FIXED_AMOUNT",
      baseAmountCentavos: null,
      commissionAmountCentavos: 10_000,
    });
    const liab = activeLiabIntent({ amountCentavos: 10_000 });
    const mock = new MockPartnerTransactionClient({ commIntent: comm, liabIntent: liab });
    const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });

    check(result.outcome === "CREATED", "fixed commission created");
    if (result.outcome === "CREATED") {
      check(result.commission.effectiveRate === 0, "effective rate is 0");
      check(result.commission.commissionAmountCentavos === 10_000, "amount is 10000");
    }
  });

  // Group 4: Canonical floating-point operation-order counterexample
  await group("canonical floating-point operation-order counterexample", async () => {
    const base = 13_423_625;
    const rateBps = 3_880;
    const canonicalPercentage = rateBps / 100;
    const canonicalAmount = Math.round((base * canonicalPercentage) / 100);
    const directAmount = Math.round((base * rateBps) / 10_000);
    check(canonicalAmount === 5_208_366, "canonical amount is 5208366");
    check(directAmount === 5_208_367, "direct shorthand amount is 5208367");
    check((canonicalAmount as number) !== (directAmount as number), "amounts diverge by 1 centavo");

    const comm = activeCommIntent({
      baseAmountCentavos: base,
      commissionRateBasisPoints: rateBps,
      commissionAmountCentavos: canonicalAmount,
    });
    const liab = activeLiabIntent({ amountCentavos: canonicalAmount });
    const mock = new MockPartnerTransactionClient({ commIntent: comm, liabIntent: liab });
    mutateBothFinalizations(mock, (finalization) => {
      finalization.purchaseAmountCentavos = base;
    });
    const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });
    check(result.outcome === "CREATED", "counterexample intent executes canonical amount");
    if (result.outcome === "CREATED") {
      check(result.commission.commissionAmountCentavos === 5_208_366, "persisted amount is 5208366");
    }
  });

  // Group 5: Exact pair replay
  await group("exact pair replay returns existing rows and executes zero new writes", async () => {
    const existingCommission = makeCommission();
    const existingLedger = makeLedgerPair(existingCommission.id, 5_980);
    const mock = new MockPartnerTransactionClient({
      commissions: [existingCommission],
      ledgerEntries: existingLedger,
    });
    const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });

    check(result.outcome === "REPLAY", "outcome is REPLAY");
    if (result.outcome === "REPLAY") {
      check(result.isReplay === true, "isReplay is true");
      check(result.commission.id === existingCommission.id, "same commission returned");
    }
    check(mock.writeCallCount === 0, "zero writes performed");
  });

  // Group 6: Replay across all RewardLedgerStatus lifecycle states
  await group("immutable replay permits all valid RewardLedgerStatus values", async () => {
    const statuses: PartnerCommission["status"][] = [
      "PENDING",
      "AVAILABLE",
      "PAID",
      "REVERSED",
      "REFUNDED",
      "CANCELLED",
    ];
    for (const st of statuses) {
      const existing = makeCommission({
        status: st,
        availableAt: st === "AVAILABLE" ? new Date() : null,
        reversedAt: st === "REVERSED" ? new Date() : null,
        reversalReason: st === "REVERSED" ? "Refund reversal" : null,
      });
      const ledger = makeLedgerPair(existing.id, 5_980);
      const mock = new MockPartnerTransactionClient({
        commissions: [existing],
        ledgerEntries: ledger,
      });
      const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
      check(result.outcome === "REPLAY", `status ${st} allowed for replay`);
    }
  });

  // Group 7: Partial state detection (Commission EXACT + Ledger NONE)
  await group("commission EXACT + ledger NONE throws PARTNER_COMMISSION_PARTIAL_STATE", async () => {
    const existing = makeCommission();
    const mock = new MockPartnerTransactionClient({ commissions: [existing], ledgerEntries: [] });
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "PARTNER_COMMISSION_PARTIAL_STATE", "caught PARTNER_COMMISSION_PARTIAL_STATE");
  });

  // Group 8: Partial state detection (Commission NONE + Ledger EXACT)
  await group("commission NONE + ledger EXACT throws PARTNER_COMMISSION_PARTIAL_STATE", async () => {
    const ledger = makeLedgerPair("comm_other", 5_980);
    const mock = new MockPartnerTransactionClient({ commissions: [], ledgerEntries: ledger });
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "PARTNER_COMMISSION_PARTIAL_STATE", "caught PARTNER_COMMISSION_PARTIAL_STATE");
  });

  // Group 9: Legacy commission classification
  await group("legacy commission with null finalizationEffectId throws LEGACY_COMMISSION_REQUIRES_CLASSIFICATION", async () => {
    const legacy = makeCommission({ finalizationEffectId: null });
    const mock = new MockPartnerTransactionClient({ commissions: [legacy], ledgerEntries: [] });
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "LEGACY_COMMISSION_REQUIRES_CLASSIFICATION", "caught LEGACY_COMMISSION_REQUIRES_CLASSIFICATION");
  });

  // Group 10: Commission identity conflict (byTransaction vs byEffect divergence)
  await group("byTransaction and byEffect pointing to different rows throws PARTNER_COMMISSION_IDENTITY_CONFLICT", async () => {
    const comm1 = makeCommission({ id: "comm_1", transactionId: IDS.transaction, finalizationEffectId: "other_eff" });
    const comm2 = makeCommission({ id: "comm_2", transactionId: "other_tx", finalizationEffectId: IDS.commissionEffect });
    const mock = new MockPartnerTransactionClient({ commissions: [comm1, comm2] });
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "PARTNER_COMMISSION_IDENTITY_CONFLICT", "caught PARTNER_COMMISSION_IDENTITY_CONFLICT");
  });

  // Group 11: NOT_APPLICABLE NO_PARTNER_ATTRIBUTION with caller campaignSource
  await group("NOT_APPLICABLE NO_PARTNER_ATTRIBUTION with caller campaignSource is accepted and produces zero writes", async () => {
    const comm = notApplicableCommIntent("NO_PARTNER_ATTRIBUTION", { campaignSource: "fb_ad_01" });
    const liab = notApplicableLiabIntent(null);
    const mock = new MockPartnerTransactionClient({ commIntent: comm, liabIntent: liab });
    const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });
    check(result.outcome === "NOT_APPLICABLE", "outcome is NOT_APPLICABLE");
    if (result.outcome === "NOT_APPLICABLE") {
      check(result.reason === "NO_PARTNER_ATTRIBUTION", "reason is NO_PARTNER_ATTRIBUTION");
    }
    check(mock.writeCallCount === 0, "zero writes executed");
  });

  // Group 12: NOT_APPLICABLE INACTIVE_PARTNER exact persisted enum validation
  await group("NOT_APPLICABLE INACTIVE_PARTNER accepts persisted inactive models and rejects fake models", async () => {
    const acceptedModels = [
      "CUSTOM_RULE",
      "FIXED_PER_REFERRAL",
      "PERCENTAGE_OF_NET_AFTER_CONFIGURED_DEDUCTIONS",
    ] as const;

    for (const commissionModel of acceptedModels) {
      const comm = notApplicableCommIntent("INACTIVE_PARTNER", {
        partnerId: IDS.partner,
        partnerCode: IDS.partnerCode,
        commissionModel,
        campaignSource: "tiktok",
      });
      const liab = notApplicableLiabIntent(IDS.partner);
      const mock = new MockPartnerTransactionClient({ commIntent: comm, liabIntent: liab });
      const result = await executeWithMock(mock);
      check(
        result.outcome === "NOT_APPLICABLE" && result.reason === "INACTIVE_PARTNER",
        `${commissionModel} is accepted for INACTIVE_PARTNER`
      );
    }

    const fakeComm = notApplicableCommIntent("INACTIVE_PARTNER", {
      commissionModel: "FAKE_MODEL",
    });
    const fakeMock = new MockPartnerTransactionClient({
      commIntent: fakeComm,
      liabIntent: notApplicableLiabIntent(IDS.partner),
    });
    const fakeError = await captureExecutionError(fakeMock);
    check(
      fakeError?.code === "INVALID_IMMUTABLE_INTENT",
      "arbitrary fake inactive commission model is rejected"
    );
  });

  // Group 13: NOT_APPLICABLE ZERO_COMMISSION_CALCULATED fixed model
  await group("NOT_APPLICABLE ZERO_COMMISSION_CALCULATED fixed model validates exact shape", async () => {
    const comm = notApplicableCommIntent("ZERO_COMMISSION_CALCULATED", {
      commissionModel: "FIXED_PER_PURCHASE",
      commissionRateBasisPoints: 0,
      calculationBasis: "FIXED_AMOUNT",
      baseAmountCentavos: null,
      holdingPeriodDays: 7,
      campaignSource: "direct",
    });
    const liab = notApplicableLiabIntent(IDS.partner);
    const mock = new MockPartnerTransactionClient({ commIntent: comm, liabIntent: liab });
    const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });
    check(result.outcome === "NOT_APPLICABLE", "outcome is NOT_APPLICABLE");
    if (result.outcome === "NOT_APPLICABLE") {
      check(result.reason === "ZERO_COMMISSION_CALCULATED", "reason is ZERO_COMMISSION_CALCULATED");
    }
  });

  // Group 14: NOT_APPLICABLE ZERO_COMMISSION_CALCULATED percentage customer payment
  await group("NOT_APPLICABLE ZERO_COMMISSION_CALCULATED percentage customer payment recomputes zero", async () => {
    const comm = notApplicableCommIntent("ZERO_COMMISSION_CALCULATED", {
      commissionModel: "PERCENTAGE_OF_CUSTOMER_PAYMENT",
      commissionRateBasisPoints: 0,
      calculationBasis: "CUSTOMER_PAYMENT",
      baseAmountCentavos: 29_900,
      holdingPeriodDays: 7,
      campaignSource: "direct",
    });
    const liab = notApplicableLiabIntent(IDS.partner);
    const mock = new MockPartnerTransactionClient({ commIntent: comm, liabIntent: liab });
    const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });
    check(result.outcome === "NOT_APPLICABLE", "outcome is NOT_APPLICABLE");
  });

  // Group 15: Impossible zero cross-model combination rejected
  await group("impossible zero cross-model combination rejected", async () => {
    const comm = notApplicableCommIntent("ZERO_COMMISSION_CALCULATED", {
      commissionModel: "FIXED_PER_PURCHASE",
      commissionRateBasisPoints: 100, // Invalid for fixed
      calculationBasis: "FIXED_AMOUNT",
      baseAmountCentavos: null,
      holdingPeriodDays: 7,
      campaignSource: "direct",
    });
    const liab = notApplicableLiabIntent(IDS.partner);
    const mock = new MockPartnerTransactionClient({ commIntent: comm, liabIntent: liab });
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "INVALID_IMMUTABLE_INTENT", "caught INVALID_IMMUTABLE_INTENT for impossible zero shape");
  });

  // Group 16: Mutable current partner rate/model/status changes ignored
  await group("current partner configuration changes after manifest planning are ignored", async () => {
    const changedPartner = makePartner({
      status: "SUSPENDED",
      commissionRate: 50.0,
      commissionModel: "FIXED_PER_PURCHASE",
      code: "NEW_CODE",
    });
    const mock = new MockPartnerTransactionClient({ partner: changedPartner });
    const result = await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });
    check(result.outcome === "CREATED", "manifest executes regardless of partner status/rate change");
    if (result.outcome === "CREATED") {
      check(result.commission.effectiveRate === 20, "uses immutable manifest rate (20%)");
    }
  });

  // Group 17: Preliminary partnerId drift rejected
  await group("preliminary partnerId drift before authoritative re-read throws MANIFEST_LINKAGE_MISMATCH", async () => {
    const mock = new MockPartnerTransactionClient();
    mock.commEffect.partnerId = "partner_prelim";
    (mock.commEffect.intent as Record<string, unknown>).partnerId = "partner_prelim";
    mock.liabEffect.partnerId = "partner_prelim";
    (mock.liabEffect.intent as Record<string, unknown>).partnerId = "partner_prelim";
    mock.commEffect.intentHash = computeSha256Hash(canonicalizeJson(mock.commEffect.intent));
    mock.liabEffect.intentHash = computeSha256Hash(canonicalizeJson(mock.liabEffect.intent));

    let count = 0;
    const origFind = mock.paymentFinalizationEffect.findUnique;
    mock.paymentFinalizationEffect.findUnique = async (args) => {
      count++;
      if (count > 2) {
        // Authoritative re-read returns different partner
        const drifted = makeCommissionEffect(activeCommIntent({ partnerId: "partner_drifted" }));
        drifted.partnerId = "partner_drifted";
        if (args.where.id === IDS.commissionEffect) return drifted;
      }
      return origFind(args);
    };

    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "MANIFEST_LINKAGE_MISMATCH", "caught MANIFEST_LINKAGE_MISMATCH on partner drift");
  });

  // Group 18: Exact mapping of all IdempotentLedgerError subclasses
  await group("each IdempotentLedgerError subclass maps to exact designated Slice 5 error code", async () => {
    const mappings: [Error, PartnerCommissionExecutionErrorCode][] = [
      [new LedgerConcurrentIdentityConflictError("conflict"), "CONCURRENT_IDENTITY_CONFLICT"],
      [new LedgerInconsistentStateError("inconsistent"), "LEDGER_IDENTITY_CONFLICT"],
      [new LedgerIdempotencyMismatchError("mismatch"), "LEDGER_IDENTITY_CONFLICT"],
      [new InvalidLedgerAmountError("amount"), "INVALID_IMMUTABLE_INTENT"],
      [new InvalidLedgerCurrencyError("currency"), "INVALID_IMMUTABLE_INTENT"],
      [new InvalidLedgerEffectiveDateError("date"), "INVALID_IMMUTABLE_INTENT"],
      [new InvalidLedgerOperationKeyError("opKey"), "MANIFEST_LINKAGE_MISMATCH"],
      [new InvalidLedgerOperationMismatchError("opMismatch"), "MANIFEST_LINKAGE_MISMATCH"],
      [new InvalidLedgerFinalizationEffectIdError("effectId"), "MANIFEST_LINKAGE_MISMATCH"],
      [new InvalidLedgerTransactionIdError("txId"), "MANIFEST_LINKAGE_MISMATCH"],
      [new Error("Generic DB error"), "DATABASE_EXECUTION_FAILED"],
    ];

    for (const [errInstance, expectedCode] of mappings) {
      const mock = new MockPartnerTransactionClient();
      mock.simulateLedgerFailure = errInstance;
      let caught: PartnerCommissionExecutionError | null = null;
      try {
        await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
          transactionId: IDS.transaction,
          commissionEffectId: IDS.commissionEffect,
          liabilityEffectId: IDS.liabilityEffect,
          tx: mock.asTransactionClient(),
        });
      } catch (err) {
        if (err instanceof PartnerCommissionExecutionError) caught = err;
      }
      check(caught !== null && caught.code === expectedCode, `mapped ${errInstance.name} to ${expectedCode}`);
      if (expectedCode === "DATABASE_EXECUTION_FAILED") {
        check(
          caught?.message ===
            "Database execution failed during partner liability ledger execution.",
          "unknown child ledger message is replaced by the generic public message"
        );
        check(
          !caught?.message.includes("Generic DB error"),
          "unknown child ledger details do not leak"
        );
      }
    }
  });

  // Group 19: PartnerCommission P2002 normalization & zero SQL after abort
  await group("recognized PartnerCommission P2002 normalizes to CONCURRENT_IDENTITY_CONFLICT and stops SQL", async () => {
    const mock = new MockPartnerTransactionClient();
    mock.simulateP2002Target = ["transactionId"];
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "CONCURRENT_IDENTITY_CONFLICT", "caught CONCURRENT_IDENTITY_CONFLICT");
    check(mock.postAbortCallCount === 0, "zero additional SQL executed in aborted transaction");
  });

  // Group 20: Advisory lock hierarchy and order
  await group("advisory lock hierarchy is strictly transactionId -> effect locks -> partner-finance -> ledger locks", async () => {
    const mock = new MockPartnerTransactionClient();
    await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
      transactionId: IDS.transaction,
      commissionEffectId: IDS.commissionEffect,
      liabilityEffectId: IDS.liabilityEffect,
      tx: mock.asTransactionClient(),
    });

    const locks = mock.advisoryLocks;
    check(locks[0] === IDS.transaction, "level 1 lock is raw transactionId");
    check(locks[1].startsWith("partner-commission:effect:") || locks[1].startsWith("partner-liability:effect:"), "level 2 lock is effect lock");
    check(locks[3] === `partner-finance:${IDS.partner}`, "level 3 lock is partner-finance");
    check(locks[4] === `ledger:operation:pfin:${IDS.transaction}:partner-liability`, "level 4 lock is ledger operation");
    check(locks[5] === `ledger:effect:${IDS.liabilityEffect}`, "level 5 lock is ledger effect");
  });

  // Group 21: Linkage and pair mismatches fail closed
  await group("linkage and pair mismatches fail closed", async () => {
    // Transaction ID mismatch
    const mockTxMismatch = new MockPartnerTransactionClient();
    let caughtTx: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: "wrong_tx",
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mockTxMismatch.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caughtTx = err;
    }
    check(caughtTx !== null && caughtTx.code === "TRANSACTION_IDENTITY_MISMATCH", "caught TRANSACTION_IDENTITY_MISMATCH");

    // Partner ID mismatch between commission and liability
    const diffPartnerComm = activeCommIntent({ partnerId: "partner_A" });
    const diffPartnerLiab = activeLiabIntent({ partnerId: "partner_B" });
    const mockPartnerMismatch = new MockPartnerTransactionClient({
      commIntent: diffPartnerComm,
      liabIntent: diffPartnerLiab,
    });
    mockPartnerMismatch.commEffect.partnerId = "partner_A";
    mockPartnerMismatch.liabEffect.partnerId = "partner_B";
    let caughtPartner: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mockPartnerMismatch.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caughtPartner = err;
    }
    check(caughtPartner !== null && caughtPartner.code === "PAIR_IDENTITY_MISMATCH", "caught PAIR_IDENTITY_MISMATCH");
  });

  // Group 22: Unsupported intent version
  await group("unsupported intent version throws UNSUPPORTED_INTENT_VERSION", async () => {
    const v2Comm = activeCommIntent({ intentVersion: 2 });
    const mock = new MockPartnerTransactionClient({ commIntent: v2Comm });
    mock.commEffect.intentVersion = 2;
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "UNSUPPORTED_INTENT_VERSION", "caught UNSUPPORTED_INTENT_VERSION");
  });

  // Group 23: Wrong effect type
  await group("wrong effect type throws WRONG_EFFECT_TYPE", async () => {
    const wrongComm = activeCommIntent({ effectType: "REFERRAL_REWARD" as unknown as "PARTNER_COMMISSION" });
    const mock = new MockPartnerTransactionClient({ commIntent: wrongComm });
    mock.commEffect.effectType = "REFERRAL_REWARD";
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "WRONG_EFFECT_TYPE", "caught WRONG_EFFECT_TYPE");
  });

  // Group 24: Corrupted intent hash
  await group("corrupted intent hash throws INTENT_HASH_MISMATCH", async () => {
    const mock = new MockPartnerTransactionClient();
    mock.commEffect.intentHash = "b".repeat(64);
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "INTENT_HASH_MISMATCH", "caught INTENT_HASH_MISMATCH");
  });

  // Group 25: Canonical operation key mismatch
  await group("canonical operation key mismatch throws MANIFEST_LINKAGE_MISMATCH", async () => {
    const mock = new MockPartnerTransactionClient();
    mock.commEffect.operationKey = "pfin:other_tx:partner-commission";
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "MANIFEST_LINKAGE_MISMATCH", "caught MANIFEST_LINKAGE_MISMATCH on opKey");
  });

  // Group 26: PENDING amount mismatch between commission and liability
  await group("pending amount mismatch between commission and liability throws PAIR_STATE_MISMATCH", async () => {
    const comm = activeCommIntent({ commissionAmountCentavos: 5_980 });
    const liab = activeLiabIntent({ amountCentavos: 7_000 });
    const mock = new MockPartnerTransactionClient({ commIntent: comm, liabIntent: liab });
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "PAIR_STATE_MISMATCH", "caught PAIR_STATE_MISMATCH on amount mismatch");
  });

  // Group 27: Transaction.amount remains non-authoritative
  await group("customer-payment base matches finalization while Transaction.amount drift is ignored", async () => {
    const mock = new MockPartnerTransactionClient();
    mock.commEffect.finalization.transaction.amount = 999;
    mock.liabEffect.finalization.transaction.amount = 999;
    const result = await executeWithMock(mock);
    check(result.outcome === "CREATED", "outcome is CREATED");
    if (result.outcome === "CREATED") {
      check(
        result.commission.purchaseAmountCentavos === 29_900,
        "commission purchaseAmount remains tied to finalization purchaseAmountCentavos"
      );
    }
  });

  // Group 28: Immutable commission economic mismatch on replay
  await group("immutable commission economic mismatch on replay throws PARTNER_COMMISSION_IDENTITY_CONFLICT", async () => {
    const existing = makeCommission({ commissionAmountCentavos: 1_234 }); // Intent requires 5980
    const ledger = makeLedgerPair(existing.id, 1_234);
    const mock = new MockPartnerTransactionClient({ commissions: [existing], ledgerEntries: ledger });
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "PARTNER_COMMISSION_IDENTITY_CONFLICT", "caught PARTNER_COMMISSION_IDENTITY_CONFLICT on replay mismatch");
  });

  // Group 29: Unrelated P2002 normalization
  await group("unrelated P2002 normalizes to DATABASE_EXECUTION_FAILED", async () => {
    const mock = new MockPartnerTransactionClient();
    mock.simulateP2002Target = ["some_unrelated_column"];
    let caught: PartnerCommissionExecutionError | null = null;
    try {
      await IdempotentPartnerCommissionService.executePartnerCommissionAndLiability({
        transactionId: IDS.transaction,
        commissionEffectId: IDS.commissionEffect,
        liabilityEffectId: IDS.liabilityEffect,
        tx: mock.asTransactionClient(),
      });
    } catch (err) {
      if (err instanceof PartnerCommissionExecutionError) caught = err;
    }
    check(caught !== null && caught.code === "DATABASE_EXECUTION_FAILED", "caught DATABASE_EXECUTION_FAILED for unrelated P2002");
  });

  // Group 30: Static code inspection (zero any types, zero email/provider imports, dormancy)
  await group("static invariants hold: zero any types, zero emails, zero production callers", async () => {
    const servicePath = path.resolve(
      process.cwd(),
      "src/lib/accounting/idempotentPartnerCommissionService.ts"
    );
    const testPath = path.resolve(
      process.cwd(),
      "src/scripts/test-idempotent-partner-commission.ts"
    );

    const serviceCode = fs.readFileSync(servicePath, "utf8");
    const testCode = fs.readFileSync(testPath, "utf8");

    const dynamicAnyRegex = new RegExp(":\\s*a" + "ny\\b|as\\s+a" + "ny\\b|<a" + "ny>|\\ba" + "ny\\[\\]");
    check(!dynamicAnyRegex.test(serviceCode), "zero any types in idempotentPartnerCommissionService.ts");
    check(!dynamicAnyRegex.test(testCode), "zero any types in test-idempotent-partner-commission.ts");

    check(!serviceCode.includes("sendPartnerCommissionAlertEmail"), "zero email calls in service");
    check(!serviceCode.includes("nodemailer"), "zero mailer imports in service");
    check(!serviceCode.includes("qualifyPartnerPayment"), "zero qualifyPartnerPayment calls in service");

    const taxProvisionTestPath = path.resolve(
      process.cwd(),
      "src/scripts/test-idempotent-tax-provision.ts"
    );
    const reconciliationTestPath = path.resolve(
      process.cwd(),
      "src/scripts/test-idempotent-reconciliation.ts"
    );
    const excludedPaths = new Set([
      servicePath,
      testPath,
      taxProvisionTestPath,
      reconciliationTestPath,
    ]);
    const unexpectedConsumers = listSourceFiles(path.resolve(process.cwd(), "src"))
      .filter((sourcePath) => !excludedPaths.has(sourcePath))
      .filter((sourcePath) => {
        const source = fs.readFileSync(sourcePath, "utf8");
        return (
          source.includes("IdempotentPartnerCommissionService") ||
          source.includes("idempotentPartnerCommissionService")
        );
      });
    check(
      unexpectedConsumers.length === 0,
      `zero production callers/imports; unexpected consumers: ${unexpectedConsumers.join(", ")}`
    );
  });

  // Group 31: Public transactionId boundary
  await group("public transactionId validation is exact, canonical, and closed", async () => {
    const whitespaceMock = new MockPartnerTransactionClient();
    const whitespaceError = await captureExecutionError(whitespaceMock, {
      transactionId: ` ${IDS.transaction}`,
    });
    check(
      whitespaceError?.code === "TRANSACTION_IDENTITY_MISMATCH",
      "whitespace transactionId maps to TRANSACTION_IDENTITY_MISMATCH"
    );
    check(whitespaceMock.rawCalls.length === 0, "whitespace transactionId executes no SQL");

    const malformedMock = new MockPartnerTransactionClient();
    const malformedError = await captureExecutionError(malformedMock, {
      transactionId: "txn:malformed",
    });
    check(
      malformedError?.code === "TRANSACTION_IDENTITY_MISMATCH",
      "malformed transactionId maps to TRANSACTION_IDENTITY_MISMATCH"
    );
    check(malformedMock.rawCalls.length === 0, "malformed transactionId executes no SQL");

    const exactResult = await executeWithMock(new MockPartnerTransactionClient());
    check(exactResult.outcome === "CREATED", "valid exact transactionId is accepted");
  });

  // Group 32: Customer-payment base authority
  await group("customer-payment base is bound to finalization purchase amount while gross remains independent", async () => {
    const driftMock = new MockPartnerTransactionClient();
    mutateBothFinalizations(driftMock, (finalization) => {
      finalization.purchaseAmountCentavos = 49_900;
    });
    const driftError = await captureExecutionError(driftMock);
    check(
      driftError?.code === "INVALID_IMMUTABLE_INTENT",
      "customer-payment base drift from finalization is rejected"
    );

    const grossComm = activeCommIntent({
      commissionModel: "PERCENTAGE_OF_GROSS",
      calculationBasis: "GROSS_PRICE",
      baseAmountCentavos: 50_000,
      commissionRateBasisPoints: 1_000,
      commissionAmountCentavos: 5_000,
    });
    const grossMock = new MockPartnerTransactionClient({
      commIntent: grossComm,
      liabIntent: activeLiabIntent({ amountCentavos: 5_000 }),
    });
    mutateBothFinalizations(grossMock, (finalization) => {
      finalization.purchaseAmountCentavos = 1;
    });
    const grossResult = await executeWithMock(grossMock);
    check(
      grossResult.outcome === "CREATED",
      "percentage-of-gross base remains independent from purchaseAmountCentavos"
    );
  });

  // Group 33: Parent manifest metadata
  await group("parent manifest metadata requires canonical current v1 structure", async () => {
    const validResult = await executeWithMock(new MockPartnerTransactionClient());
    check(validResult.outcome === "CREATED", "valid v1/revision1/lowercase hash metadata passes");

    const mutations: Array<{
      readonly name: string;
      readonly mutate: (finalization: PaymentFinalization) => void;
    }> = [
      {
        name: "unsupported manifestVersion",
        mutate: (finalization) => {
          finalization.manifestVersion = 2;
        },
      },
      {
        name: "unsupported manifestRevision",
        mutate: (finalization) => {
          finalization.manifestRevision = 2;
        },
      },
      {
        name: "malformed manifestHash",
        mutate: (finalization) => {
          finalization.manifestHash = "A".repeat(64);
        },
      },
    ];

    for (const mutation of mutations) {
      const mock = new MockPartnerTransactionClient();
      mutateBothFinalizations(mock, mutation.mutate);
      const error = await captureExecutionError(mock);
      check(
        error?.code === "MANIFEST_LINKAGE_MISMATCH",
        `${mutation.name} maps to MANIFEST_LINKAGE_MISMATCH`
      );
    }
  });

  // Group 34: Unknown database error confidentiality
  await group("unknown provider/database details are replaced by a generic public error", async () => {
    const secretText = "postgres://admin:secret@example.internal raw SQL SELECT private";
    const mock = new MockPartnerTransactionClient();
    mock.simulateRawFailure = new Error(secretText);
    const error = await captureExecutionError(mock);
    check(error?.code === "DATABASE_EXECUTION_FAILED", "unknown provider failure maps to DATABASE_EXECUTION_FAILED");
    check(
      error?.message ===
        "Database execution failed during partner commission execution.",
      "unknown provider failure uses the generic public message"
    );
    check(!error?.message.includes(secretText), "provider/internal secret-looking text is not exposed");
    check(mock.postAbortCallCount === 0, "no SQL is attempted after the synthetic provider abort");
  });

  // Group 35: Caller-owned transaction contract
  await group("caller-owned transaction is used directly and failures propagate without post-abort SQL", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
    let nestedTransactionCalls = 0;
    Object.defineProperty(prisma, "$transaction", {
      configurable: true,
      value: () => {
        nestedTransactionCalls++;
        throw new Error("Nested transaction must not be opened.");
      },
      writable: true,
    });

    const mock = new MockPartnerTransactionClient();
    mock.simulateP2002Target = ["transactionId"];
    let error: PartnerCommissionExecutionError | null = null;
    try {
      error = await captureExecutionError(mock);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(prisma, "$transaction", originalDescriptor);
      } else {
        Reflect.deleteProperty(prisma, "$transaction");
      }
    }

    check(nestedTransactionCalls === 0, "caller tx does not invoke prisma.$transaction");
    check(
      error?.code === "CONCURRENT_IDENTITY_CONFLICT",
      "caller-owned transaction failure propagates through the closed contract"
    );
    check(mock.postAbortCallCount === 0, "caller-owned aborted transaction receives no post-error SQL");
  });

  // Group 36: Liability ledger identity and replay payload
  await group("liability ledger malformed identity and exact replay payload mismatch fail closed", async () => {
    const commission = makeCommission();
    const malformedPair = makeLedgerPair(commission.id);
    malformedPair[1].finalizationEffectId = "other_liability_effect";
    const malformedMock = new MockPartnerTransactionClient({
      commissions: [commission],
      ledgerEntries: malformedPair,
    });
    const malformedError = await captureExecutionError(malformedMock);
    check(
      malformedError?.code === "LEDGER_IDENTITY_CONFLICT",
      "malformed liability ledger identity pair is rejected"
    );

    const mismatchedPayload = makeLedgerPair(commission.id, 1_234);
    const mismatchMock = new MockPartnerTransactionClient({
      commissions: [commission],
      ledgerEntries: mismatchedPayload,
    });
    const mismatchError = await captureExecutionError(mismatchMock);
    check(
      mismatchError?.code === "LEDGER_IDENTITY_CONFLICT",
      "exact ledger identity with replay payload mismatch is rejected"
    );
  });

  // Group 37: Partner and holding authority
  await group("active execution requires Partner existence and exact safe holding timestamp", async () => {
    const missingPartnerError = await captureExecutionError(
      new MockPartnerTransactionClient({ partner: null })
    );
    check(missingPartnerError?.code === "PARTNER_NOT_FOUND", "missing Partner row is rejected");

    const holdingMismatchMock = new MockPartnerTransactionClient({
      commIntent: activeCommIntent({
        holdingUntil: "2026-09-08T10:00:00.000Z",
      }),
    });
    const holdingMismatchError = await captureExecutionError(holdingMismatchMock);
    check(
      holdingMismatchError?.code === "INVALID_IMMUTABLE_INTENT",
      "holdingUntil mismatch is rejected"
    );

    const overflowMock = new MockPartnerTransactionClient({
      commIntent: activeCommIntent({ holdingPeriodDays: Number.MAX_SAFE_INTEGER }),
    });
    const overflowError = await captureExecutionError(overflowMock);
    check(
      overflowError?.code === "INVALID_IMMUTABLE_INTENT",
      "holding timestamp overflow is rejected"
    );
  });

  // Group 38: PartnerCommission replay payload
  await group("commission replay rejects campaign, effective-rate, and purchase-amount drift", async () => {
    const variants: Array<{
      readonly name: string;
      readonly commission: PartnerCommission;
    }> = [
      {
        name: "campaignSource",
        commission: makeCommission({ campaignSource: "drifted-campaign" }),
      },
      {
        name: "effectiveRate",
        commission: makeCommission({ effectiveRate: 19.5 }),
      },
      {
        name: "purchaseAmountCentavos",
        commission: makeCommission({ purchaseAmountCentavos: 29_901 }),
      },
    ];

    for (const variant of variants) {
      const mock = new MockPartnerTransactionClient({
        commissions: [variant.commission],
        ledgerEntries: makeLedgerPair(variant.commission.id),
      });
      const error = await captureExecutionError(mock);
      check(
        error?.code === "PARTNER_COMMISSION_IDENTITY_CONFLICT",
        `${variant.name} replay mismatch is rejected`
      );
    }
  });

  // Group 39: Completed lifecycle replay-only semantics
  await group("COMPLETE finalization/effects allow exact replay but forbid fresh creation", async () => {
    const existing = makeCommission();

    const finalizationReplay = new MockPartnerTransactionClient({
      commissions: [existing],
      ledgerEntries: makeLedgerPair(existing.id),
    });
    mutateBothFinalizations(finalizationReplay, (finalization) => {
      finalization.status = "COMPLETE";
    });
    check(
      (await executeWithMock(finalizationReplay)).outcome === "REPLAY",
      "COMPLETE finalization allows exact replay"
    );

    const finalizationFresh = new MockPartnerTransactionClient();
    mutateBothFinalizations(finalizationFresh, (finalization) => {
      finalization.status = "COMPLETE";
    });
    check(
      (await captureExecutionError(finalizationFresh))?.code === "INVALID_LIFECYCLE",
      "COMPLETE finalization forbids fresh creation"
    );

    const effectReplay = new MockPartnerTransactionClient({
      commissions: [existing],
      ledgerEntries: makeLedgerPair(existing.id),
    });
    effectReplay.commEffect.status = "COMPLETE";
    effectReplay.liabEffect.status = "COMPLETE";
    check(
      (await executeWithMock(effectReplay)).outcome === "REPLAY",
      "COMPLETE effects allow exact replay"
    );

    const effectFresh = new MockPartnerTransactionClient();
    effectFresh.commEffect.status = "COMPLETE";
    effectFresh.liabEffect.status = "COMPLETE";
    check(
      (await captureExecutionError(effectFresh))?.code === "INVALID_LIFECYCLE",
      "COMPLETE effects forbid fresh creation"
    );
  });

  // Group 40: Non-executable lifecycle states
  await group("AWAITING_DATA, MANUAL_REVIEW, and NOT_APPLICABLE-with-PENDING-intent fail closed", async () => {
    for (const status of ["AWAITING_DATA", "MANUAL_REVIEW"] as const) {
      const mock = new MockPartnerTransactionClient();
      mock.commEffect.status = status;
      mock.liabEffect.status = status;
      const error = await captureExecutionError(mock);
      check(error?.code === "INVALID_LIFECYCLE", `${status} effects are rejected`);
    }

    const notApplicableMock = new MockPartnerTransactionClient();
    notApplicableMock.commEffect.status = "NOT_APPLICABLE";
    notApplicableMock.liabEffect.status = "NOT_APPLICABLE";
    const notApplicableError = await captureExecutionError(notApplicableMock);
    check(
      notApplicableError?.code === "INVALID_LIFECYCLE",
      "NOT_APPLICABLE effects with PENDING intents are rejected"
    );
  });

  // Group 41: Zero gross and exact intent shape
  await group("zero gross NOT_APPLICABLE is valid and arbitrary intent metadata remains rejected", async () => {
    const zeroGrossCommission = notApplicableCommIntent(
      "ZERO_COMMISSION_CALCULATED",
      {
        commissionModel: "PERCENTAGE_OF_GROSS",
        commissionRateBasisPoints: 0,
        calculationBasis: "GROSS_PRICE",
        baseAmountCentavos: 50_000,
        holdingPeriodDays: 7,
      }
    );
    const zeroGrossResult = await executeWithMock(
      new MockPartnerTransactionClient({
        commIntent: zeroGrossCommission,
        liabIntent: notApplicableLiabIntent(IDS.partner),
      })
    );
    check(
      zeroGrossResult.outcome === "NOT_APPLICABLE" &&
        zeroGrossResult.reason === "ZERO_COMMISSION_CALCULATED",
      "PERCENTAGE_OF_GROSS zero commission has the valid NOT_APPLICABLE shape"
    );

    const extraCommissionError = await captureExecutionError(
      new MockPartnerTransactionClient({
        commIntent: activeCommIntent({ arbitraryMetadata: "rejected" }),
      })
    );
    check(
      extraCommissionError?.code === "INVALID_IMMUTABLE_INTENT",
      "arbitrary commission intent metadata is rejected"
    );

    const extraLiabilityError = await captureExecutionError(
      new MockPartnerTransactionClient({
        liabIntent: activeLiabIntent({ arbitraryMetadata: "rejected" }),
      })
    );
    check(
      extraLiabilityError?.code === "INVALID_IMMUTABLE_INTENT",
      "arbitrary liability intent metadata is rejected"
    );
  });

  console.log("============================================================");
  console.log(
    `Slice 5 synthetic summary: ${passedGroups}/${totalGroups} groups passed; ${totalChecks} checks executed; ${failedGroups} groups failed.`
  );
  console.log(
    "LIMITATION: synthetic tests cannot prove real PostgreSQL advisory waiting, row locking, unique-race scheduling, transaction abort behavior, or deadlock freedom."
  );

  if (failedGroups > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
