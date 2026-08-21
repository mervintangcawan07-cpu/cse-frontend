// Relative Path: src/lib/accounting/taxService.ts
import { prisma } from "@/lib/prisma";
import { TaxCalculationBasis, TaxType, TaxStatus } from "./types";
import { calculatePercentageShareCentavos, deterministicRound, sanitizePercentage } from "./money";
import { LedgerService } from "./ledgerService";

export interface CreateTaxConfigInput {
  name: string;
  taxType: TaxType;
  rate: number;
  fixedAmountCentavos?: number;
  calculationBasis: TaxCalculationBasis;
  effectiveDate?: Date;
  expirationDate?: Date;
  notes?: string;
  adminUserId?: string;
}

export class TaxService {
  /**
   * Registers a new configurable tax policy.
   */
  static async createTaxConfig(input: CreateTaxConfigInput) {
    const safeRate = sanitizePercentage(input.rate, 0.0);

    return prisma.taxConfiguration.create({
      data: {
        name: input.name.trim(),
        taxType: input.taxType,
        rate: safeRate,
        fixedAmountCentavos: input.fixedAmountCentavos ?? 0,
        calculationBasis: input.calculationBasis,
        effectiveDate: input.effectiveDate ?? new Date(),
        expirationDate: input.expirationDate,
        notes: input.notes?.trim(),
        createdBy: input.adminUserId,
      },
    });
  }

  /**
   * Evaluates active tax rules for a transaction.
   */
  static async evaluateTransactionTaxes(params: {
    transactionId: string;
    customerPaymentCentavos: number;
    grossAmountCentavos: number;
  }) {
    const now = new Date();
    const activeTaxes = await prisma.taxConfiguration.findMany({
      where: {
        status: "ACTIVE",
        effectiveDate: { lte: now },
        OR: [{ expirationDate: null }, { expirationDate: { gte: now } }],
      },
    });

    if (!activeTaxes.length) return [];

    const createdRecords = [];

    for (const tax of activeTaxes) {
      let taxableAmountCentavos = params.customerPaymentCentavos;

      if (tax.calculationBasis === "GROSS_SALE") {
        taxableAmountCentavos = params.grossAmountCentavos;
      }

      let taxAmountCentavos = 0;
      if (tax.rate > 0) {
        taxAmountCentavos = calculatePercentageShareCentavos(taxableAmountCentavos, tax.rate);
      } else if ((tax.fixedAmountCentavos || 0) > 0) {
        taxAmountCentavos = deterministicRound(tax.fixedAmountCentavos || 0);
      }

      if (taxAmountCentavos > 0) {
        const record = await prisma.taxRecord.create({
          data: {
            taxConfigId: tax.id,
            transactionId: params.transactionId,
            taxableAmountCentavos,
            appliedRate: tax.rate,
            taxAmountCentavos,
            calculationBasis: tax.calculationBasis,
            status: "PROVISIONED",
          },
        });

        // Record in double-entry ledger: Debit EXPENSE_TAX, Credit LIABILITY_TAX_PAYABLE
        await LedgerService.postBalancedDoubleEntry({
          transactionId: params.transactionId,
          transactionType: "TAX_PROVISION",
          debitCategory: "EXPENSE_TAX",
          creditCategory: "LIABILITY_TAX_PAYABLE",
          amountCentavos: taxAmountCentavos,
          sourceEntity: "TaxRecord",
          sourceId: record.id,
          description: `Tax provision for ${tax.name} (${tax.rate}%) on Transaction ${params.transactionId}`,
        });

        createdRecords.push(record);
      }
    }

    return createdRecords;
  }
}
