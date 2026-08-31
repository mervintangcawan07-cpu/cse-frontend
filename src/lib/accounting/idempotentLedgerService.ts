// Relative Path: src/lib/accounting/idempotentLedgerService.ts
/**
 * GovStudyX Durable Payment Finalization Recovery Engine (Phase 1 / Slice 3)
 *
 * Idempotent balanced double-entry ledger posting primitive for payment-finalization recovery.
 * Provides dual transaction-scoped advisory locking, cross-identity state evaluation,
 * strict atomic pair creation, exact replay verification, and abort-safe P2002 conflict classification.
 *
 * STRICTLY DORMANT IN SLICE 3 — ZERO PRODUCTION CALLERS OR CUTOVER.
 */

import { Prisma, FinancialLedgerEntry } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AccountCategory,
  FinancialTransactionType,
  LedgerEntryType,
} from "./types";
import { LedgerService } from "./ledgerService";
import {
  buildPaymentFinalizationOperationKey,
  validateTransactionId,
} from "@/lib/payment/paymentFinalizationContracts";

// ============================================================================
// CLOSED LEDGER OPERATION CONTRACT (SLICE 3 SUPPORTS EXACTLY 4 FAMILIES)
// ============================================================================

export type FinalizationLedgerOperation =
  | { readonly kind: "PAYMENT" }
  | { readonly kind: "FEE" }
  | { readonly kind: "PARTNER_LIABILITY" }
  | { readonly kind: "TAX"; readonly taxConfigId: string };

// ============================================================================
// CLOSED ERROR CODES & HIERARCHY
// ============================================================================

export type LedgerErrorCode =
  | "LEDGER_IDEMPOTENCY_MISMATCH"
  | "LEDGER_INCONSISTENT_STATE"
  | "INVALID_LEDGER_AMOUNT"
  | "INVALID_LEDGER_OPERATION_KEY"
  | "INVALID_LEDGER_FINALIZATION_EFFECT_ID"
  | "INVALID_LEDGER_TRANSACTION_ID"
  | "INVALID_LEDGER_OPERATION_MISMATCH"
  | "INVALID_LEDGER_CURRENCY"
  | "INVALID_LEDGER_EFFECTIVE_DATE"
  | "LEDGER_CONCURRENT_IDENTITY_CONFLICT";

export class IdempotentLedgerError extends Error {
  public readonly code: LedgerErrorCode;

  constructor(message: string, code: LedgerErrorCode) {
    super(message);
    this.name = "IdempotentLedgerError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidLedgerAmountError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "INVALID_LEDGER_AMOUNT");
    this.name = "InvalidLedgerAmountError";
  }
}

export class InvalidLedgerOperationKeyError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "INVALID_LEDGER_OPERATION_KEY");
    this.name = "InvalidLedgerOperationKeyError";
  }
}

export class InvalidLedgerFinalizationEffectIdError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "INVALID_LEDGER_FINALIZATION_EFFECT_ID");
    this.name = "InvalidLedgerFinalizationEffectIdError";
  }
}

export class InvalidLedgerTransactionIdError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "INVALID_LEDGER_TRANSACTION_ID");
    this.name = "InvalidLedgerTransactionIdError";
  }
}

export class InvalidLedgerOperationMismatchError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "INVALID_LEDGER_OPERATION_MISMATCH");
    this.name = "InvalidLedgerOperationMismatchError";
  }
}

export class InvalidLedgerCurrencyError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "INVALID_LEDGER_CURRENCY");
    this.name = "InvalidLedgerCurrencyError";
  }
}

export class InvalidLedgerEffectiveDateError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "INVALID_LEDGER_EFFECTIVE_DATE");
    this.name = "InvalidLedgerEffectiveDateError";
  }
}

export class LedgerInconsistentStateError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "LEDGER_INCONSISTENT_STATE");
    this.name = "LedgerInconsistentStateError";
  }
}

export class LedgerIdempotencyMismatchError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "LEDGER_IDEMPOTENCY_MISMATCH");
    this.name = "LedgerIdempotencyMismatchError";
  }
}

export class LedgerConcurrentIdentityConflictError extends IdempotentLedgerError {
  constructor(message: string) {
    super(message, "LEDGER_CONCURRENT_IDENTITY_CONFLICT");
    this.name = "LedgerConcurrentIdentityConflictError";
  }
}

// ============================================================================
// INPUT & RESULT INTERFACES
// ============================================================================

export interface PostBalancedDoubleEntryIdempotentParams {
  readonly transactionId: string;
  readonly finalizationEffectId: string;
  readonly operation: FinalizationLedgerOperation;
  readonly operationKey: string;

  readonly transactionType: FinancialTransactionType;
  readonly debitCategory: AccountCategory;
  readonly creditCategory: AccountCategory;

  readonly amountCentavos: number;
  readonly currency?: string;

  readonly sourceEntity: string;
  readonly sourceId: string;

  readonly description: string;

  readonly effectiveDate: Date;
  readonly periodId?: string | null;
  readonly createdBy?: string | null;
}

export interface PostBalancedDoubleEntryResult {
  readonly debitEntry: FinancialLedgerEntry;
  readonly creditEntry: FinancialLedgerEntry;
  readonly isReplay: boolean;
}

// ============================================================================
// STRICT P2002 RECOGNIZER
// ============================================================================

/**
 * Classifies whether a Prisma error is a recognized composite unique violation
 * on FinancialLedgerEntry identity indexes:
 *   - (operationKey, entryType)
 *   - (finalizationEffectId, entryType)
 */
export function isLedgerIdentityP2002Error(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const prismaError = error as { code?: string; meta?: { target?: unknown } };
  if (prismaError.code !== "P2002" || !prismaError.meta) return false;

  const target = prismaError.meta.target;

  if (Array.isArray(target)) {
    if (target.length !== 2) return false;
    const targetSet = new Set(target.map(String));
    const isOpKeyTarget = targetSet.has("operationKey") && targetSet.has("entryType");
    const isEffectIdTarget =
      targetSet.has("finalizationEffectId") && targetSet.has("entryType");
    return isOpKeyTarget || isEffectIdTarget;
  }

  if (typeof target === "string") {
    return (
      target === "FinancialLedgerEntry_operationKey_entryType_key" ||
      target === "FinancialLedgerEntry_finalizationEffectId_entryType_key"
    );
  }

  return false;
}

// ============================================================================
// IDEMPOTENT LEDGER PRIMITIVE SERVICE
// ============================================================================

export class IdempotentLedgerService {
  /**
   * Posts an idempotent balanced pair of double-entry ledger entries (one DEBIT, one CREDIT).
   * Supports both caller-owned transaction clients and standalone self-owned transactions.
   */
  static async postBalancedDoubleEntryIdempotent(
    params: PostBalancedDoubleEntryIdempotentParams,
    callerClient?: Prisma.TransactionClient
  ): Promise<PostBalancedDoubleEntryResult> {
    if (callerClient) {
      return IdempotentLedgerService.executeInsideTx(params, callerClient);
    }
    return prisma.$transaction(async (tx) => {
      return IdempotentLedgerService.executeInsideTx(params, tx);
    });
  }

  /**
   * Core execution pipeline executed strictly inside an active transaction client.
   */
  private static async executeInsideTx(
    params: PostBalancedDoubleEntryIdempotentParams,
    client: Prisma.TransactionClient
  ): Promise<PostBalancedDoubleEntryResult> {
    // 🔒 1. MONEY VALIDATION (Strict positive safe integer centavos)
    const amount = params.amountCentavos;
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      throw new InvalidLedgerAmountError(
        `amountCentavos must be a positive safe integer. Received: ${amount}`
      );
    }

    // 🔒 2. CURRENCY VALIDATION (GovStudyX ledger is strictly PHP-only)
    if (params.currency !== undefined && params.currency !== null) {
      if (typeof params.currency !== "string" || params.currency.trim().toUpperCase() !== "PHP") {
        throw new InvalidLedgerCurrencyError(
          `Unsupported ledger currency "${params.currency}". Only "PHP" is supported.`
        );
      }
    }
    const currency = "PHP";

    // 🔒 3. EFFECTIVE DATE VALIDATION (Must be explicit valid Date)
    if (!(params.effectiveDate instanceof Date) || isNaN(params.effectiveDate.getTime())) {
      throw new InvalidLedgerEffectiveDateError(
        "effectiveDate must be an explicit, valid non-null Date."
      );
    }

    // 🔒 4. TRANSACTION & EFFECT IDENTITY VALIDATION
    let validatedTxId: string;
    try {
      validatedTxId = validateTransactionId(params.transactionId);
    } catch (err) {
      throw new InvalidLedgerTransactionIdError(
        `Invalid transactionId: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!params.finalizationEffectId || typeof params.finalizationEffectId !== "string") {
      throw new InvalidLedgerFinalizationEffectIdError(
        "finalizationEffectId must be a non-empty string."
      );
    }
    const trimmedEffectId = params.finalizationEffectId.trim();
    if (trimmedEffectId.length === 0 || trimmedEffectId.length > 128) {
      throw new InvalidLedgerFinalizationEffectIdError(
        "finalizationEffectId must be non-empty and within 128 characters."
      );
    }

    // 🔒 5. CLOSED OPERATION FAMILY & KEY AGREEMENT
    if (
      !params.operation ||
      (params.operation.kind !== "PAYMENT" &&
        params.operation.kind !== "FEE" &&
        params.operation.kind !== "PARTNER_LIABILITY" &&
        params.operation.kind !== "TAX")
    ) {
      throw new InvalidLedgerOperationMismatchError(
        `Unsupported ledger operation kind: "${(params.operation as { kind?: unknown })?.kind}". Only PAYMENT, FEE, PARTNER_LIABILITY, and TAX are valid for ledger posting.`
      );
    }

    let expectedOperationKey: string;
    try {
      expectedOperationKey = buildPaymentFinalizationOperationKey(
        validatedTxId,
        params.operation
      );
    } catch (err) {
      throw new InvalidLedgerOperationKeyError(
        `Failed to derive expected operation key: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!params.operationKey || typeof params.operationKey !== "string") {
      throw new InvalidLedgerOperationKeyError("operationKey must be a non-empty string.");
    }
    if (params.operationKey !== expectedOperationKey) {
      throw new InvalidLedgerOperationMismatchError(
        `operationKey mismatch: provided "${params.operationKey}" does not match derived canonical key "${expectedOperationKey}".`
      );
    }
    const exactOpKey = expectedOperationKey;

    // 🔒 6. DUAL ADVISORY LOCKING (Fixed sequential order: operation key THEN effect ID)
    const opLockName = `ledger:operation:${exactOpKey}`;
    const effectLockName = `ledger:effect:${trimmedEffectId}`;

    await client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${opLockName}, 0))`;
    await client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${effectLockName}, 0))`;

    // 🔒 7. CROSS-IDENTITY STATE QUERY
    const byOpKey = await client.financialLedgerEntry.findMany({
      where: { operationKey: exactOpKey },
      orderBy: { entryType: "asc" },
    });

    const byEffectId = await client.financialLedgerEntry.findMany({
      where: { finalizationEffectId: trimmedEffectId },
      orderBy: { entryType: "asc" },
    });

    // 🔒 8. CROSS-IDENTITY STATE MACHINE EVALUATION
    if (byOpKey.length === 0 && byEffectId.length === 0) {
      // STATE A: Fresh write -> Proceed to atomic pair insertion
      return IdempotentLedgerService.insertFreshPair(
        params,
        validatedTxId,
        trimmedEffectId,
        exactOpKey,
        currency,
        client
      );
    }

    if (byOpKey.length === 2 && byEffectId.length === 2) {
      // Check if both identity sets identify the exact same row IDs
      const opRowIds = new Set(byOpKey.map((r) => r.id));
      const allRowIdsMatch = byEffectId.every((r) => opRowIds.has(r.id));

      if (allRowIdsMatch) {
        // STATE B: Existing pair -> Validate pair structure and replay equivalence
        return IdempotentLedgerService.validateAndReplayExistingPair(
          params,
          byOpKey,
          validatedTxId,
          trimmedEffectId,
          exactOpKey,
          currency
        );
      }
    }

    // STATES C, D, E, F, G: Inconsistent state detected across identity dimensions
    throw new LedgerInconsistentStateError(
      `Inconsistent ledger state detected for operationKey "${exactOpKey}" (${byOpKey.length} rows) and finalizationEffectId "${trimmedEffectId}" (${byEffectId.length} rows).`
    );
  }

  /**
   * Validates structural integrity and immutable replay equivalence for existing row pair (State B).
   */
  private static validateAndReplayExistingPair(
    params: PostBalancedDoubleEntryIdempotentParams,
    existingRows: FinancialLedgerEntry[],
    validatedTxId: string,
    trimmedEffectId: string,
    exactOpKey: string,
    currency: string
  ): PostBalancedDoubleEntryResult {
    // 1. Structure validation
    const debitEntries = existingRows.filter((r) => r.entryType === "DEBIT");
    const creditEntries = existingRows.filter((r) => r.entryType === "CREDIT");

    if (debitEntries.length !== 1 || creditEntries.length !== 1) {
      throw new LedgerInconsistentStateError(
        `Malformed ledger pair: expected exactly 1 DEBIT and 1 CREDIT, found ${debitEntries.length} DEBIT and ${creditEntries.length} CREDIT.`
      );
    }

    const debitEntry = debitEntries[0];
    const creditEntry = creditEntries[0];

    if (
      debitEntry.operationKey !== exactOpKey ||
      creditEntry.operationKey !== exactOpKey ||
      debitEntry.finalizationEffectId !== trimmedEffectId ||
      creditEntry.finalizationEffectId !== trimmedEffectId
    ) {
      throw new LedgerInconsistentStateError(
        "Malformed ledger pair: operationKey or finalizationEffectId mismatch on existing rows."
      );
    }

    if (
      debitEntry.amountCentavos !== creditEntry.amountCentavos ||
      debitEntry.currency !== creditEntry.currency
    ) {
      throw new LedgerInconsistentStateError(
        "Malformed ledger pair: DEBIT and CREDIT amount or currency do not balance."
      );
    }

    // 2. Replay Equivalence Check (financial and reporting fields must match exactly)
    const mismatches: string[] = [];

    if (debitEntry.transactionId !== validatedTxId) {
      mismatches.push(`transactionId (existing: "${debitEntry.transactionId}", requested: "${validatedTxId}")`);
    }
    if (debitEntry.transactionType !== params.transactionType) {
      mismatches.push(`transactionType (existing: "${debitEntry.transactionType}", requested: "${params.transactionType}")`);
    }
    if (debitEntry.accountCategory !== params.debitCategory) {
      mismatches.push(`debitCategory (existing: "${debitEntry.accountCategory}", requested: "${params.debitCategory}")`);
    }
    if (creditEntry.accountCategory !== params.creditCategory) {
      mismatches.push(`creditCategory (existing: "${creditEntry.accountCategory}", requested: "${params.creditCategory}")`);
    }
    if (debitEntry.amountCentavos !== params.amountCentavos) {
      mismatches.push(`amountCentavos (existing: ${debitEntry.amountCentavos}, requested: ${params.amountCentavos})`);
    }
    if (debitEntry.currency !== currency) {
      mismatches.push(`currency (existing: "${debitEntry.currency}", requested: "${currency}")`);
    }
    if (debitEntry.sourceEntity !== params.sourceEntity) {
      mismatches.push(`sourceEntity (existing: "${debitEntry.sourceEntity}", requested: "${params.sourceEntity}")`);
    }
    if (debitEntry.sourceId !== params.sourceId) {
      mismatches.push(`sourceId (existing: "${debitEntry.sourceId}", requested: "${params.sourceId}")`);
    }
    if (debitEntry.effectiveDate.toISOString() !== params.effectiveDate.toISOString()) {
      mismatches.push(
        `effectiveDate (existing: "${debitEntry.effectiveDate.toISOString()}", requested: "${params.effectiveDate.toISOString()}")`
      );
    }
    const existingPeriodId = debitEntry.periodId ?? null;
    const requestedPeriodId = params.periodId ?? null;
    if (existingPeriodId !== requestedPeriodId) {
      mismatches.push(`periodId (existing: "${existingPeriodId}", requested: "${requestedPeriodId}")`);
    }

    if (mismatches.length > 0) {
      throw new LedgerIdempotencyMismatchError(
        `Idempotency payload mismatch on existing ledger pair: ${mismatches.join(", ")}.`
      );
    }

    return {
      debitEntry,
      creditEntry,
      isReplay: true,
    };
  }

  /**
   * Inserts a fresh balanced double-entry pair atomically (State A).
   */
  private static async insertFreshPair(
    params: PostBalancedDoubleEntryIdempotentParams,
    validatedTxId: string,
    trimmedEffectId: string,
    exactOpKey: string,
    currency: string,
    client: Prisma.TransactionClient
  ): Promise<PostBalancedDoubleEntryResult> {
    const debitEntryNumber = LedgerService.generateEntryNumber("DR");
    const creditEntryNumber = LedgerService.generateEntryNumber("CR");

    const debitData: Prisma.FinancialLedgerEntryCreateManyInput = {
      entryNumber: debitEntryNumber,
      transactionId: validatedTxId,
      transactionType: params.transactionType,
      accountCategory: params.debitCategory,
      entryType: "DEBIT",
      amountCentavos: params.amountCentavos,
      currency,
      sourceEntity: params.sourceEntity,
      sourceId: params.sourceId,
      operationKey: exactOpKey,
      finalizationEffectId: trimmedEffectId,
      description: `${params.description} (DR)`,
      effectiveDate: params.effectiveDate,
      periodId: params.periodId ?? null,
      createdBy: params.createdBy ?? null,
    };

    const creditData: Prisma.FinancialLedgerEntryCreateManyInput = {
      entryNumber: creditEntryNumber,
      transactionId: validatedTxId,
      transactionType: params.transactionType,
      accountCategory: params.creditCategory,
      entryType: "CREDIT",
      amountCentavos: params.amountCentavos,
      currency,
      sourceEntity: params.sourceEntity,
      sourceId: params.sourceId,
      operationKey: exactOpKey,
      finalizationEffectId: trimmedEffectId,
      description: `${params.description} (CR)`,
      effectiveDate: params.effectiveDate,
      periodId: params.periodId ?? null,
      createdBy: params.createdBy ?? null,
    };

    try {
      const createdRows = await client.financialLedgerEntry.createManyAndReturn({
        data: [debitData, creditData],
      });

      const debitEntry = createdRows.find((r) => r.entryType === "DEBIT");
      const creditEntry = createdRows.find((r) => r.entryType === "CREDIT");

      if (!debitEntry || !creditEntry || createdRows.length !== 2) {
        throw new LedgerInconsistentStateError(
          "Failed to insert complete balanced ledger pair atomically."
        );
      }

      return {
        debitEntry,
        creditEntry,
        isReplay: false,
      };
    } catch (err: unknown) {
      if (isLedgerIdentityP2002Error(err)) {
        throw new LedgerConcurrentIdentityConflictError(
          "Concurrent identity collision detected on FinancialLedgerEntry unique constraints. Transaction rolled back for caller retry."
        );
      }
      throw err;
    }
  }
}
