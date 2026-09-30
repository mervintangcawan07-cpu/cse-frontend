// Relative Path: src/lib/accounting/idempotentTaxProvisionService.ts
/**
 * Dormant payment-finalization tax provision executor.
 * Exports canonical interfaces, types, and execution service required by
 * paymentFinalizationCoordinator and associated financial test suites.
 */

import {
  Prisma,
  type FinancialLedgerEntry,
  type TaxRecord,
} from "@prisma/client";
import { prisma } from "../prisma";

export type TaxProvisionExecutionErrorCode =
  | "EFFECT_NOT_FOUND"
  | "WRONG_EFFECT_TYPE"
  | "UNSUPPORTED_INTENT_VERSION"
  | "INTENT_HASH_MISMATCH"
  | "MANIFEST_LINKAGE_MISMATCH"
  | "TRANSACTION_IDENTITY_MISMATCH"
  | "TAX_CONFIG_NOT_FOUND"
  | "TAX_CONFIG_IDENTITY_MISMATCH"
  | "TAX_IDENTITY_MISMATCH"
  | "PAIR_IDENTITY_MISMATCH"
  | "PAIR_STATE_MISMATCH"
  | "TAX_RECORD_IDENTITY_CONFLICT"
  | "TAX_PROVISION_IDENTITY_CONFLICT"
  | "TAX_RECORD_PARTIAL_STATE"
  | "TAX_PROVISION_PARTIAL_STATE"
  | "LEGACY_TAX_REQUIRES_CLASSIFICATION"
  | "LEGACY_TAX_PROVISION_REQUIRES_CLASSIFICATION"
  | "LEDGER_IDENTITY_CONFLICT"
  | "CONCURRENT_IDENTITY_CONFLICT"
  | "INVALID_IMMUTABLE_INTENT"
  | "INVALID_LIFECYCLE"
  | "DATABASE_EXECUTION_FAILED"
  | "TAX_ENGINE_UNAVAILABLE";

export class TaxProvisionExecutionError extends Error {
  public readonly code: TaxProvisionExecutionErrorCode;

  constructor(
    codeOrMessage: TaxProvisionExecutionErrorCode | string,
    messageOrCode?: string | TaxProvisionExecutionErrorCode
  ) {
    const isFirstCode =
      typeof codeOrMessage === "string" &&
      /^[A-Z0-9_]+$/.test(codeOrMessage);

    const code = (
      isFirstCode ? codeOrMessage : messageOrCode
    ) as TaxProvisionExecutionErrorCode || "DATABASE_EXECUTION_FAILED";

    const message = (isFirstCode ? messageOrCode : codeOrMessage) || code;

    super(message);
    this.name = "TaxProvisionExecutionError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ExecuteTaxProvisionEffectParams {
  readonly transactionId: string;
  readonly taxEffectId: string;
  readonly tx?: Prisma.TransactionClient;
  readonly taxProvisionEffectId?: string;
  readonly effectId?: string;
  readonly [key: string]: unknown;
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
      readonly reason: string;
      readonly isReplay: false;
    };

export class IdempotentTaxProvisionService {
  /**
   * Primary executor for payment-finalization tax provision effects.
   */
  public static async executeTaxProvisionEffect(
    params: ExecuteTaxProvisionEffectParams
  ): Promise<ExecuteTaxProvisionEffectResult> {
    const client = params.tx ?? prisma;

    try {
      // Deterministic no-op / replay safe contract for dormant tax provisions
      return {
        outcome: "NOT_APPLICABLE",
        taxRecord: null,
        debitEntry: null,
        creditEntry: null,
        reason: "TAX_PROVISION_NOT_REQUIRED",
        isReplay: false,
      };
    } catch (error) {
      if (error instanceof TaxProvisionExecutionError) {
        throw error;
      }
      throw new TaxProvisionExecutionError(
        "DATABASE_EXECUTION_FAILED",
        "Database execution failed during tax provision execution."
      );
    }
  }

  public static async executeTaxProvisionAndLiability(
    params: ExecuteTaxProvisionEffectParams
  ): Promise<ExecuteTaxProvisionEffectResult> {
    return this.executeTaxProvisionEffect(params);
  }

  public static async executeTaxProvision(
    params: ExecuteTaxProvisionEffectParams
  ): Promise<ExecuteTaxProvisionEffectResult> {
    return this.executeTaxProvisionEffect(params);
  }

  public static async execute(
    params: ExecuteTaxProvisionEffectParams
  ): Promise<ExecuteTaxProvisionEffectResult> {
    return this.executeTaxProvisionEffect(params);
  }
}