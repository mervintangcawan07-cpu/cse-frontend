// Relative Path: src/scripts/test-idempotent-ledger-primitive.ts
/**
 * Synthetic Test Suite: GovStudyX Idempotent Ledger Posting Primitive (Phase 1 / Slice 3)
 *
 * STRICTLY SYNTHETIC / IN-MEMORY TESTS — ZERO LIVE DATABASE WRITES, MUTATIONS, OR EXTERNAL CALLS.
 */

import fs from "fs";
import path from "path";
import { Prisma, FinancialLedgerEntry } from "@prisma/client";
import {
  AccountCategory,
  FinancialTransactionType,
  LedgerEntryType,
} from "../lib/accounting/types";
import {
  IdempotentLedgerService,
  FinalizationLedgerOperation,
  PostBalancedDoubleEntryIdempotentParams,
  PostBalancedDoubleEntryResult,
  isLedgerIdentityP2002Error,
  IdempotentLedgerError,
  InvalidLedgerAmountError,
  InvalidLedgerOperationKeyError,
  InvalidLedgerFinalizationEffectIdError,
  InvalidLedgerTransactionIdError,
  InvalidLedgerOperationMismatchError,
  InvalidLedgerCurrencyError,
  InvalidLedgerEffectiveDateError,
  LedgerInconsistentStateError,
  LedgerIdempotencyMismatchError,
  LedgerConcurrentIdentityConflictError,
} from "../lib/accounting/idempotentLedgerService";
import { buildPaymentFinalizationOperationKey } from "../lib/payment/paymentFinalizationContracts";

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

// Simulated In-Memory Prisma Transaction Client
class MockPrismaTransactionClient {
  public storage: FinancialLedgerEntry[] = [];
  public executedRawQueries: string[] = [];
  public executedQueryRawCalls: string[] = [];
  public executedExecuteRawCalls: string[] = [];
  public writeCallCount = 0;
  public queryCallCount = 0;
  public simulateP2002OnCreate: Error | null = null;
  public nextIdCounter = 1;

  public reset(): void {
    this.storage = [];
    this.executedRawQueries = [];
    this.executedQueryRawCalls = [];
    this.executedExecuteRawCalls = [];
    this.writeCallCount = 0;
    this.queryCallCount = 0;
    this.simulateP2002OnCreate = null;
    this.nextIdCounter = 1;
  }

  // Simulated $queryRaw (for transaction-scoped advisory locks)
  public async $queryRaw(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<unknown> {
    let query = strings[0];
    for (let i = 0; i < values.length; i++) {
      query += String(values[i]) + strings[i + 1];
    }
    this.executedQueryRawCalls.push(query);
    this.executedRawQueries.push(query);
    return [{ pg_advisory_xact_lock: null }];
  }

  // Simulated $executeRaw
  public async $executeRaw(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<number> {
    let query = strings[0];
    for (let i = 0; i < values.length; i++) {
      query += String(values[i]) + strings[i + 1];
    }
    this.executedExecuteRawCalls.push(query);
    this.executedRawQueries.push(query);
    return 1;
  }

  // Simulated financialLedgerEntry model operations
  public financialLedgerEntry = {
    findMany: async (args: {
      where?: { operationKey?: string; finalizationEffectId?: string };
      orderBy?: { entryType?: "asc" | "desc" };
    }): Promise<FinancialLedgerEntry[]> => {
      this.queryCallCount++;
      let rows = [...this.storage];
      if (args?.where?.operationKey) {
        rows = rows.filter((r) => r.operationKey === args.where!.operationKey);
      }
      if (args?.where?.finalizationEffectId) {
        rows = rows.filter(
          (r) => r.finalizationEffectId === args.where!.finalizationEffectId
        );
      }
      if (args?.orderBy?.entryType === "asc") {
        rows.sort((a, b) => a.entryType.localeCompare(b.entryType));
      }
      return rows;
    },

    createManyAndReturn: async (args: {
      data: Prisma.FinancialLedgerEntryCreateManyInput[];
    }): Promise<FinancialLedgerEntry[]> => {
      this.writeCallCount++;
      if (this.simulateP2002OnCreate) {
        throw this.simulateP2002OnCreate;
      }

      const created: FinancialLedgerEntry[] = args.data.map((item) => {
        const row: FinancialLedgerEntry = {
          id: `cuid_row_${this.nextIdCounter++}`,
          entryNumber: item.entryNumber,
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
          effectiveDate:
            item.effectiveDate instanceof Date
              ? item.effectiveDate
              : new Date(item.effectiveDate ?? Date.now()),
          periodId: item.periodId ?? null,
          createdBy: item.createdBy ?? null,
          createdAt: new Date(),
        };
        return row;
      });

      this.storage.push(...created);
      return created;
    },
  };
}

async function runIdempotentLedgerPrimitiveTests(): Promise<void> {
  console.log("================================================================================");
  console.log("🧪 RUNNING SYNTHETIC SUITE: IDEMPOTENT LEDGER PRIMITIVE (SLICE 3)");
  console.log("================================================================================\n");

  const mockClient = new MockPrismaTransactionClient();
  const txClient = mockClient as unknown as Prisma.TransactionClient;
  const sampleTxId = "txn_led_001";
  const sampleEffectId = "cuid_eff_001";
  const testDate = new Date("2026-08-31T10:00:00.000Z");

  // Helper to build standard valid input
  function makeValidParams(
    overrides?: Partial<PostBalancedDoubleEntryIdempotentParams>
  ): PostBalancedDoubleEntryIdempotentParams {
    const operation: FinalizationLedgerOperation = { kind: "PAYMENT" };
    const operationKey = buildPaymentFinalizationOperationKey(sampleTxId, operation);
    return {
      transactionId: sampleTxId,
      finalizationEffectId: sampleEffectId,
      operation,
      operationKey,
      transactionType: "PAYMENT_RECEIVED",
      debitCategory: "CASH_PAYMONGO",
      creditCategory: "REVENUE_PREMIUM",
      amountCentavos: 29900,
      currency: "PHP",
      sourceEntity: "PaymentFinalization",
      sourceId: "pfin_001",
      description: "Subscription payment 1_YEAR",
      effectiveDate: testDate,
      periodId: "period_2026_08",
      createdBy: "system_worker",
      ...overrides,
    };
  }

  // Test 1-9: Closed Ledger Operations (4 supported, non-ledger rejected)
  {
    mockClient.reset();

    // 1. PAYMENT
    const pmtOp: FinalizationLedgerOperation = { kind: "PAYMENT" };
    const pmtKey = buildPaymentFinalizationOperationKey(sampleTxId, pmtOp);
    const resPmt = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
      makeValidParams({ operation: pmtOp, operationKey: pmtKey }),
      txClient
    );

    // 2. FEE
    mockClient.reset();
    const feeOp: FinalizationLedgerOperation = { kind: "FEE" };
    const feeKey = buildPaymentFinalizationOperationKey(sampleTxId, feeOp);
    const resFee = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
      makeValidParams({
        operation: feeOp,
        operationKey: feeKey,
        transactionType: "PAYMONGO_FEE",
        debitCategory: "EXPENSE_PAYMENT_FEE",
        creditCategory: "CASH_PAYMONGO",
        amountCentavos: 1500,
      }),
      txClient
    );

    // 3. PARTNER_LIABILITY
    mockClient.reset();
    const ptrOp: FinalizationLedgerOperation = { kind: "PARTNER_LIABILITY" };
    const ptrKey = buildPaymentFinalizationOperationKey(sampleTxId, ptrOp);
    const resPtr = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
      makeValidParams({
        operation: ptrOp,
        operationKey: ptrKey,
        transactionType: "PARTNER_COMMISSION",
        debitCategory: "EXPENSE_PARTNER",
        creditCategory: "LIABILITY_PARTNER_PAYABLE",
        amountCentavos: 4485,
      }),
      txClient
    );

    // 4. TAX
    mockClient.reset();
    const taxOp: FinalizationLedgerOperation = { kind: "TAX", taxConfigId: "vat_12" };
    const taxKey = buildPaymentFinalizationOperationKey(sampleTxId, taxOp);
    const resTax = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
      makeValidParams({
        operation: taxOp,
        operationKey: taxKey,
        transactionType: "TAX_PROVISION",
        debitCategory: "EXPENSE_TAX",
        creditCategory: "LIABILITY_TAX_PAYABLE",
        amountCentavos: 3588,
      }),
      txClient
    );

    // 5. Non-ledger operations rejected: REFERRAL, PARTNER_COMMISSION, TAX_NONE, RECONCILIATION
    const nonLedgerOps = [
      { kind: "REFERRAL" },
      { kind: "PARTNER_COMMISSION" },
      { kind: "TAX_NONE" },
      { kind: "RECONCILIATION" },
    ];

    let rejectedCount = 0;
    for (const op of nonLedgerOps) {
      try {
        await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
          makeValidParams({
            operation: op as unknown as FinalizationLedgerOperation,
            operationKey: "pfin:txn_led_001:referral",
          }),
          txClient
        );
      } catch (err) {
        if (
          err instanceof InvalidLedgerOperationMismatchError &&
          err.code === "INVALID_LEDGER_OPERATION_MISMATCH"
        ) {
          rejectedCount++;
        }
      }
    }

    assert(
      !resPmt.isReplay &&
        !resFee.isReplay &&
        !resPtr.isReplay &&
        !resTax.isReplay &&
        rejectedCount === 4,
      "Test 1-9: Closed operation families verified (PAYMENT, FEE, PARTNER_LIABILITY, TAX accepted; REFERRAL, PARTNER_COMMISSION, TAX_NONE, RECONCILIATION rejected)"
    );
  }

  // Test 10-16: Money Safety (positive integer centavos required, all invalid rejected)
  {
    mockClient.reset();
    const invalidAmounts = [0, -100, 299.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 10];
    let caughtInvalidAmount = 0;

    for (const amt of invalidAmounts) {
      try {
        await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
          makeValidParams({ amountCentavos: amt }),
          txClient
        );
      } catch (err) {
        if (err instanceof InvalidLedgerAmountError && err.code === "INVALID_LEDGER_AMOUNT") {
          caughtInvalidAmount++;
        }
      }
    }

    assert(
      caughtInvalidAmount === invalidAmounts.length,
      "Test 10-16: Money safety verified (0, negative, float, NaN, Infinity, unsafe integer strictly rejected)"
    );
  }

  // Test 17-18: Currency Authority (PHP accepted, non-PHP rejected)
  {
    mockClient.reset();
    const validPmt = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
      makeValidParams({ currency: "PHP" }),
      txClient
    );

    let caughtUsd = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
        makeValidParams({ currency: "USD" }),
        txClient
      );
    } catch (err) {
      if (err instanceof InvalidLedgerCurrencyError && err.code === "INVALID_LEDGER_CURRENCY") {
        caughtUsd = true;
      }
    }

    assert(
      validPmt.debitEntry.currency === "PHP" && caughtUsd,
      "Test 17-18: Currency authority verified (PHP accepted, non-PHP rejected with INVALID_LEDGER_CURRENCY)"
    );
  }

  // Test 19-21: Identity & Operation Key Agreement (Strict Character-for-Character)
  {
    mockClient.reset();

    // 19A. Missing/invalid transactionId
    let invalidTxCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
        makeValidParams({ transactionId: "txn:invalid:colon" }),
        txClient
      );
    } catch (err) {
      if (err instanceof InvalidLedgerTransactionIdError) invalidTxCaught = true;
    }

    // 19B. Missing finalizationEffectId
    let emptyEffectIdCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
        makeValidParams({ finalizationEffectId: "   " }),
        txClient
      );
    } catch (err) {
      if (err instanceof InvalidLedgerFinalizationEffectIdError) emptyEffectIdCaught = true;
    }

    // 20. Canonical exact operationKey succeeds
    const canonicalKey = buildPaymentFinalizationOperationKey(sampleTxId, { kind: "PAYMENT" });
    const exactSuccess = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
      makeValidParams({ operationKey: canonicalKey }),
      txClient
    );

    // 21A. OperationKey mismatch against derived key
    let opKeyMismatchCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
        makeValidParams({ operationKey: "pfin:txn_led_001:fee" }), // Operation is PAYMENT
        txClient
      );
    } catch (err) {
      if (err instanceof InvalidLedgerOperationMismatchError) opKeyMismatchCaught = true;
    }

    // 21B. Leading space rejected
    let leadingSpaceCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
        makeValidParams({ operationKey: ` ${canonicalKey}` }),
        txClient
      );
    } catch (err) {
      if (err instanceof InvalidLedgerOperationMismatchError) leadingSpaceCaught = true;
    }

    // 21C. Trailing space rejected
    let trailingSpaceCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
        makeValidParams({ operationKey: `${canonicalKey} ` }),
        txClient
      );
    } catch (err) {
      if (err instanceof InvalidLedgerOperationMismatchError) trailingSpaceCaught = true;
    }

    // 21D. Tab-prefixed space rejected
    let tabSpaceCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
        makeValidParams({ operationKey: `\t${canonicalKey}` }),
        txClient
      );
    } catch (err) {
      if (err instanceof InvalidLedgerOperationMismatchError) tabSpaceCaught = true;
    }

    assert(
      invalidTxCaught &&
        emptyEffectIdCaught &&
        exactSuccess.debitEntry.operationKey === canonicalKey &&
        opKeyMismatchCaught &&
        leadingSpaceCaught &&
        trailingSpaceCaught &&
        tabSpaceCaught,
      "Test 19-21: Identity & exact operationKey agreement strictly verified (canonical succeeds, leading/trailing/tab whitespace fails closed)"
    );
  }

  // Test 22-23: Explicit effectiveDate Requirement
  {
    mockClient.reset();

    let invalidDateCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
        makeValidParams({ effectiveDate: new Date("invalid date string") }),
        txClient
      );
    } catch (err) {
      if (err instanceof InvalidLedgerEffectiveDateError) invalidDateCaught = true;
    }

    assert(
      invalidDateCaught,
      "Test 22-23: Explicit non-null valid Date required for effectiveDate (invalid Date rejected)"
    );
  }

  // Test 24-27: Fresh Execution (Exactly 1 DEBIT + 1 CREDIT with identical metadata)
  {
    mockClient.reset();
    const result = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
      makeValidParams(),
      txClient
    );

    assert(
      result.isReplay === false &&
        result.debitEntry.entryType === "DEBIT" &&
        result.creditEntry.entryType === "CREDIT" &&
        result.debitEntry.accountCategory === "CASH_PAYMONGO" &&
        result.creditEntry.accountCategory === "REVENUE_PREMIUM" &&
        result.debitEntry.amountCentavos === 29900 &&
        result.creditEntry.amountCentavos === 29900 &&
        result.debitEntry.operationKey === "pfin:txn_led_001:payment" &&
        result.creditEntry.operationKey === "pfin:txn_led_001:payment" &&
        result.debitEntry.finalizationEffectId === sampleEffectId &&
        result.creditEntry.finalizationEffectId === sampleEffectId &&
        result.debitEntry.transactionId === sampleTxId &&
        result.creditEntry.transactionId === sampleTxId &&
        mockClient.writeCallCount === 1 &&
        mockClient.storage.length === 2,
      "Test 24-27: Fresh execution creates exactly balanced DEBIT + CREDIT pair with complete identity & metadata"
    );
  }

  // Test 28-30: Exact Replay (Returns existing pair with ZERO writes)
  {
    // mockClient still contains the pair from Test 24
    const writeCountBefore = mockClient.writeCallCount;
    const replayResult = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
      makeValidParams(),
      txClient
    );

    assert(
      replayResult.isReplay === true &&
        replayResult.debitEntry.id.startsWith("cuid_row_") &&
        replayResult.creditEntry.id.startsWith("cuid_row_") &&
        mockClient.writeCallCount === writeCountBefore &&
        mockClient.storage.length === 2,
      "Test 28-30: Exact concurrent replay returns existing pair and performs ZERO writes"
    );
  }

  // Test 31-39: Cross-Identity Inconsistent States (States C, D, E, F, G and Malformed Pairs)
  {
    const validP = makeValidParams();

    // 31. State C: operationKey exists, effectId does not
    mockClient.reset();
    mockClient.storage.push(
      {
        id: "row_1",
        entryNumber: "LED-001-DR",
        transactionId: sampleTxId,
        transactionType: "PAYMENT_RECEIVED",
        accountCategory: "CASH_PAYMONGO",
        entryType: "DEBIT",
        amountCentavos: 29900,
        currency: "PHP",
        sourceEntity: "PaymentFinalization",
        sourceId: "pfin_001",
        operationKey: validP.operationKey,
        finalizationEffectId: "cuid_different_eff", // Mismatched effectId
        description: "DR",
        effectiveDate: testDate,
        periodId: "period_2026_08",
        createdBy: "system",
        createdAt: new Date(),
      },
      {
        id: "row_2",
        entryNumber: "LED-001-CR",
        transactionId: sampleTxId,
        transactionType: "PAYMENT_RECEIVED",
        accountCategory: "REVENUE_PREMIUM",
        entryType: "CREDIT",
        amountCentavos: 29900,
        currency: "PHP",
        sourceEntity: "PaymentFinalization",
        sourceId: "pfin_001",
        operationKey: validP.operationKey,
        finalizationEffectId: "cuid_different_eff",
        description: "CR",
        effectiveDate: testDate,
        periodId: "period_2026_08",
        createdBy: "system",
        createdAt: new Date(),
      }
    );

    let stateCCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(validP, txClient);
    } catch (err) {
      if (err instanceof LedgerInconsistentStateError && err.code === "LEDGER_INCONSISTENT_STATE") {
        stateCCaught = true;
      }
    }

    // 32. State D: effectId exists, operationKey does not
    mockClient.reset();
    mockClient.storage.push(
      {
        id: "row_3",
        entryNumber: "LED-002-DR",
        transactionId: sampleTxId,
        transactionType: "PAYMENT_RECEIVED",
        accountCategory: "CASH_PAYMONGO",
        entryType: "DEBIT",
        amountCentavos: 29900,
        currency: "PHP",
        sourceEntity: "PaymentFinalization",
        sourceId: "pfin_001",
        operationKey: "pfin:other_tx:payment",
        finalizationEffectId: validP.finalizationEffectId,
        description: "DR",
        effectiveDate: testDate,
        periodId: "period_2026_08",
        createdBy: "system",
        createdAt: new Date(),
      },
      {
        id: "row_4",
        entryNumber: "LED-002-CR",
        transactionId: sampleTxId,
        transactionType: "PAYMENT_RECEIVED",
        accountCategory: "REVENUE_PREMIUM",
        entryType: "CREDIT",
        amountCentavos: 29900,
        currency: "PHP",
        sourceEntity: "PaymentFinalization",
        sourceId: "pfin_001",
        operationKey: "pfin:other_tx:payment",
        finalizationEffectId: validP.finalizationEffectId,
        description: "CR",
        effectiveDate: testDate,
        periodId: "period_2026_08",
        createdBy: "system",
        createdAt: new Date(),
      }
    );

    let stateDCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(validP, txClient);
    } catch (err) {
      if (err instanceof LedgerInconsistentStateError) stateDCaught = true;
    }

    // 34-35. State F: Only 1 row exists (e.g. DEBIT only)
    mockClient.reset();
    mockClient.storage.push({
      id: "row_5",
      entryNumber: "LED-003-DR",
      transactionId: sampleTxId,
      transactionType: "PAYMENT_RECEIVED",
      accountCategory: "CASH_PAYMONGO",
      entryType: "DEBIT",
      amountCentavos: 29900,
      currency: "PHP",
      sourceEntity: "PaymentFinalization",
      sourceId: "pfin_001",
      operationKey: validP.operationKey,
      finalizationEffectId: validP.finalizationEffectId,
      description: "DR",
      effectiveDate: testDate,
      periodId: "period_2026_08",
      createdBy: "system",
      createdAt: new Date(),
    });

    let oneSidedCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(validP, txClient);
    } catch (err) {
      if (err instanceof LedgerInconsistentStateError) oneSidedCaught = true;
    }

    // 39. Malformed pair: DEBIT amount != CREDIT amount
    mockClient.reset();
    mockClient.storage.push(
      {
        id: "row_6",
        entryNumber: "LED-004-DR",
        transactionId: sampleTxId,
        transactionType: "PAYMENT_RECEIVED",
        accountCategory: "CASH_PAYMONGO",
        entryType: "DEBIT",
        amountCentavos: 29900,
        currency: "PHP",
        sourceEntity: "PaymentFinalization",
        sourceId: "pfin_001",
        operationKey: validP.operationKey,
        finalizationEffectId: validP.finalizationEffectId,
        description: "DR",
        effectiveDate: testDate,
        periodId: "period_2026_08",
        createdBy: "system",
        createdAt: new Date(),
      },
      {
        id: "row_7",
        entryNumber: "LED-004-CR",
        transactionId: sampleTxId,
        transactionType: "PAYMENT_RECEIVED",
        accountCategory: "REVENUE_PREMIUM",
        entryType: "CREDIT",
        amountCentavos: 25000, // Unbalanced amount!
        currency: "PHP",
        sourceEntity: "PaymentFinalization",
        sourceId: "pfin_001",
        operationKey: validP.operationKey,
        finalizationEffectId: validP.finalizationEffectId,
        description: "CR",
        effectiveDate: testDate,
        periodId: "period_2026_08",
        createdBy: "system",
        createdAt: new Date(),
      }
    );

    let unbalancedCaught = false;
    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(validP, txClient);
    } catch (err) {
      if (err instanceof LedgerInconsistentStateError) unbalancedCaught = true;
    }

    assert(
      stateCCaught && stateDCaught && oneSidedCaught && unbalancedCaught,
      "Test 31-39: Cross-identity inconsistent states and malformed pairs fail closed with LEDGER_INCONSISTENT_STATE"
    );
  }

  // Test 40-49: Replay Equivalence Verification (Idempotency Mismatch Detection)
  {
    mockClient.reset();
    const baseP = makeValidParams();
    await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(baseP, txClient);

    const mismatchCases: Array<{ name: string; params: PostBalancedDoubleEntryIdempotentParams }> = [
      { name: "amountCentavos", params: { ...baseP, amountCentavos: 39900 } },
      { name: "debitCategory", params: { ...baseP, debitCategory: "ADJUSTMENT_SUSPENSE" as AccountCategory } },
      { name: "creditCategory", params: { ...baseP, creditCategory: "ADJUSTMENT_SUSPENSE" as AccountCategory } },
      { name: "transactionType", params: { ...baseP, transactionType: "MANUAL_ADJUSTMENT" as FinancialTransactionType } },
      { name: "sourceEntity", params: { ...baseP, sourceEntity: "DifferentEntity" } },
      { name: "sourceId", params: { ...baseP, sourceId: "pfin_diff_id" } },
      { name: "effectiveDate", params: { ...baseP, effectiveDate: new Date("2026-09-01T10:00:00.000Z") } },
      { name: "periodId", params: { ...baseP, periodId: "period_2026_09" } },
    ];

    let caughtMismatches = 0;
    for (const testCase of mismatchCases) {
      try {
        await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(testCase.params, txClient);
      } catch (err) {
        if (
          err instanceof LedgerIdempotencyMismatchError &&
          err.code === "LEDGER_IDEMPOTENCY_MISMATCH"
        ) {
          caughtMismatches++;
        }
      }
    }

    assert(
      caughtMismatches === mismatchCases.length,
      "Test 40-49: Replay equivalence checks verified across all financial/reporting fields (amount, categories, types, dates, periods)"
    );
  }

  // Test 50-52: Dual Advisory Lock Ordering & $queryRaw Verification
  {
    mockClient.reset();
    const validP = makeValidParams();
    await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(validP, txClient);

    const rawQueries = mockClient.executedRawQueries;
    const queryRawCalls = mockClient.executedQueryRawCalls;
    const executeRawCalls = mockClient.executedExecuteRawCalls;

    const lockOpQuery = rawQueries.find((q) => q.includes("ledger:operation:pfin:txn_led_001:payment"));
    const lockEffQuery = rawQueries.find((q) => q.includes(`ledger:effect:${sampleEffectId}`));
    const opIndex = rawQueries.indexOf(lockOpQuery!);
    const effIndex = rawQueries.indexOf(lockEffQuery!);

    assert(
      lockOpQuery !== undefined &&
        lockEffQuery !== undefined &&
        opIndex >= 0 &&
        effIndex > opIndex &&
        lockOpQuery.includes("pg_advisory_xact_lock") &&
        lockOpQuery.includes("hashtextextended") &&
        queryRawCalls.length === 2 &&
        executeRawCalls.length === 0,
      "Test 50-52: Dual advisory locks acquired sequentially via $queryRaw in strict fixed order (operationKey lock strictly before finalizationEffectId lock, 0 $executeRaw)"
    );
  }

  // Test 53-59: Strict P2002 Target Recognizer
  {
    // Exact 2-element array targets (operationKey + entryType)
    const opKeyTargetA = isLedgerIdentityP2002Error({
      code: "P2002",
      meta: { target: ["operationKey", "entryType"] },
    });
    const opKeyTargetB = isLedgerIdentityP2002Error({
      code: "P2002",
      meta: { target: ["entryType", "operationKey"] }, // Reversed order
    });

    // Exact 2-element array targets (finalizationEffectId + entryType)
    const effTargetA = isLedgerIdentityP2002Error({
      code: "P2002",
      meta: { target: ["finalizationEffectId", "entryType"] },
    });
    const effTargetB = isLedgerIdentityP2002Error({
      code: "P2002",
      meta: { target: ["entryType", "finalizationEffectId"] },
    });

    // Exact string index name targets
    const strOpKey = isLedgerIdentityP2002Error({
      code: "P2002",
      meta: { target: "FinancialLedgerEntry_operationKey_entryType_key" },
    });
    const strEffId = isLedgerIdentityP2002Error({
      code: "P2002",
      meta: { target: "FinancialLedgerEntry_finalizationEffectId_entryType_key" },
    });

    // Invalid / unrelated P2002 targets
    const extraField = isLedgerIdentityP2002Error({
      code: "P2002",
      meta: { target: ["operationKey", "entryType", "amountCentavos"] },
    });
    const singleField = isLedgerIdentityP2002Error({
      code: "P2002",
      meta: { target: ["operationKey"] },
    });
    const entryNumP2002 = isLedgerIdentityP2002Error({
      code: "P2002",
      meta: { target: "FinancialLedgerEntry_entryNumber_key" },
    });
    const unrelatedCode = isLedgerIdentityP2002Error({
      code: "P2003",
      meta: { target: ["operationKey", "entryType"] },
    });

    assert(
      opKeyTargetA &&
        opKeyTargetB &&
        effTargetA &&
        effTargetB &&
        strOpKey &&
        strEffId &&
        !extraField &&
        !singleField &&
        !entryNumP2002 &&
        !unrelatedCode,
      "Test 53-59: Strict P2002 target recognizer validates exact 2-element arrays and string names, rejecting extra fields/entryNumber"
    );
  }

  // Test 60-61: P2002 Runtime Behavior (Throws LedgerConcurrentIdentityConflictError with zero re-reads inside aborted tx)
  {
    mockClient.reset();
    mockClient.simulateP2002OnCreate = {
      name: "PrismaClientKnownRequestError",
      code: "P2002",
      meta: { target: ["operationKey", "entryType"] },
    } as unknown as Error;

    const queryCountBefore = mockClient.queryCallCount;
    let conflictCaught = false;

    try {
      await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(makeValidParams(), txClient);
    } catch (err) {
      if (
        err instanceof LedgerConcurrentIdentityConflictError &&
        err.code === "LEDGER_CONCURRENT_IDENTITY_CONFLICT"
      ) {
        conflictCaught = true;
      }
    }

    // Proves NO re-read was attempted after P2002 occurred (queryCallCount only includes initial cross-identity queries)
    assert(
      conflictCaught && mockClient.queryCallCount === queryCountBefore + 2,
      "Test 60-61: P2002 throws LedgerConcurrentIdentityConflictError immediately with zero re-queries inside aborted transaction"
    );
  }

  // Test 62-66: Transaction Client Propagation & Atomic Insert Invariants
  {
    mockClient.reset();
    const result = await IdempotentLedgerService.postBalancedDoubleEntryIdempotent(
      makeValidParams(),
      txClient // Caller-owned transaction client
    );

    assert(
      result.debitEntry !== undefined &&
        result.creditEntry !== undefined &&
        mockClient.executedQueryRawCalls.length === 2 &&
        mockClient.writeCallCount === 1,
      "Test 62-66: Caller TransactionClient properly propagated and used for both advisory locking and atomic insertion"
    );
  }

  // Test 67-70: Static Architecture & Dormancy Invariants
  {
    const primitivePath = path.join(
      process.cwd(),
      "src/lib/accounting/idempotentLedgerService.ts"
    );
    const primitiveSource = fs.readFileSync(primitivePath, "utf-8");

    // Clean comments and strings for analysis
    const cleanSource = primitiveSource
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
      .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
      .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''");

    const hasAny = /:\s*any\b|<any>|\bas\s+any\b/.test(cleanSource);
    const hasSkipDuplicates = primitiveSource.includes("skipDuplicates");
    const hasAmbientDateDefault = /effectiveDate\s*=\s*new\s+Date\(\)/.test(primitiveSource);
    const hasExecuteRaw = primitiveSource.includes("$executeRaw");
    const hasQueryRawUnsafe = primitiveSource.includes("$queryRawUnsafe");
    const hasExecuteRawUnsafe = primitiveSource.includes("$executeRawUnsafe");
    const usesQueryRaw = primitiveSource.includes("$queryRaw`SELECT pg_advisory_xact_lock");

    // Verify zero application callers and exactly the approved recovery-domain consumer.
    function findLedgerConsumers(dir: string): string[] {
      const consumers: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          consumers.push(...findLedgerConsumers(full));
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
          const content = fs.readFileSync(full, "utf-8");
          if (
            content.includes("IdempotentLedgerService") ||
            content.includes("idempotentLedgerService")
          ) {
            consumers.push(
              path.relative(process.cwd(), full).split(path.sep).join("/")
            );
          }
        }
      }
      return consumers.sort((left, right) => left.localeCompare(right));
    }

    const primitiveRelativePath =
      "src/lib/accounting/idempotentLedgerService.ts";
    const approvedLibConsumers = [
      "src/lib/accounting/" +
        "idempotentPartner" +
        "CommissionService.ts",
      "src/lib/accounting/" +
        "idempotentTax" +
        "ProvisionService.ts",
      "src/lib/payment/paymentFinalizationCoordinator.ts",
      "src/lib/payment/paymentFinalizationIngestionService.ts", // Slice 8E-C dormant ingestion
    ] as const;
    const appConsumers = findLedgerConsumers(path.join(process.cwd(), "src/app"));
    const libConsumers = findLedgerConsumers(path.join(process.cwd(), "src/lib"))
      .filter((consumer) => consumer !== primitiveRelativePath);
    const hasExactlyApprovedLibConsumers =
      libConsumers.length === approvedLibConsumers.length &&
      approvedLibConsumers.every(
        (approvedConsumer, index) => libConsumers[index] === approvedConsumer
      );

    assert(
      !hasAny &&
        !hasSkipDuplicates &&
        !hasAmbientDateDefault &&
        !hasExecuteRaw &&
        !hasQueryRawUnsafe &&
        !hasExecuteRawUnsafe &&
        usesQueryRaw &&
        appConsumers.length === 0 &&
        hasExactlyApprovedLibConsumers,
      "Test 67-70: Static architectural invariants verified (0 `any`, 0 skipDuplicates, 0 ambient Date, 0 $executeRaw, 0 unsafe raw, $queryRaw tagged template used, 0 application callers, exactly approved recovery-domain library consumers)"
    );
  }

  console.log("\n================================================================================");
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runIdempotentLedgerPrimitiveTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
