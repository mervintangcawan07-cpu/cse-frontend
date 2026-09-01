// Relative Path: src/scripts/test-idempotent-tax-provision.ts
/**
 * Synthetic Test Suite: Atomic Idempotent Tax Provision Executor (P1-001 / Slice 6B)
 *
 * In-memory only. No database, provider, production route, or external service is
 * contacted. Real PostgreSQL scheduling and abort behavior require a separately
 * authorized disposable-database test.
 */

import fs from "node:fs";
import path from "node:path";
import {
  Prisma,
  type FinancialLedgerEntry,
  type PaymentFinalization,
  type PaymentFinalizationEffect,
  type TaxConfiguration,
  type TaxRecord,
  type Transaction,
} from "@prisma/client";
import {
  buildPaymentFinalizationOperationKey,
  canonicalizeJson,
  computeSha256Hash,
} from "../lib/payment/paymentFinalizationContracts";
import {
  IdempotentTaxProvisionService,
  TaxProvisionExecutionError,
  type ExecuteTaxProvisionEffectParams,
  type ExecuteTaxProvisionEffectResult,
  type TaxProvisionExecutionErrorCode,
} from "../lib/accounting/idempotentTaxProvisionService";
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
  finalization: PaymentFinalization & { transaction: Transaction };
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

const IDS = {
  transaction: "txn_tax_slice6b_001",
  effect: "effect_tax_slice6b_001",
  finalization: "finalization_tax_slice6b_001",
  taxConfig: "tax_vat_slice6b_001",
  user: "user_tax_slice6b_001",
  checkout: "checkout_tax_slice6b_001",
} as const;

const VERIFIED_AT = "2026-09-01T01:00:00.000Z";
const TAX_OPERATION_KEY = buildPaymentFinalizationOperationKey(
  IDS.transaction,
  { kind: "TAX", taxConfigId: IDS.taxConfig }
);
const TAX_NONE_OPERATION_KEY = buildPaymentFinalizationOperationKey(
  IDS.transaction,
  { kind: "TAX_NONE" }
);

function fixedDate(value: string): Date {
  return new Date(value);
}

function percentageIntent(
  overrides: Record<string, Prisma.JsonValue> = {}
): Prisma.JsonObject {
  return {
    effectType: "TAX_PROVISION",
    intentVersion: 1,
    status: "PENDING",
    taxConfigId: IDS.taxConfig,
    taxName: "VAT 12%",
    taxType: "VAT",
    calculationBasis: "CUSTOMER_PAYMENT",
    taxableAmountCentavos: 29_900,
    taxRateBasisPoints: 1_200,
    taxAmountCentavos: 3_588,
    debitCategory: "EXPENSE_TAX",
    creditCategory: "LIABILITY_TAX_PAYABLE",
    ...overrides,
  };
}

function fixedIntent(
  overrides: Record<string, Prisma.JsonValue> = {}
): Prisma.JsonObject {
  return percentageIntent({
    taxName: "Fixed tax",
    taxType: "OTHER_TAX",
    taxRateBasisPoints: null,
    taxAmountCentavos: 123,
    ...overrides,
  });
}

function noActiveIntent(
  overrides: Record<string, Prisma.JsonValue> = {}
): Prisma.JsonObject {
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
    ...overrides,
  };
}

function zeroTaxIntent(
  rate: number | null,
  overrides: Record<string, Prisma.JsonValue> = {}
): Prisma.JsonObject {
  return {
    effectType: "TAX_PROVISION",
    intentVersion: 1,
    status: "NOT_APPLICABLE",
    notApplicableReason: "ZERO_TAX_CALCULATED",
    taxConfigId: IDS.taxConfig,
    taxName: rate === null ? "Fixed zero tax" : "Rounded zero tax",
    taxType: "OTHER_TAX",
    calculationBasis: "CUSTOMER_PAYMENT",
    taxableAmountCentavos: rate === null ? 29_900 : 1,
    taxRateBasisPoints: rate,
    taxAmountCentavos: 0,
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
    paymentIntentId: "pay_tax_slice6b_001",
    amount: 299,
    grossAmountCentavos: 39_900,
    discountAmountCentavos: 10_000,
    feeAmountCentavos: 0,
    netSettlementCentavos: 29_900,
    planType: "1_MONTH",
    status: "PAID",
    receiptUrl: null,
    createdAt: fixedDate("2026-09-01T00:59:00.000Z"),
    updatedAt: fixedDate(VERIFIED_AT),
  };
}

function makeFinalization(transaction: Transaction): PaymentFinalization {
  return {
    id: IDS.finalization,
    transactionId: IDS.transaction,
    checkoutSessionId: IDS.checkout,
    providerPaymentId: "pay_tax_slice6b_001",
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
    leaseOwner: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    manualReviewReasonCode: null,
    completedAt: null,
    createdAt: fixedDate(VERIFIED_AT),
    updatedAt: fixedDate(VERIFIED_AT),
  };
}

function makeEffect(
  intent: Prisma.JsonObject = percentageIntent(),
  overrides: Partial<PaymentFinalizationEffect> = {}
): LoadedEffect {
  const transaction = makeTransaction();
  const finalization = makeFinalization(transaction);
  const taxConfigId =
    typeof intent.taxConfigId === "string" ? intent.taxConfigId : null;
  const operationKey =
    taxConfigId === null
      ? TAX_NONE_OPERATION_KEY
      : buildPaymentFinalizationOperationKey(IDS.transaction, {
          kind: "TAX",
          taxConfigId,
        });
  return {
    id: IDS.effect,
    finalizationId: IDS.finalization,
    effectType: "TAX_PROVISION",
    effectKey: taxConfigId === null ? "tax:none" : `tax:${taxConfigId}`,
    operationKey,
    status:
      intent.status === "NOT_APPLICABLE" ? "NOT_APPLICABLE" : "PENDING",
    intentVersion: 1,
    intent,
    intentHash: computeSha256Hash(canonicalizeJson(intent)),
    referralId: null,
    partnerId: null,
    taxConfigId,
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

function makeTaxConfig(overrides: Partial<TaxConfiguration> = {}): TaxConfiguration {
  return {
    id: IDS.taxConfig,
    name: "Mutable current config name",
    taxType: "VAT",
    rate: 99.99,
    fixedAmountCentavos: 999_999,
    calculationBasis: "OTHER",
    status: "ARCHIVED",
    effectiveDate: fixedDate("2030-01-01T00:00:00.000Z"),
    expirationDate: fixedDate("2030-02-01T00:00:00.000Z"),
    applicableTransactionType: "MUTATED",
    notes: "Current economics are deliberately unrelated to the intent.",
    createdBy: null,
    createdAt: fixedDate("2026-01-01T00:00:00.000Z"),
    updatedAt: fixedDate("2030-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeTaxRecord(overrides: Partial<TaxRecord> = {}): TaxRecord {
  return {
    id: "tax_record_slice6b_001",
    taxConfigId: IDS.taxConfig,
    transactionId: IDS.transaction,
    partnerPayoutId: null,
    referralPayoutId: null,
    finalizationEffectId: IDS.effect,
    taxableAmountCentavos: 29_900,
    appliedRate: 12,
    taxAmountCentavos: 3_588,
    calculationBasis: "CUSTOMER_PAYMENT",
    status: "PROVISIONED",
    effectiveDate: fixedDate(VERIFIED_AT),
    createdAt: fixedDate(VERIFIED_AT),
    ...overrides,
  };
}

function makeLedgerPair(
  sourceId: string = "tax_record_slice6b_001",
  overrides: Partial<FinancialLedgerEntry> = {}
): [FinancialLedgerEntry, FinancialLedgerEntry] {
  const baseDescription = `Tax provision for transaction ${IDS.transaction} and tax configuration ${IDS.taxConfig}`;
  const common = {
    transactionId: IDS.transaction,
    transactionType: "TAX_PROVISION" as const,
    amountCentavos: 3_588,
    currency: "PHP",
    sourceEntity: "TaxRecord",
    sourceId,
    operationKey: TAX_OPERATION_KEY,
    finalizationEffectId: IDS.effect,
    effectiveDate: fixedDate(VERIFIED_AT),
    periodId: null,
    createdBy: null,
    createdAt: fixedDate(VERIFIED_AT),
  };
  return [
    {
      id: "tax_ledger_debit_slice6b_001",
      entryNumber: "DR-TAX-001",
      ...common,
      accountCategory: "EXPENSE_TAX",
      entryType: "DEBIT",
      description: `${baseDescription} (DR)`,
      ...overrides,
    },
    {
      id: "tax_ledger_credit_slice6b_001",
      entryNumber: "CR-TAX-001",
      ...common,
      accountCategory: "LIABILITY_TAX_PAYABLE",
      entryType: "CREDIT",
      description: `${baseDescription} (CR)`,
      ...overrides,
    },
  ];
}

class MockTaxTransactionClient {
  public effect: LoadedEffect;
  public configs: TaxConfiguration[];
  public taxRecords: TaxRecord[];
  public ledgerEntries: FinancialLedgerEntry[];
  public rawCalls: MockRawCall[] = [];
  public advisoryLocks: string[] = [];
  public effectRowLocks: string[] = [];
  public taxRecordRowLocks: string[] = [];
  public configSelects: Array<Record<string, boolean>> = [];
  public readCallCount = 0;
  public writeCallCount = 0;
  public postAbortCallCount = 0;
  public effectLoadCount = 0;
  public simulateMissingEffect = false;
  public simulateTaxP2002Target: unknown = null;
  public simulateLedgerFailure: unknown = null;
  public simulateRawFailure: unknown = null;
  public beforeAuthoritativeLoad: (() => void) | null = null;
  private aborted = false;
  private nextTaxId = 10;
  private nextLedgerId = 10;

  constructor(options?: {
    readonly intent?: Prisma.JsonObject;
    readonly config?: TaxConfiguration | null;
    readonly taxRecords?: readonly TaxRecord[];
    readonly ledgerEntries?: readonly FinancialLedgerEntry[];
  }) {
    this.effect = makeEffect(options?.intent ?? percentageIntent());
    this.configs =
      options?.config === null ? [] : [options?.config ?? makeTaxConfig()];
    this.taxRecords = options?.taxRecords
      ? structuredClone([...options.taxRecords])
      : [];
    this.ledgerEntries = options?.ledgerEntries
      ? structuredClone([...options.ledgerEntries])
      : [];
  }

  public asTransactionClient(): Prisma.TransactionClient {
    return this as unknown as Prisma.TransactionClient;
  }

  public snapshot(): {
    readonly taxRecords: TaxRecord[];
    readonly ledgerEntries: FinancialLedgerEntry[];
  } {
    return {
      taxRecords: structuredClone(this.taxRecords),
      ledgerEntries: structuredClone(this.ledgerEntries),
    };
  }

  public restore(snapshot: {
    readonly taxRecords: TaxRecord[];
    readonly ledgerEntries: FinancialLedgerEntry[];
  }): void {
    this.taxRecords = snapshot.taxRecords;
    this.ledgerEntries = snapshot.ledgerEntries;
  }

  private beforeCall(write: boolean): void {
    if (this.aborted) {
      this.postAbortCallCount++;
      throw new Error("Synthetic transaction used after abort.");
    }
    if (write) this.writeCallCount++;
    else this.readCallCount++;
  }

  private abortWith(error: unknown): never {
    this.aborted = true;
    throw error;
  }

  public async $queryRaw(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown> {
    this.beforeCall(false);
    if (this.simulateRawFailure) this.abortWith(this.simulateRawFailure);
    let rendered = strings[0];
    for (let index = 0; index < values.length; index++) {
      rendered += String(values[index]) + strings[index + 1];
    }
    rendered = rendered.replace(/\s+/g, " ").trim();
    this.rawCalls.push({ query: rendered, values });
    if (rendered.includes("pg_advisory_xact_lock")) {
      this.advisoryLocks.push(String(values[0]));
      return [{ lock_result: "" }];
    }
    if (rendered.includes('FROM "PaymentFinalizationEffect"')) {
      this.effectRowLocks.push(String(values[0]));
      return [{ id: String(values[0]) }];
    }
    if (rendered.includes('FROM "TaxRecord"')) {
      this.taxRecordRowLocks.push(String(values[0]));
      return [{ id: String(values[0]) }];
    }
    return [];
  }

  public readonly paymentFinalizationEffect = {
    findUnique: async (args: { where: { id: string } }) => {
      this.beforeCall(false);
      this.effectLoadCount++;
      if (this.effectLoadCount === 2 && this.beforeAuthoritativeLoad) {
        this.beforeAuthoritativeLoad();
      }
      if (this.simulateMissingEffect || args.where.id !== this.effect.id) {
        return null;
      }
      return this.effect;
    },
  };

  public readonly taxConfiguration = {
    findUnique: async (args: {
      where: { id: string };
      select: Record<string, boolean>;
    }) => {
      this.beforeCall(false);
      this.configSelects.push(args.select);
      const found = this.configs.find((config) => config.id === args.where.id);
      return found ? { id: found.id } : null;
    },
  };

  public readonly taxRecord = {
    findUnique: async (args: { where: { finalizationEffectId: string } }) => {
      this.beforeCall(false);
      return (
        this.taxRecords.find(
          (record) =>
            record.finalizationEffectId === args.where.finalizationEffectId
        ) ?? null
      );
    },
    findMany: async (args: {
      where: { transactionId: string; taxConfigId: string };
      orderBy: { id: "asc" };
    }) => {
      this.beforeCall(false);
      return this.taxRecords
        .filter(
          (record) =>
            record.transactionId === args.where.transactionId &&
            record.taxConfigId === args.where.taxConfigId
        )
        .sort((left, right) => left.id.localeCompare(right.id));
    },
    create: async (args: { data: Prisma.TaxRecordUncheckedCreateInput }) => {
      this.beforeCall(true);
      if (this.simulateTaxP2002Target !== null) {
        this.abortWith({
          code: "P2002",
          meta: { target: this.simulateTaxP2002Target },
        });
      }
      const data = args.data;
      const record: TaxRecord = {
        id: `tax_record_mock_${this.nextTaxId++}`,
        taxConfigId: data.taxConfigId,
        transactionId: data.transactionId ?? null,
        partnerPayoutId: data.partnerPayoutId ?? null,
        referralPayoutId: data.referralPayoutId ?? null,
        finalizationEffectId: data.finalizationEffectId ?? null,
        taxableAmountCentavos: data.taxableAmountCentavos,
        appliedRate: data.appliedRate,
        taxAmountCentavos: data.taxAmountCentavos,
        calculationBasis: data.calculationBasis,
        status: data.status ?? "PROVISIONED",
        effectiveDate:
          data.effectiveDate instanceof Date
            ? data.effectiveDate
            : fixedDate(String(data.effectiveDate)),
        createdAt: fixedDate(VERIFIED_AT),
      };
      this.taxRecords.push(record);
      return record;
    },
  };

  public readonly financialLedgerEntry = {
    findMany: async (args: {
      where: { operationKey?: string; finalizationEffectId?: string };
      orderBy: { entryType: "asc" };
    }) => {
      this.beforeCall(false);
      if (args.where.operationKey) {
        return this.ledgerEntries.filter(
          (entry) => entry.operationKey === args.where.operationKey
        );
      }
      if (args.where.finalizationEffectId) {
        return this.ledgerEntries.filter(
          (entry) =>
            entry.finalizationEffectId === args.where.finalizationEffectId
        );
      }
      return [];
    },
    createManyAndReturn: async (args: {
      data: Prisma.FinancialLedgerEntryCreateManyInput[];
    }) => {
      this.beforeCall(true);
      if (this.simulateLedgerFailure !== null) {
        this.abortWith(this.simulateLedgerFailure);
      }
      const created = args.data.map((data) => {
        const entry: FinancialLedgerEntry = {
          id: `tax_ledger_mock_${this.nextLedgerId++}`,
          entryNumber: data.entryNumber,
          transactionId: data.transactionId ?? null,
          transactionType: data.transactionType,
          accountCategory: data.accountCategory,
          entryType: data.entryType,
          amountCentavos: data.amountCentavos,
          currency: data.currency ?? "PHP",
          sourceEntity: data.sourceEntity,
          sourceId: data.sourceId,
          operationKey: data.operationKey ?? null,
          finalizationEffectId: data.finalizationEffectId ?? null,
          description: data.description,
          effectiveDate:
            data.effectiveDate instanceof Date
              ? data.effectiveDate
              : fixedDate(String(data.effectiveDate)),
          periodId: data.periodId ?? null,
          createdBy: data.createdBy ?? null,
          createdAt: fixedDate(VERIFIED_AT),
        };
        this.ledgerEntries.push(entry);
        return entry;
      });
      return created;
    },
  };
}

async function executeWithMock(
  mock: MockTaxTransactionClient,
  overrides: Partial<Omit<ExecuteTaxProvisionEffectParams, "tx">> = {}
): Promise<ExecuteTaxProvisionEffectResult> {
  return IdempotentTaxProvisionService.executeTaxProvisionEffect({
    transactionId: IDS.transaction,
    taxEffectId: IDS.effect,
    ...overrides,
    tx: mock.asTransactionClient(),
  });
}

async function captureError(
  mock: MockTaxTransactionClient,
  overrides: Partial<Omit<ExecuteTaxProvisionEffectParams, "tx">> = {}
): Promise<TaxProvisionExecutionError | null> {
  try {
    await executeWithMock(mock, overrides);
    return null;
  } catch (error: unknown) {
    return error instanceof TaxProvisionExecutionError ? error : null;
  }
}

function replaceIntent(
  mock: MockTaxTransactionClient,
  intent: Prisma.JsonObject
): void {
  mock.effect.intent = intent;
  mock.effect.intentHash = computeSha256Hash(canonicalizeJson(intent));
  mock.effect.taxConfigId =
    typeof intent.taxConfigId === "string" ? intent.taxConfigId : null;
}

function lifecycleSnapshot(mock: MockTaxTransactionClient): string {
  const effect = mock.effect;
  const finalization = effect.finalization;
  return JSON.stringify({
    effect: {
      status: effect.status,
      attemptCount: effect.attemptCount,
      lastAttemptAt: effect.lastAttemptAt,
      nextAttemptAt: effect.nextAttemptAt,
      lastErrorCode: effect.lastErrorCode,
      lastErrorMessage: effect.lastErrorMessage,
      manualReviewReasonCode: effect.manualReviewReasonCode,
      completedAt: effect.completedAt,
    },
    finalization: {
      status: finalization.status,
      attemptCount: finalization.attemptCount,
      lastAttemptAt: finalization.lastAttemptAt,
      nextAttemptAt: finalization.nextAttemptAt,
      leaseOwner: finalization.leaseOwner,
      leaseExpiresAt: finalization.leaseExpiresAt,
      lastErrorCode: finalization.lastErrorCode,
      lastErrorMessage: finalization.lastErrorMessage,
      manualReviewReasonCode: finalization.manualReviewReasonCode,
      completedAt: finalization.completedAt,
    },
  });
}

function listFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(resolved));
    else if (entry.isFile()) files.push(resolved);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function runSuite(): Promise<void> {
  console.log("============================================================");
  console.log("SYNTHETIC SLICE 6B ATOMIC TAX PROVISION SUITE");
  console.log("============================================================");

  await group("1 effect missing", async () => {
    const mock = new MockTaxTransactionClient();
    mock.simulateMissingEffect = true;
    check((await captureError(mock))?.code === "EFFECT_NOT_FOUND", "missing effect rejected");
  });

  await group("2 transaction identity validation", async () => {
    for (const transactionId of [` ${IDS.transaction}`, "txn:invalid", ""]) {
      const mock = new MockTaxTransactionClient();
      check(
        (await captureError(mock, { transactionId }))?.code ===
          "TRANSACTION_IDENTITY_MISMATCH",
        `invalid transaction ${JSON.stringify(transactionId)} rejected`
      );
      check(mock.rawCalls.length === 0, "invalid transaction executes no SQL");
    }
    const mismatch = new MockTaxTransactionClient();
    mismatch.effect.finalization.transactionId = "txn_other";
    check(
      (await captureError(mismatch))?.code === "TRANSACTION_IDENTITY_MISMATCH",
      "parent transaction mismatch rejected"
    );
  });

  await group("3 wrong effect type", async () => {
    const mock = new MockTaxTransactionClient();
    mock.effect.effectType = "REFERRAL_REWARD";
    check((await captureError(mock))?.code === "WRONG_EFFECT_TYPE", "wrong effect type rejected");
  });

  await group("4 unsupported version", async () => {
    const mock = new MockTaxTransactionClient();
    mock.effect.intentVersion = 2;
    check(
      (await captureError(mock))?.code === "UNSUPPORTED_INTENT_VERSION",
      "unsupported effect intent version rejected"
    );
  });

  await group("5 malformed hash", async () => {
    const mock = new MockTaxTransactionClient();
    mock.effect.intentHash = "A".repeat(64);
    check((await captureError(mock))?.code === "INTENT_HASH_MISMATCH", "uppercase hash rejected");
  });

  await group("6 hash mismatch", async () => {
    const mock = new MockTaxTransactionClient();
    mock.effect.intentHash = "b".repeat(64);
    check((await captureError(mock))?.code === "INTENT_HASH_MISMATCH", "hash mismatch rejected");
  });

  await group("7 exact-key rejection", async () => {
    const extra = new MockTaxTransactionClient({
      intent: percentageIntent({ arbitraryMetadata: "forbidden" }),
    });
    check(
      (await captureError(extra))?.code === "INVALID_IMMUTABLE_INTENT",
      "extra intent key rejected"
    );
    const missingIntent = percentageIntent();
    Reflect.deleteProperty(missingIntent, "taxName");
    const missing = new MockTaxTransactionClient({ intent: missingIntent });
    check(
      (await captureError(missing))?.code === "INVALID_IMMUTABLE_INTENT",
      "missing intent key rejected"
    );
  });

  await group("8 manifest metadata mismatch", async () => {
    const mutations: Array<(finalization: PaymentFinalization) => void> = [
      (value) => { value.manifestVersion = 2; },
      (value) => { value.manifestRevision = 2; },
      (value) => { value.manifestHash = "A".repeat(64); },
      (value) => { value.currency = "USD"; },
      (value) => { value.verifiedAt = fixedDate("invalid"); },
    ];
    for (const mutate of mutations) {
      const mock = new MockTaxTransactionClient();
      mutate(mock.effect.finalization);
      check(
        (await captureError(mock))?.code === "MANIFEST_LINKAGE_MISMATCH",
        "invalid manifest metadata rejected"
      );
    }
  });

  await group("9 parent linkage mismatch", async () => {
    const mock = new MockTaxTransactionClient();
    mock.effect.finalizationId = "finalization_other";
    check(
      (await captureError(mock))?.code === "MANIFEST_LINKAGE_MISMATCH",
      "effect-to-parent mismatch rejected"
    );
  });

  await group("10 foreign linkage rejection", async () => {
    for (const foreign of ["partner", "referral"] as const) {
      const mock = new MockTaxTransactionClient();
      if (foreign === "partner") mock.effect.partnerId = "partner_other";
      else mock.effect.referralId = "referral_other";
      check(
        (await captureError(mock))?.code === "MANIFEST_LINKAGE_MISMATCH",
        `${foreign} linkage rejected`
      );
    }
  });

  await group("11 operation and effect key mismatch", async () => {
    const effectKey = new MockTaxTransactionClient();
    effectKey.effect.effectKey = "tax:other";
    check(
      (await captureError(effectKey))?.code === "MANIFEST_LINKAGE_MISMATCH",
      "effect key mismatch rejected"
    );
    const operationKey = new MockTaxTransactionClient();
    operationKey.effect.operationKey = "pfin:other:tax:other";
    check(
      (await captureError(operationKey))?.code === "MANIFEST_LINKAGE_MISMATCH",
      "operation key mismatch rejected"
    );
    const drift = new MockTaxTransactionClient();
    drift.beforeAuthoritativeLoad = () => {
      const changed = percentageIntent({ taxConfigId: "tax_changed" });
      replaceIntent(drift, changed);
      drift.effect.effectKey = "tax:tax_changed";
      drift.effect.operationKey = buildPaymentFinalizationOperationKey(
        IDS.transaction,
        { kind: "TAX", taxConfigId: "tax_changed" }
      );
    };
    check(
      (await captureError(drift))?.code === "TAX_IDENTITY_MISMATCH",
      "preliminary/authoritative tax identity drift rejected"
    );
  });

  await group("12 missing tax config", async () => {
    check(
      (await captureError(new MockTaxTransactionClient({ config: null })))?.code ===
        "TAX_CONFIG_NOT_FOUND",
      "missing tax config rejected with closed error"
    );
  });

  await group("13 mutable config economics are never used", async () => {
    const mock = new MockTaxTransactionClient({ config: makeTaxConfig() });
    const result = await executeWithMock(mock);
    check(result.outcome === "CREATED", "creation uses immutable intent despite config drift");
    check(
      mock.configSelects.length === 1 &&
        Object.keys(mock.configSelects[0]).length === 1 &&
        mock.configSelects[0].id === true,
      "TaxConfiguration query selects identity only"
    );
  });

  await group("14 valid percentage creation", async () => {
    const result = await executeWithMock(new MockTaxTransactionClient());
    check(result.outcome === "CREATED", "percentage result created");
    if (result.outcome === "CREATED") {
      check(result.taxRecord.appliedRate === 12, "basis points persisted as exact percentage");
      check(result.taxRecord.taxAmountCentavos === 3_588, "canonical tax amount persisted");
    }
  });

  await group("15 valid fixed creation", async () => {
    const result = await executeWithMock(
      new MockTaxTransactionClient({ intent: fixedIntent() })
    );
    check(result.outcome === "CREATED", "fixed result created");
    if (result.outcome === "CREATED") {
      check(result.taxRecord.appliedRate === 0, "fixed tax appliedRate is zero");
      check(result.taxRecord.taxAmountCentavos === 123, "fixed amount comes from intent");
    }
  });

  await group("16 percentage recomputation mismatch", async () => {
    const mock = new MockTaxTransactionClient({
      intent: percentageIntent({ taxAmountCentavos: 3_589 }),
    });
    check(
      (await captureError(mock))?.code === "INVALID_IMMUTABLE_INTENT",
      "percentage mismatch rejected"
    );
  });

  await group("17 customer-payment base binding", async () => {
    const customer = new MockTaxTransactionClient();
    customer.effect.finalization.purchaseAmountCentavos = 1;
    check(
      (await captureError(customer))?.code === "INVALID_IMMUTABLE_INTENT",
      "customer-payment base drift rejected"
    );
    const gross = new MockTaxTransactionClient({
      intent: percentageIntent({
        calculationBasis: "GROSS_SALE",
        taxableAmountCentavos: 39_900,
        taxAmountCentavos: 4_788,
      }),
    });
    gross.effect.finalization.purchaseAmountCentavos = 1;
    check((await executeWithMock(gross)).outcome === "CREATED", "gross base remains intent authority");
  });

  await group("18 exact TaxRecord fields", async () => {
    const result = await executeWithMock(new MockTaxTransactionClient());
    check(result.outcome === "CREATED", "created result returned");
    if (result.outcome === "CREATED") {
      const row = result.taxRecord;
      check(row.taxConfigId === IDS.taxConfig, "tax config exact");
      check(row.transactionId === IDS.transaction, "transaction exact");
      check(row.finalizationEffectId === IDS.effect, "effect exact");
      check(row.taxableAmountCentavos === 29_900, "taxable amount exact");
      check(row.taxAmountCentavos === 3_588, "tax amount exact");
      check(row.calculationBasis === "CUSTOMER_PAYMENT", "basis exact");
      check(row.status === "PROVISIONED", "fresh status exact");
      check(row.effectiveDate.toISOString() === VERIFIED_AT, "verifiedAt used exactly");
      check(row.partnerPayoutId === null && row.referralPayoutId === null, "payout links null");
    }
  });

  await group("19 exact ledger pair", async () => {
    const result = await executeWithMock(new MockTaxTransactionClient());
    check(result.outcome === "CREATED", "created result returned");
    if (result.outcome === "CREATED") {
      const base = `Tax provision for transaction ${IDS.transaction} and tax configuration ${IDS.taxConfig}`;
      check(result.debitEntry.accountCategory === "EXPENSE_TAX", "debit account exact");
      check(result.creditEntry.accountCategory === "LIABILITY_TAX_PAYABLE", "credit account exact");
      for (const entry of [result.debitEntry, result.creditEntry]) {
        check(entry.transactionType === "TAX_PROVISION", "transaction type exact");
        check(entry.operationKey === TAX_OPERATION_KEY, "operation key exact");
        check(entry.finalizationEffectId === IDS.effect, "ledger effect exact");
        check(entry.amountCentavos === 3_588 && entry.currency === "PHP", "money exact");
        check(entry.sourceEntity === "TaxRecord" && entry.sourceId === result.taxRecord.id, "source exact");
        check(entry.effectiveDate.toISOString() === VERIFIED_AT, "ledger date exact");
        check(entry.periodId === null && entry.createdBy === null, "period/creator null");
      }
      check(result.debitEntry.description === `${base} (DR)`, "debit description exact");
      check(result.creditEntry.description === `${base} (CR)`, "credit description exact");
    }
  });

  await group("20 caller-owned transaction and zero nesting", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
    let nestedCalls = 0;
    Object.defineProperty(prisma, "$transaction", {
      configurable: true,
      writable: true,
      value: () => {
        nestedCalls++;
        throw new Error("nested transaction forbidden");
      },
    });
    try {
      check(
        (await executeWithMock(new MockTaxTransactionClient())).outcome === "CREATED",
        "caller-owned execution succeeds"
      );
    } finally {
      if (descriptor) Object.defineProperty(prisma, "$transaction", descriptor);
      else Reflect.deleteProperty(prisma, "$transaction");
    }
    check(nestedCalls === 0, "caller-owned execution opens no nested transaction");
  });

  await group("21 self-owned transaction", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
    const mock = new MockTaxTransactionClient();
    let transactionCalls = 0;
    Object.defineProperty(prisma, "$transaction", {
      configurable: true,
      writable: true,
      value: async <T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
        transactionCalls++;
        return run(mock.asTransactionClient());
      },
    });
    try {
      const result = await IdempotentTaxProvisionService.executeTaxProvisionEffect({
        transactionId: IDS.transaction,
        taxEffectId: IDS.effect,
      });
      check(result.outcome === "CREATED", "self-owned execution succeeds");
    } finally {
      if (descriptor) Object.defineProperty(prisma, "$transaction", descriptor);
      else Reflect.deleteProperty(prisma, "$transaction");
    }
    check(transactionCalls === 1, "exactly one self-owned transaction opened");
  });

  await group("22 exact replay", async () => {
    const row = makeTaxRecord();
    const result = await executeWithMock(
      new MockTaxTransactionClient({
        taxRecords: [row],
        ledgerEntries: makeLedgerPair(row.id),
      })
    );
    check(result.outcome === "REPLAY" && result.isReplay, "exact state replays");
    if (result.outcome === "REPLAY") check(result.taxRecord.id === row.id, "same TaxRecord returned");
  });

  await group("23 mutable TaxRecord status replay accepted", async () => {
    for (const status of ["PROVISIONED", "ACCRUED", "PAID", "REVERSED", "CUSTOM_STATE"]) {
      const row = makeTaxRecord({ status });
      const result = await executeWithMock(
        new MockTaxTransactionClient({
          taxRecords: [row],
          ledgerEntries: makeLedgerPair(row.id),
        })
      );
      check(result.outcome === "REPLAY", `mutable status ${status} accepted`);
    }
  });

  await group("24 every immutable TaxRecord mismatch rejected", async () => {
    const variants: Array<readonly [string, Partial<TaxRecord>]> = [
      ["taxConfigId", { taxConfigId: "tax_other" }],
      ["transactionId", { transactionId: "txn_other" }],
      ["finalizationEffectId", { finalizationEffectId: "effect_other" }],
      ["taxableAmountCentavos", { taxableAmountCentavos: 29_901 }],
      ["appliedRate", { appliedRate: 11.99 }],
      ["taxAmountCentavos", { taxAmountCentavos: 3_589 }],
      ["calculationBasis", { calculationBasis: "GROSS_SALE" }],
      ["effectiveDate", { effectiveDate: fixedDate("2026-09-01T01:00:01.000Z") }],
      ["partnerPayoutId", { partnerPayoutId: "partner_payout" }],
      ["referralPayoutId", { referralPayoutId: "referral_payout" }],
    ];
    for (const [name, override] of variants) {
      const row = makeTaxRecord(override);
      const error = await captureError(
        new MockTaxTransactionClient({
          taxRecords: [row],
          ledgerEntries: makeLedgerPair(row.id),
        })
      );
      check(error?.code === "TAX_RECORD_IDENTITY_CONFLICT", `${name} mismatch rejected`);
    }
  });

  await group("25 NO_ACTIVE_TAX_RULES no-op", async () => {
    const mock = new MockTaxTransactionClient({ intent: noActiveIntent() });
    const result = await executeWithMock(mock);
    check(
      result.outcome === "NOT_APPLICABLE" && result.reason === "NO_ACTIVE_TAX_RULES",
      "no-active reason returned"
    );
    check(mock.taxRecords.length === 0 && mock.ledgerEntries.length === 0, "zero financial rows");
    check(mock.writeCallCount === 0, "zero writes");
    check(mock.configSelects.length === 0, "no config lookup for tax:none");
  });

  await group("26 ZERO_TAX_CALCULATED percentage no-op", async () => {
    const mock = new MockTaxTransactionClient({ intent: zeroTaxIntent(1) });
    mock.effect.finalization.purchaseAmountCentavos = 1;
    const result = await executeWithMock(mock);
    check(
      result.outcome === "NOT_APPLICABLE" && result.reason === "ZERO_TAX_CALCULATED",
      "percentage zero reason returned"
    );
    check(mock.writeCallCount === 0, "percentage zero performs no writes");
    check(mock.configSelects.length === 1, "configured zero verifies config identity");
  });

  await group("27 ZERO_TAX_CALCULATED fixed no-op", async () => {
    const mock = new MockTaxTransactionClient({ intent: zeroTaxIntent(null) });
    const result = await executeWithMock(mock);
    check(result.outcome === "NOT_APPLICABLE", "fixed zero returns no-op");
    check(mock.writeCallCount === 0, "fixed zero performs no writes");
  });

  await group("28 malformed not-applicable shapes", async () => {
    const invalids = [
      noActiveIntent({ taxConfigId: IDS.taxConfig }),
      noActiveIntent({ debitCategory: "EXPENSE_TAX" }),
      zeroTaxIntent(1, { taxAmountCentavos: 1 }),
      zeroTaxIntent(1, { taxRateBasisPoints: 20 }),
      zeroTaxIntent(null, { notApplicableReason: "UNKNOWN" }),
    ];
    for (const intent of invalids) {
      const mock = new MockTaxTransactionClient({ intent });
      check(
        (await captureError(mock))?.code === "INVALID_IMMUTABLE_INTENT",
        "malformed not-applicable shape rejected"
      );
    }
    const statusMismatch = new MockTaxTransactionClient({ intent: zeroTaxIntent(null) });
    statusMismatch.effect.status = "PENDING";
    check((await captureError(statusMismatch))?.code === "INVALID_LIFECYCLE", "NA lifecycle mismatch rejected");
  });

  await group("29 TaxRecord exact plus ledger missing", async () => {
    check(
      (await captureError(
        new MockTaxTransactionClient({ taxRecords: [makeTaxRecord()] })
      ))?.code === "TAX_RECORD_PARTIAL_STATE",
      "domain-only split rejected"
    );
  });

  await group("30 TaxRecord missing plus ledger exact", async () => {
    check(
      (await captureError(
        new MockTaxTransactionClient({ ledgerEntries: makeLedgerPair("missing_tax_record") })
      ))?.code === "TAX_RECORD_PARTIAL_STATE",
      "ledger-only split rejected"
    );
  });

  await group("31 legacy TaxRecord refusal", async () => {
    const legacy = makeTaxRecord({ finalizationEffectId: null });
    check(
      (await captureError(
        new MockTaxTransactionClient({ taxRecords: [legacy] })
      ))?.code === "LEGACY_TAX_REQUIRES_CLASSIFICATION",
      "legacy row is not adopted"
    );
  });

  await group("32 conflicting and duplicate TaxRecord state", async () => {
    const exact = makeTaxRecord();
    const duplicate = makeTaxRecord({ id: "tax_record_duplicate", finalizationEffectId: null });
    check(
      (await captureError(
        new MockTaxTransactionClient({
          taxRecords: [exact, duplicate],
          ledgerEntries: makeLedgerPair(exact.id),
        })
      ))?.code === "TAX_RECORD_IDENTITY_CONFLICT",
      "duplicate transaction/config identity rejected"
    );
  });

  await group("33 conflicting ledger state", async () => {
    const row = makeTaxRecord();
    const pair = makeLedgerPair(row.id);
    pair[1].operationKey = "pfin:other:tax:other";
    check(
      (await captureError(
        new MockTaxTransactionClient({ taxRecords: [row], ledgerEntries: pair })
      ))?.code === "LEDGER_IDENTITY_CONFLICT",
      "crossed ledger identity rejected"
    );
  });

  await group("34 description and credit-side ledger mismatch", async () => {
    const row = makeTaxRecord();
    const mutations: Array<(pair: [FinancialLedgerEntry, FinancialLedgerEntry]) => void> = [
      (pair) => { pair[0].description = "wrong description"; },
      (pair) => { pair[1].transactionId = "txn_other"; },
      (pair) => { pair[1].sourceEntity = "Other"; },
      (pair) => { pair[1].periodId = "period_other"; },
      (pair) => { pair[1].createdBy = "admin"; },
    ];
    for (const mutate of mutations) {
      const pair = makeLedgerPair(row.id);
      mutate(pair);
      check(
        (await captureError(
          new MockTaxTransactionClient({ taxRecords: [row], ledgerEntries: pair })
        ))?.code === "LEDGER_IDENTITY_CONFLICT",
        "full ledger preflight mismatch rejected"
      );
    }
  });

  await group("35 lifecycle matrix", async () => {
    for (const status of ["PENDING", "FAILED_RETRYABLE"] as const) {
      const mock = new MockTaxTransactionClient();
      mock.effect.status = status;
      check((await executeWithMock(mock)).outcome === "CREATED", `${status} permits fresh creation`);
    }
    for (const status of ["AWAITING_DATA", "MANUAL_REVIEW", "NOT_APPLICABLE"] as const) {
      const mock = new MockTaxTransactionClient();
      mock.effect.status = status;
      check((await captureError(mock))?.code === "INVALID_LIFECYCLE", `${status} rejected for pending intent`);
    }
    const parentManual = new MockTaxTransactionClient();
    parentManual.effect.finalization.status = "MANUAL_REVIEW";
    check((await captureError(parentManual))?.code === "INVALID_LIFECYCLE", "parent manual review rejected");
  });

  await group("36 parent COMPLETE replay-only", async () => {
    const row = makeTaxRecord();
    const replay = new MockTaxTransactionClient({
      taxRecords: [row],
      ledgerEntries: makeLedgerPair(row.id),
    });
    replay.effect.finalization.status = "COMPLETE";
    check((await executeWithMock(replay)).outcome === "REPLAY", "complete parent permits replay");
    const fresh = new MockTaxTransactionClient();
    fresh.effect.finalization.status = "COMPLETE";
    check((await captureError(fresh))?.code === "INVALID_LIFECYCLE", "complete parent forbids fresh");
    const effectComplete = new MockTaxTransactionClient();
    effectComplete.effect.status = "COMPLETE";
    check((await captureError(effectComplete))?.code === "INVALID_LIFECYCLE", "complete effect forbids fresh");
  });

  await group("37 no lifecycle writes", async () => {
    const mock = new MockTaxTransactionClient();
    const before = lifecycleSnapshot(mock);
    await executeWithMock(mock);
    check(lifecycleSnapshot(mock) === before, "effect and parent lifecycle fields unchanged");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentTaxProvisionService.ts"),
      "utf8"
    );
    check(!source.includes("paymentFinalizationEffect.update"), "no effect update call");
    check(!source.includes("paymentFinalization.update"), "no parent update call");
  });

  await group("38 recognized TaxRecord P2002 array form", async () => {
    const mock = new MockTaxTransactionClient();
    mock.simulateTaxP2002Target = ["finalizationEffectId"];
    check((await captureError(mock))?.code === "CONCURRENT_IDENTITY_CONFLICT", "array P2002 recognized");
  });

  await group("39 recognized TaxRecord P2002 named form", async () => {
    const mock = new MockTaxTransactionClient();
    mock.simulateTaxP2002Target = "TaxRecord_finalizationEffectId_key";
    check((await captureError(mock))?.code === "CONCURRENT_IDENTITY_CONFLICT", "named P2002 recognized");
  });

  await group("40 unrelated P2002 generic failure", async () => {
    const mock = new MockTaxTransactionClient();
    mock.simulateTaxP2002Target = ["taxConfigId", "transactionId"];
    const error = await captureError(mock);
    check(error?.code === "DATABASE_EXECUTION_FAILED", "unrelated P2002 generic");
    check(error?.message === "Database execution failed during tax provision execution.", "generic message exact");
  });

  await group("41 ledger errors and ledger P2002 mapping", async () => {
    const mappings: Array<readonly [unknown, TaxProvisionExecutionErrorCode]> = [
      [{ code: "P2002", meta: { target: ["operationKey", "entryType"] } }, "CONCURRENT_IDENTITY_CONFLICT"],
      [new LedgerConcurrentIdentityConflictError("secret"), "CONCURRENT_IDENTITY_CONFLICT"],
      [new LedgerInconsistentStateError("secret"), "LEDGER_IDENTITY_CONFLICT"],
      [new LedgerIdempotencyMismatchError("secret"), "LEDGER_IDENTITY_CONFLICT"],
      [new InvalidLedgerAmountError("secret"), "INVALID_IMMUTABLE_INTENT"],
      [new InvalidLedgerCurrencyError("secret"), "INVALID_IMMUTABLE_INTENT"],
      [new InvalidLedgerEffectiveDateError("secret"), "INVALID_IMMUTABLE_INTENT"],
      [new InvalidLedgerOperationKeyError("secret"), "MANIFEST_LINKAGE_MISMATCH"],
      [new InvalidLedgerOperationMismatchError("secret"), "MANIFEST_LINKAGE_MISMATCH"],
      [new InvalidLedgerFinalizationEffectIdError("secret"), "MANIFEST_LINKAGE_MISMATCH"],
      [new InvalidLedgerTransactionIdError("secret"), "MANIFEST_LINKAGE_MISMATCH"],
    ];
    for (const [failure, expected] of mappings) {
      const mock = new MockTaxTransactionClient();
      mock.simulateLedgerFailure = failure;
      check((await captureError(mock))?.code === expected, `ledger failure maps to ${expected}`);
    }
  });

  await group("42 zero SQL after aborted P2002", async () => {
    const mock = new MockTaxTransactionClient();
    mock.simulateTaxP2002Target = ["finalizationEffectId"];
    await captureError(mock);
    check(mock.postAbortCallCount === 0, "no post-abort SQL attempted");
  });

  await group("43 rollback when ledger creation fails", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
    const mock = new MockTaxTransactionClient();
    mock.simulateLedgerFailure = new Error("synthetic ledger failure");
    Object.defineProperty(prisma, "$transaction", {
      configurable: true,
      writable: true,
      value: async <T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => {
        const snapshot = mock.snapshot();
        try {
          return await run(mock.asTransactionClient());
        } catch (error) {
          mock.restore(snapshot);
          throw error;
        }
      },
    });
    let error: TaxProvisionExecutionError | null = null;
    try {
      try {
        await IdempotentTaxProvisionService.executeTaxProvisionEffect({
          transactionId: IDS.transaction,
          taxEffectId: IDS.effect,
        });
      } catch (caught: unknown) {
        if (caught instanceof TaxProvisionExecutionError) error = caught;
      }
    } finally {
      if (descriptor) Object.defineProperty(prisma, "$transaction", descriptor);
      else Reflect.deleteProperty(prisma, "$transaction");
    }
    check(error?.code === "DATABASE_EXECUTION_FAILED", "ledger failure closed");
    check(mock.taxRecords.length === 0 && mock.ledgerEntries.length === 0, "atomic rollback removes both sides");
  });

  await group("44 lock ordering", async () => {
    const row = makeTaxRecord();
    const mock = new MockTaxTransactionClient({
      taxRecords: [row],
      ledgerEntries: makeLedgerPair(row.id),
    });
    await executeWithMock(mock);
    check(mock.advisoryLocks[0] === IDS.transaction, "transaction root first");
    check(mock.advisoryLocks[1] === `tax-provision:effect:${IDS.effect}`, "tax effect second");
    check(mock.advisoryLocks[2] === `ledger:operation:${TAX_OPERATION_KEY}`, "ledger operation third");
    check(mock.advisoryLocks[3] === `ledger:effect:${IDS.effect}`, "ledger effect fourth");
    check(mock.effectRowLocks[0] === IDS.effect, "effect row locked");
    check(mock.taxRecordRowLocks.join(",") === row.id, "TaxRecord rows locked in stable order");
    check(mock.advisoryLocks[4] === `ledger:operation:${TAX_OPERATION_KEY}`, "primitive reacquires operation lock");
    check(mock.advisoryLocks[5] === `ledger:effect:${IDS.effect}`, "primitive reacquires effect lock");
  });

  await group("45 caller-owned failure contract", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(prisma, "$transaction");
    let nestedCalls = 0;
    Object.defineProperty(prisma, "$transaction", {
      configurable: true,
      writable: true,
      value: () => {
        nestedCalls++;
        throw new Error("nested transaction forbidden");
      },
    });
    const mock = new MockTaxTransactionClient();
    mock.simulateTaxP2002Target = ["finalizationEffectId"];
    let error: TaxProvisionExecutionError | null = null;
    try {
      error = await captureError(mock);
    } finally {
      if (descriptor) Object.defineProperty(prisma, "$transaction", descriptor);
      else Reflect.deleteProperty(prisma, "$transaction");
    }
    check(nestedCalls === 0, "caller failure opens no nested transaction");
    check(error?.code === "CONCURRENT_IDENTITY_CONFLICT", "closed error propagates");
    check(mock.postAbortCallCount === 0, "caller transaction receives no post-error SQL");
  });

  await group("46 zero production callers", async () => {
    const appRoot = path.resolve(process.cwd(), "src/app");
    const consumers = listFiles(appRoot)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .filter((file) => {
        const source = fs.readFileSync(file, "utf8");
        return source.includes("IdempotentTaxProvisionService") || source.includes("idempotentTaxProvisionService");
      });
    check(consumers.length === 0, `zero src/app consumers: ${consumers.join(", ")}`);
    const service = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/accounting/idempotentTaxProvisionService.ts"),
      "utf8"
    );
    const dynamicAny = new RegExp(":\\s*a" + "ny\\b|as\\s+a" + "ny\\b|<a" + "ny>|\\ba" + "ny\\[\\]");
    check(!dynamicAny.test(service), "service contains zero any types");
    check(!service.includes("$queryRawUnsafe"), "service uses no unsafe raw query");
    check(!service.includes("$executeRaw"), "service uses no raw mutation");
    check(!service.includes("new Date()"), "service uses no ambient effective timestamp");
  });

  await group("47 exact Slice 3 consumer allowlist", async () => {
    const primitive = "src/lib/accounting/idempotentLedgerService.ts";
    const consumers = listFiles(path.resolve(process.cwd(), "src/lib"))
      .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .filter((file) => {
        const relative = path.relative(process.cwd(), file).split(path.sep).join("/");
        if (relative === primitive) return false;
        const source = fs.readFileSync(file, "utf8");
        return source.includes("IdempotentLedgerService") || source.includes("idempotentLedgerService");
      })
      .map((file) => path.relative(process.cwd(), file).split(path.sep).join("/"))
      .sort((left, right) => left.localeCompare(right));
    const approved = [
      "src/lib/accounting/idempotentPartnerCommissionService.ts",
      "src/lib/accounting/idempotentTaxProvisionService.ts",
    ].sort((left, right) => left.localeCompare(right));
    check(JSON.stringify(consumers) === JSON.stringify(approved), `exact consumers: ${consumers.join(", ")}`);
    const slice3 = fs.readFileSync(
      path.resolve(process.cwd(), "src/scripts/test-idempotent-ledger-primitive.ts"),
      "utf8"
    );
    check(slice3.includes('"idempotentTax" +'), "Slice 3 allowlist explicitly contains tax executor");
  });

  console.log("============================================================");
  console.log(
    `Slice 6B synthetic summary: ${passedGroups}/${totalGroups} groups passed; ${totalChecks} checks executed; ${failedGroups} groups failed.`
  );
  console.log(
    "LIMITATION: synthetic tests cannot prove real PostgreSQL advisory waiting, row locking, unique-race scheduling, transaction abort behavior, or deadlock freedom."
  );
  if (failedGroups > 0) process.exit(1);
}

runSuite().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Unhandled synthetic test failure:", message);
  process.exit(1);
});
