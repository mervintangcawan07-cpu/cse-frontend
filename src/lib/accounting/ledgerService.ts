// Relative Path: src/lib/accounting/ledgerService.ts
import { prisma } from "@/lib/prisma";
import {
  AccountCategory,
  FinancialTransactionType,
  LedgerEntryType,
} from "./types";
import { deterministicRound } from "./money";

export interface CreateLedgerEntryInput {
  transactionId?: string;
  transactionType: FinancialTransactionType;
  accountCategory: AccountCategory;
  entryType: LedgerEntryType;
  amountCentavos: number;
  sourceEntity: string;
  sourceId: string;
  description: string;
  effectiveDate?: Date;
  periodId?: string;
  createdBy?: string;
}

export class LedgerService {
  /**
   * Generates a unique sequential entry number (e.g. LED-000042).
   */
  static async generateEntryNumber(): Promise<string> {
    const count = await prisma.financialLedgerEntry.count();
    const seq = (count + 1).toString().padStart(6, "0");
    return `LED-${seq}`;
  }

  /**
   * Posts a pair of balanced double-entry ledger entries.
   */
  static async postBalancedDoubleEntry(params: {
    transactionId?: string;
    transactionType: FinancialTransactionType;
    debitCategory: AccountCategory;
    creditCategory: AccountCategory;
    amountCentavos: number;
    sourceEntity: string;
    sourceId: string;
    description: string;
    effectiveDate?: Date;
    periodId?: string;
    createdBy?: string;
  }) {
    const {
      transactionId,
      transactionType,
      debitCategory,
      creditCategory,
      amountCentavos,
      sourceEntity,
      sourceId,
      description,
      effectiveDate = new Date(),
      periodId,
      createdBy,
    } = params;

    if (amountCentavos <= 0) return [];

    const safeAmount = deterministicRound(amountCentavos);
    const count = await prisma.financialLedgerEntry.count();
    const entryNumDebit = `LED-${(count + 1).toString().padStart(6, "0")}`;
    const entryNumCredit = `LED-${(count + 2).toString().padStart(6, "0")}`;

    const [debitEntry, creditEntry] = await prisma.$transaction([
      prisma.financialLedgerEntry.create({
        data: {
          entryNumber: entryNumDebit,
          transactionId,
          transactionType,
          accountCategory: debitCategory,
          entryType: "DEBIT",
          amountCentavos: safeAmount,
          currency: "PHP",
          sourceEntity,
          sourceId,
          description: `${description} [DEBIT ${debitCategory}]`,
          effectiveDate,
          periodId,
          createdBy,
        },
      }),
      prisma.financialLedgerEntry.create({
        data: {
          entryNumber: entryNumCredit,
          transactionId,
          transactionType,
          accountCategory: creditCategory,
          entryType: "CREDIT",
          amountCentavos: safeAmount,
          currency: "PHP",
          sourceEntity,
          sourceId,
          description: `${description} [CREDIT ${creditCategory}]`,
          effectiveDate,
          periodId,
          createdBy,
        },
      }),
    ]);

    return [debitEntry, creditEntry];
  }

  /**
   * Records a verified customer payment in the double-entry ledger.
   * Debit: CASH_PAYMONGO, Credit: REVENUE_PREMIUM
   */
  static async recordPaymentReceived(params: {
    transactionId: string;
    amountCentavos: number;
    userId: string;
    planType: string;
  }) {
    return this.postBalancedDoubleEntry({
      transactionId: params.transactionId,
      transactionType: "PAYMENT_RECEIVED",
      debitCategory: "CASH_PAYMONGO",
      creditCategory: "REVENUE_PREMIUM",
      amountCentavos: params.amountCentavos,
      sourceEntity: "Transaction",
      sourceId: params.transactionId,
      description: `Payment received for ${params.planType} subscription (User ${params.userId})`,
    });
  }

  /**
   * Records payment processing fees.
   * Debit: EXPENSE_PAYMENT_FEE, Credit: CASH_PAYMONGO
   */
  static async recordPaymentFee(params: {
    transactionId: string;
    feeAmountCentavos: number;
  }) {
    if (params.feeAmountCentavos <= 0) return [];
    return this.postBalancedDoubleEntry({
      transactionId: params.transactionId,
      transactionType: "PAYMONGO_FEE",
      debitCategory: "EXPENSE_PAYMENT_FEE",
      creditCategory: "CASH_PAYMONGO",
      amountCentavos: params.feeAmountCentavos,
      sourceEntity: "Transaction",
      sourceId: params.transactionId,
      description: `PayMongo processing fee for Transaction ${params.transactionId}`,
    });
  }

  /**
   * Records referral reward commission liability.
   * Debit: EXPENSE_REFERRAL, Credit: LIABILITY_REFERRAL_PAYABLE
   */
  static async recordReferralLiability(params: {
    transactionId: string;
    rewardId: string;
    amountCentavos: number;
    inviterId: string;
  }) {
    return this.postBalancedDoubleEntry({
      transactionId: params.transactionId,
      transactionType: "REFERRAL_COMMISSION",
      debitCategory: "EXPENSE_REFERRAL",
      creditCategory: "LIABILITY_REFERRAL_PAYABLE",
      amountCentavos: params.amountCentavos,
      sourceEntity: "ReferralReward",
      sourceId: params.rewardId,
      description: `Referral commission liability earned by Inviter ${params.inviterId}`,
    });
  }

  /**
   * Records partner commission liability.
   * Debit: EXPENSE_PARTNER, Credit: LIABILITY_PARTNER_PAYABLE
   */
  static async recordPartnerLiability(params: {
    transactionId: string;
    commissionId: string;
    partnerId: string;
    amountCentavos: number;
  }) {
    return this.postBalancedDoubleEntry({
      transactionId: params.transactionId,
      transactionType: "PARTNER_COMMISSION",
      debitCategory: "EXPENSE_PARTNER",
      creditCategory: "LIABILITY_PARTNER_PAYABLE",
      amountCentavos: params.amountCentavos,
      sourceEntity: "PartnerCommission",
      sourceId: params.commissionId,
      description: `Partner commission liability for Partner ${params.partnerId}`,
    });
  }

  /**
   * Records payout disbursement.
   * Debit: LIABILITY_REFERRAL_PAYABLE | LIABILITY_PARTNER_PAYABLE, Credit: CASH_PAYMONGO
   */
  static async recordPayoutDisbursement(params: {
    payoutId: string;
    payoutType: "REFERRAL" | "PARTNER";
    recipientId: string;
    amountCentavos: number;
    method: string;
    referenceNumber?: string;
    adminUserId?: string;
  }) {
    const liabilityCategory: AccountCategory =
      params.payoutType === "REFERRAL"
        ? "LIABILITY_REFERRAL_PAYABLE"
        : "LIABILITY_PARTNER_PAYABLE";

    return this.postBalancedDoubleEntry({
      transactionType: "PAYOUT_DISBURSEMENT",
      debitCategory: liabilityCategory,
      creditCategory: "CASH_PAYMONGO",
      amountCentavos: params.amountCentavos,
      sourceEntity: params.payoutType === "REFERRAL" ? "ReferralPayout" : "PartnerPayout",
      sourceId: params.payoutId,
      description: `Payout fulfilled via ${params.method} (Ref: ${params.referenceNumber || "N/A"})`,
      createdBy: params.adminUserId,
    });
  }

  /**
   * Records refund or chargeback reversal in the ledger.
   */
  static async recordRefundReversal(params: {
    transactionId: string;
    refundAmountCentavos: number;
    referralRewardId?: string;
    referralRewardCentavos?: number;
    partnerCommissionId?: string;
    partnerCommissionCentavos?: number;
    reason: string;
  }) {
    const results = [];

    // 1. Reverse Revenue: Debit REVENUE_PREMIUM, Credit CASH_PAYMONGO
    const revEntries = await this.postBalancedDoubleEntry({
      transactionId: params.transactionId,
      transactionType: "REFUND_REVERSAL",
      debitCategory: "REVENUE_PREMIUM",
      creditCategory: "CASH_PAYMONGO",
      amountCentavos: params.refundAmountCentavos,
      sourceEntity: "Transaction",
      sourceId: params.transactionId,
      description: `Refund reversal: ${params.reason}`,
    });
    results.push(...revEntries);

    // 2. Reverse Referral Liability if present: Debit LIABILITY_REFERRAL_PAYABLE, Credit EXPENSE_REFERRAL
    if (params.referralRewardId && (params.referralRewardCentavos || 0) > 0) {
      const refEntries = await this.postBalancedDoubleEntry({
        transactionId: params.transactionId,
        transactionType: "REFUND_REVERSAL",
        debitCategory: "LIABILITY_REFERRAL_PAYABLE",
        creditCategory: "EXPENSE_REFERRAL",
        amountCentavos: params.referralRewardCentavos!,
        sourceEntity: "ReferralReward",
        sourceId: params.referralRewardId,
        description: `Reversal of referral commission liability on refund`,
      });
      results.push(...refEntries);
    }

    // 3. Reverse Partner Liability if present: Debit LIABILITY_PARTNER_PAYABLE, Credit EXPENSE_PARTNER
    if (params.partnerCommissionId && (params.partnerCommissionCentavos || 0) > 0) {
      const ptrEntries = await this.postBalancedDoubleEntry({
        transactionId: params.transactionId,
        transactionType: "REFUND_REVERSAL",
        debitCategory: "LIABILITY_PARTNER_PAYABLE",
        creditCategory: "EXPENSE_PARTNER",
        amountCentavos: params.partnerCommissionCentavos!,
        sourceEntity: "PartnerCommission",
        sourceId: params.partnerCommissionId,
        description: `Reversal of partner commission liability on refund`,
      });
      results.push(...ptrEntries);
    }

    return results;
  }

  /**
   * Verifies total debit vs credit balancing of the entire ledger.
   */
  static async verifyLedgerBalance(): Promise<{
    isBalanced: boolean;
    totalDebitCentavos: number;
    totalCreditCentavos: number;
    differenceCentavos: number;
  }> {
    const [debitAgg, creditAgg] = await Promise.all([
      prisma.financialLedgerEntry.aggregate({
        _sum: { amountCentavos: true },
        where: { entryType: "DEBIT" },
      }),
      prisma.financialLedgerEntry.aggregate({
        _sum: { amountCentavos: true },
        where: { entryType: "CREDIT" },
      }),
    ]);

    const totalDebitCentavos = debitAgg._sum.amountCentavos || 0;
    const totalCreditCentavos = creditAgg._sum.amountCentavos || 0;
    const differenceCentavos = Math.abs(totalDebitCentavos - totalCreditCentavos);

    return {
      isBalanced: differenceCentavos === 0,
      totalDebitCentavos,
      totalCreditCentavos,
      differenceCentavos,
    };
  }
}
