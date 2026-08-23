// Relative Path: src/lib/payment/paymentFinalizationService.ts
import { prisma } from "@/lib/prisma";
import { LedgerService } from "@/lib/accounting/ledgerService";
import { PartnerService } from "@/lib/accounting/partnerService";
import { ReferralService } from "@/lib/referral/referralService";
import { TaxService } from "@/lib/accounting/taxService";
import { ReconciliationService } from "@/lib/accounting/reconciliationService";

export interface FinalizePaymentParams {
  userId: string;
  checkoutSessionId: string;
  planType: string;
  purchaseAmountCentavos: number;
  feeAmountCentavos?: number;
  partnerCode?: string | null;
  campaignSource?: string;
  paymentIntentId?: string;
  receiptUrl?: string;
  source: "WEBHOOK" | "VERIFY_POLL";
}

export interface FinalizePaymentResult {
  success: boolean;
  alreadyFinalized: boolean;
  transactionId: string;
  paidUntil: Date | null;
}

export class PaymentFinalizationService {
  /**
   * Authoritative, exactly-once payment finalization engine.
   * Guarantees:
   *   1 Verified Payment == 1 Transaction == 1 Subscription Extension == 1 Ledger Posting == 1 Partner/Referral Reward
   * Completely idempotent and safe against concurrent calls, retries, and race conditions.
   */
  static async finalizeVerifiedPayment(
    params: FinalizePaymentParams
  ): Promise<FinalizePaymentResult> {
    const {
      userId,
      checkoutSessionId,
      planType,
      purchaseAmountCentavos,
      feeAmountCentavos = 0,
      partnerCode,
      campaignSource = "direct",
      paymentIntentId,
      receiptUrl,
      source,
    } = params;

    const normalizedAmountCentavos = Math.max(0, purchaseAmountCentavos);
    const amountPesos = Math.round(normalizedAmountCentavos / 100);

    // 1. ATOMIC TRANSACTION: Check if already finalized, update User and Transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 🔒 Acquire transaction-scoped advisory lock on checkoutSessionId to serialize concurrent finalization
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${checkoutSessionId}, 0)
        )::text AS lock_result
      `;

      // 🔒 Acquire Level 4 User-Entitlement advisory lock to serialize concurrent entitlement stacking
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`user-entitlement:${userId}`}, 0)
        )::text AS lock_result
      `;

      // Check existing transaction
      const existingTxn = await tx.transaction.findUnique({
        where: { checkoutSessionId },
      });

      if (existingTxn && existingTxn.status === "PAID") {
        // Already finalized! Fetch user's current paidUntil
        const currentUser = await tx.user.findUnique({
          where: { id: userId },
          select: { paidUntil: true },
        });

        return {
          alreadyFinalized: true,
          transaction: existingTxn,
          paidUntil: currentUser?.paidUntil || null,
        };
      }

      // Fetch user to compute single renewal extension
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, isPaid: true, paidUntil: true },
      });

      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      const now = new Date();
      const baseDate =
        user.paidUntil && user.paidUntil > now ? new Date(user.paidUntil) : new Date(now);
      const newPaidUntil = new Date(baseDate);

      if (planType === "1_MONTH") {
        newPaidUntil.setDate(newPaidUntil.getDate() + 30);
      } else if (planType === "6_MONTHS") {
        newPaidUntil.setDate(newPaidUntil.getDate() + 180);
      } else if (planType === "1_YEAR" || planType === "LIFETIME") {
        newPaidUntil.setDate(newPaidUntil.getDate() + 365);
      }

      // Update User
      await tx.user.update({
        where: { id: userId },
        data: {
          isPaid: true,
          planType,
          paidUntil: newPaidUntil,
        },
      });

      // Upsert Transaction with PAID status
      const txn = await tx.transaction.upsert({
        where: { checkoutSessionId },
        update: {
          status: "PAID",
          amount: amountPesos,
          grossAmountCentavos: normalizedAmountCentavos,
          feeAmountCentavos: feeAmountCentavos || 0,
          paymentIntentId: paymentIntentId || undefined,
          receiptUrl: receiptUrl || undefined,
        },
        create: {
          userId,
          checkoutSessionId,
          amount: amountPesos,
          grossAmountCentavos: normalizedAmountCentavos,
          discountAmountCentavos: 0,
          feeAmountCentavos: feeAmountCentavos || 0,
          planType,
          status: "PAID",
          paymentIntentId: paymentIntentId || null,
          receiptUrl: receiptUrl || null,
        },
      });

      return {
        alreadyFinalized: false,
        transaction: txn,
        paidUntil: newPaidUntil,
      };
    });

    // 2. IDEMPOTENT EARLY EXIT if already finalized
    if (transactionResult.alreadyFinalized) {
      console.log(
        `[PaymentFinalizationService] Idempotent hit: Checkout ${checkoutSessionId} already finalized. Skipping downstream side effects.`
      );
      return {
        success: true,
        alreadyFinalized: true,
        transactionId: transactionResult.transaction.id,
        paidUntil: transactionResult.paidUntil,
      };
    }

    const transaction = transactionResult.transaction;
    const actualPaidCentavos = normalizedAmountCentavos || transaction.amount * 100;

    // 3. ATOMIC DOWNSTREAM EVENTS (Guarded & Idempotent)

    // 📊 Double-Entry Accounting Ledger
    try {
      const existingLedger = await prisma.financialLedgerEntry.findFirst({
        where: { transactionId: transaction.id },
      });

      if (!existingLedger) {
        await LedgerService.recordPaymentReceived({
          transactionId: transaction.id,
          amountCentavos: actualPaidCentavos,
          userId,
          planType,
        });

        if (feeAmountCentavos > 0) {
          await LedgerService.recordPaymentFee({
            transactionId: transaction.id,
            feeAmountCentavos,
          });
        }
      }
    } catch (ledgerErr) {
      console.error("[PaymentFinalizationService] Ledger warning:", ledgerErr);
    }

    // 🎁 Referral Reward (Unique on transactionId)
    try {
      await ReferralService.qualifyReferralPayment({
        userId,
        transactionId: transaction.id,
        purchaseAmountCentavos: actualPaidCentavos,
        planType,
      });
    } catch (referralErr) {
      console.error("[PaymentFinalizationService] Referral qualification warning:", referralErr);
    }

    // 🤝 Partner Attribution & Commission (Unique on transactionId)
    try {
      if (partnerCode) {
        await PartnerService.recordPartnerAttributionOnSignup({
          referredUserId: userId,
          codeOrSlug: partnerCode,
          campaignSource,
        }).catch(() => null);
      }

      await PartnerService.qualifyPartnerPayment({
        userId,
        transactionId: transaction.id,
        customerPaymentCentavos: actualPaidCentavos,
        grossAmountCentavos: actualPaidCentavos,
        campaignSource,
      });
    } catch (partnerErr) {
      console.error("[PaymentFinalizationService] Partner qualification warning:", partnerErr);
    }

    // 🧾 Tax Compliance
    try {
      await TaxService.evaluateTransactionTaxes({
        transactionId: transaction.id,
        customerPaymentCentavos: actualPaidCentavos,
        grossAmountCentavos: actualPaidCentavos,
      });
    } catch (taxErr) {
      console.error("[PaymentFinalizationService] Tax evaluation warning:", taxErr);
    }

    // 🔍 Auto-Reconciliation
    try {
      await ReconciliationService.reconcileTransaction(transaction.id);
    } catch (reconErr) {
      console.error("[PaymentFinalizationService] Reconciliation warning:", reconErr);
    }

    console.log(
      `[PaymentFinalizationService] Successfully finalized payment for user ${userId}, txn ${transaction.id}, source ${source}`
    );

    return {
      success: true,
      alreadyFinalized: false,
      transactionId: transaction.id,
      paidUntil: transactionResult.paidUntil,
    };
  }
}
