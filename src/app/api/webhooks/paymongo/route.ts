import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("paymongo-signature");
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    // 🚨 1. STRICT SECURITY CHECK: Reject immediately if secret or signature is missing
    if (!webhookSecret) {
      console.error("[PayMongo Webhook Error]: PAYMONGO_WEBHOOK_SECRET is missing.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (!signatureHeader) {
      console.error("[PayMongo Webhook Error]: Missing paymongo-signature header.");
      return NextResponse.json({ error: "Missing signature header" }, { status: 400 });
    }

    // 🚨 2. VERIFY Cryptographic Signature (Handles both Test 'te' and Live 'li' keys)
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let testSignature = "";
    let liveSignature = "";

    parts.forEach((part) => {
      const [key, value] = part.split("=");
      const trimmedKey = key?.trim();
      const trimmedValue = value?.trim();
      if (trimmedKey === "t") timestamp = trimmedValue;
      if (trimmedKey === "te") testSignature = trimmedValue;
      if (trimmedKey === "li") liveSignature = trimmedValue;
    });

    const comparisonString = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(comparisonString)
      .digest("hex");

    const isValidSignature =
      expectedSignature === testSignature || expectedSignature === liveSignature;

    if (!isValidSignature) {
      console.error("[PayMongo Webhook Error]: Invalid signature verification.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload?.data?.attributes?.type;

    console.log(`[PayMongo Webhook Event]: ${eventType}`);

    if (
      eventType === "checkout_session.payment.paid" ||
      eventType === "payment.paid"
    ) {
      const attributes = payload?.data?.attributes?.data?.attributes;
      const metadata = attributes?.metadata;
      const userId = metadata?.userId || metadata?.user_id;
      const planType = metadata?.planType || "1_MONTH";
      const checkoutSessionId = payload?.data?.attributes?.data?.id;

      // Extract verified purchase amount in centavos (Authoritative base)
      const purchaseAmountCentavos =
        attributes?.amount ||
        (attributes?.line_items?.[0]?.amount
          ? attributes.line_items[0].amount * (attributes.line_items[0].quantity || 1)
          : 0);

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: String(userId) } });
        const now = new Date();
        const baseDate = user?.paidUntil && user.paidUntil > now ? new Date(user.paidUntil) : new Date(now);
        let newPaidUntil: Date | null = new Date(baseDate);

        if (planType === "1_MONTH") newPaidUntil.setDate(newPaidUntil.getDate() + 30);
        else if (planType === "6_MONTHS") newPaidUntil.setDate(newPaidUntil.getDate() + 180);
        else if (planType === "1_YEAR" || planType === "LIFETIME") newPaidUntil.setDate(newPaidUntil.getDate() + 365);

        // Extract PayMongo fee if available or calculate typical 2.5% + ₱15 or default fee
        const feeCentavos = attributes?.fee || attributes?.fees?.[0]?.amount || 0;

        const [_, transaction] = await prisma.$transaction([
          prisma.user.update({
            where: { id: String(userId) },
            data: { isPaid: true, planType, paidUntil: newPaidUntil },
          }),
          prisma.transaction.upsert({
            where: { checkoutSessionId: checkoutSessionId || `txn_${Date.now()}` },
            update: {
              status: "PAID",
              amount: purchaseAmountCentavos ? Math.round(purchaseAmountCentavos / 100) : 0,
              feeAmountCentavos: feeCentavos,
            },
            create: {
              userId: String(userId),
              checkoutSessionId: checkoutSessionId || `txn_${Date.now()}`,
              amount: purchaseAmountCentavos ? Math.round(purchaseAmountCentavos / 100) : 0,
              grossAmountCentavos: purchaseAmountCentavos || 0,
              discountAmountCentavos: 0,
              feeAmountCentavos: feeCentavos,
              planType,
              status: "PAID",
            },
          }),
        ]);

        console.log(`[PayMongo Webhook Success]: Upgraded user ${userId} to ${planType}`);

        const actualPaidCentavos = purchaseAmountCentavos || transaction.amount * 100;

        // 📊 1. Double-Entry Accounting Ledger (Defensively isolated)
        try {
          const { LedgerService } = await import("@/lib/accounting/ledgerService");
          await LedgerService.recordPaymentReceived({
            transactionId: transaction.id,
            amountCentavos: actualPaidCentavos,
            userId: String(userId),
            planType,
          });

          if (feeCentavos > 0) {
            await LedgerService.recordPaymentFee({
              transactionId: transaction.id,
              feeAmountCentavos: feeCentavos,
            });
          }
        } catch (ledgerErr) {
          console.error("[Accounting Ledger Webhook Warning]:", ledgerErr);
        }

        // 🎁 2. Qualify Referral Reward
        try {
          const { ReferralService } = await import("@/lib/referral/referralService");
          await ReferralService.qualifyReferralPayment({
            userId: String(userId),
            transactionId: transaction.id,
            purchaseAmountCentavos: actualPaidCentavos,
            planType,
          });
        } catch (referralErr) {
          console.error("[Referral Webhook Qualification Warning]:", referralErr);
        }

        // 🤝 3. Qualify Partner Commission
        try {
          const { PartnerService } = await import("@/lib/accounting/partnerService");
          await PartnerService.qualifyPartnerPayment({
            userId: String(userId),
            transactionId: transaction.id,
            customerPaymentCentavos: actualPaidCentavos,
            grossAmountCentavos: actualPaidCentavos,
          });
        } catch (partnerErr) {
          console.error("[Partner Webhook Qualification Warning]:", partnerErr);
        }

        // 🏛️ 4. Evaluate Tax Provisions
        try {
          const { TaxService } = await import("@/lib/accounting/taxService");
          await TaxService.evaluateTransactionTaxes({
            transactionId: transaction.id,
            customerPaymentCentavos: actualPaidCentavos,
            grossAmountCentavos: actualPaidCentavos,
          });
        } catch (taxErr) {
          console.error("[Tax Webhook Evaluation Warning]:", taxErr);
        }

        // ⚖️ 5. Auto Reconciliation
        try {
          const { ReconciliationService } = await import("@/lib/accounting/reconciliationService");
          await ReconciliationService.reconcileTransaction(transaction.id);
        } catch (recErr) {
          console.error("[Reconciliation Warning]:", recErr);
        }
      } else {
        console.warn("[PayMongo Webhook Warning]: Paid event received but userId was missing in metadata.");
      }
    } else if (
      eventType === "payment.refunded" ||
      eventType === "payment.refund.updated" ||
      eventType === "refund.created"
    ) {
      // 💸 Payment Refund / Chargeback Handler
      try {
        const checkoutSessionId = payload?.data?.attributes?.data?.id;
        const transaction = await prisma.transaction.findFirst({
          where: { checkoutSessionId },
          include: { referralReward: true, partnerCommission: true },
        });

        if (transaction) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: "REFUNDED" },
          });

          // Reverse Referral
          const { ReferralService } = await import("@/lib/referral/referralService");
          await ReferralService.handlePaymentRefundOrChargeback({
            transactionId: transaction.id,
            reason: `PayMongo refund event: ${eventType}`,
          });

          // Reverse Ledger entries
          const { LedgerService } = await import("@/lib/accounting/ledgerService");
          const refundCentavos = transaction.amount > 5000 ? transaction.amount : transaction.amount * 100;
          await LedgerService.recordRefundReversal({
            transactionId: transaction.id,
            refundAmountCentavos: refundCentavos,
            referralRewardId: transaction.referralReward?.id,
            referralRewardCentavos: transaction.referralReward?.rewardAmountCentavos,
            partnerCommissionId: transaction.partnerCommission?.id,
            partnerCommissionCentavos: transaction.partnerCommission?.commissionAmountCentavos,
            reason: `Refund event: ${eventType}`,
          });

          console.log(`[PayMongo Webhook]: Reversed ledger and liabilities for refunded transaction ${transaction.id}`);
        }
      } catch (refundErr) {
        console.error("[PayMongo Refund Processing Error]:", refundErr);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("PayMongo Webhook Error:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}