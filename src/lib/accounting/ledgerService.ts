import crypto from "crypto";
import { Prisma } from "@prisma/client";
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
   * Generates a unique, collision-free sequential entry number (e.g. LED-260821-151822-1A2B3C).
   */
  static generateEntryNumber(suffix: string = ""): string {
    const now = new Date();
    const datePart = now.toISOString().replace(/[-:T]/g, "").slice(2, 14); // YYMMDDHHMMSS
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    const tag = suffix ? `-${suffix}` : "";
    return `LED-${datePart}-${randomHex}${tag}`;
  }

  /**
   * Posts a pair of balanced double-entry ledger entries in an atomic transaction.
   */
  static async postBalancedDoubleEntry(
    params: {
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
    },
    client?: Prisma.TransactionClient
  ) {
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

    const db = client || prisma;
    const safeAmount = deterministicRound(amountCentavos);
    const entryNumDebit = this.generateEntryNumber("DR");
    const entryNumCredit = this.generateEntryNumber("CR");

    const [debitEntry, creditEntry] = await db.financialLedgerEntry.createManyAndReturn({
      data: [
        {
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
        {
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
      ],
    });

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
  static async recordPaymentFee(
    params: {
      transactionId: string;
      feeAmountCentavos: number;
    },
    client?: Prisma.TransactionClient
  ) {
    if (params.feeAmountCentavos <= 0) return [];

    return this.postBalancedDoubleEntry(
      {
        transactionId: params.transactionId,
        transactionType: "PAYMONGO_FEE",
        debitCategory: "EXPENSE_PAYMENT_FEE",
        creditCategory: "CASH_PAYMONGO",
        amountCentavos: params.feeAmountCentavos,
        sourceEntity: "Transaction",
        sourceId: params.transactionId,
        description: `PayMongo processing fee for Transaction ${params.transactionId}`,
      },
      client
    );
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
  static async recordPayoutDisbursement(
    params: {
      payoutId: string;
      payoutType: "REFERRAL" | "PARTNER";
      recipientId: string;
      amountCentavos: number;
      method: string;
      referenceNumber?: string;
      adminUserId?: string;
    },
    client?: Prisma.TransactionClient
  ) {
    const db = client || prisma;
    const liabilityCategory: AccountCategory =
      params.payoutType === "REFERRAL"
        ? "LIABILITY_REFERRAL_PAYABLE"
        : "LIABILITY_PARTNER_PAYABLE";

    const sourceEntity = params.payoutType === "REFERRAL" ? "ReferralPayout" : "PartnerPayout";

    // 🔒 Persistent Ledger Idempotency Guard
    const existingDisbursement = await db.financialLedgerEntry.findFirst({
      where: {
        transactionType: "PAYOUT_DISBURSEMENT",
        sourceEntity,
        sourceId: params.payoutId,
        entryType: "DEBIT",
      },
    });

    if (existingDisbursement) {
      return [existingDisbursement];
    }

    return this.postBalancedDoubleEntry(
      {
        transactionType: "PAYOUT_DISBURSEMENT",
        debitCategory: liabilityCategory,
        creditCategory: "CASH_PAYMONGO",
        amountCentavos: params.amountCentavos,
        sourceEntity,
        sourceId: params.payoutId,
        description: `Payout fulfilled via ${params.method} (Ref: ${params.referenceNumber || "N/A"})`,
        createdBy: params.adminUserId,
      },
      client
    );
  }

  /**
   * Records refund or chargeback reversal in the ledger.
   */
  static async recordRefundReversal(
    params: {
      transactionId: string;
      refundAmountCentavos: number;
      refundId?: string;
      referralRewardId?: string;
      referralRewardCentavos?: number;
      reverseReferralLiability?: boolean;
      partnerCommissionId?: string;
      partnerCommissionCentavos?: number;
      reversePartnerLiability?: boolean;
      reason: string;
    },
    client?: Prisma.TransactionClient
  ) {
    const results = [];
    const sourceEntity = "Refund";
    const canonicalSourceId = params.refundId || params.transactionId;

    // 1. Reverse Revenue: Debit REVENUE_PREMIUM, Credit CASH_PAYMONGO
    const revEntries = await this.postBalancedDoubleEntry(
      {
        transactionId: params.transactionId,
        transactionType: "REFUND_REVERSAL",
        debitCategory: "REVENUE_PREMIUM",
        creditCategory: "CASH_PAYMONGO",
        amountCentavos: params.refundAmountCentavos,
        sourceEntity,
        sourceId: canonicalSourceId,
        description: `Refund reversal: ${params.reason}`,
      },
      client
    );
    results.push(...revEntries);

    // 2. Reverse Referral Liability ONLY if explicitly requested and liability is still outstanding:
    // Debit LIABILITY_REFERRAL_PAYABLE, Credit EXPENSE_REFERRAL
    if (
      params.reverseReferralLiability &&
      params.referralRewardId &&
      (params.referralRewardCentavos || 0) > 0
    ) {
      const refEntries = await this.postBalancedDoubleEntry(
        {
          transactionId: params.transactionId,
          transactionType: "REFUND_REVERSAL",
          debitCategory: "LIABILITY_REFERRAL_PAYABLE",
          creditCategory: "EXPENSE_REFERRAL",
          amountCentavos: params.referralRewardCentavos!,
          sourceEntity,
          sourceId: canonicalSourceId,
          description: `Reversal of referral commission liability on full refund`,
        },
        client
      );
      results.push(...refEntries);
    }

    // 3. Reverse Partner Liability ONLY if explicitly requested and liability is still outstanding:
    // Debit LIABILITY_PARTNER_PAYABLE, Credit EXPENSE_PARTNER
    if (
      params.reversePartnerLiability &&
      params.partnerCommissionId &&
      (params.partnerCommissionCentavos || 0) > 0
    ) {
      const ptrEntries = await this.postBalancedDoubleEntry(
        {
          transactionId: params.transactionId,
          transactionType: "REFUND_REVERSAL",
          debitCategory: "LIABILITY_PARTNER_PAYABLE",
          creditCategory: "EXPENSE_PARTNER",
          amountCentavos: params.partnerCommissionCentavos!,
          sourceEntity,
          sourceId: canonicalSourceId,
          description: `Reversal of partner commission liability on full refund`,
        },
        client
      );
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
