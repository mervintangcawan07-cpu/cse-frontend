import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = String(session.userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPaid: true, paidUntil: true },
    });

    const checkoutSessionId = cookieStore.get("cse_checkout_id")?.value;
    const planType = cookieStore.get("cse_checkout_plan")?.value || "1_MONTH";
    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey || !checkoutSessionId) {
      return NextResponse.json({ success: false, message: "No active checkout cookie." });
    }

    const authHeader = Buffer.from(`${secretKey.trim()}:`).toString("base64");

    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`, {
      headers: { Authorization: `Basic ${authHeader}` },
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ success: false, error: "Failed to query PayMongo." }, { status: 400 });
    }

    const checkoutData = data?.data;
    const payments = checkoutData?.attributes?.payments || [];
    const paymentIntentStatus = checkoutData?.attributes?.payment_intent?.attributes?.status;

    const isPaidConfirmed =
      payments.some((p: any) => p?.attributes?.status === "paid") ||
      paymentIntentStatus === "succeeded" ||
      checkoutData?.attributes?.status === "paid";

    if (isPaidConfirmed) {
      const now = new Date();
      // Renewal logic: If user extends before plan expires, add days onto current paidUntil
      const baseDate = user?.paidUntil && user.paidUntil > now ? new Date(user.paidUntil) : new Date(now);

      let newPaidUntil: Date | null = new Date(baseDate);

      if (planType === "1_MONTH") {
        newPaidUntil.setDate(newPaidUntil.getDate() + 30);
      } else if (planType === "6_MONTHS") {
        newPaidUntil.setDate(newPaidUntil.getDate() + 180);
      } else if (planType === "1_YEAR" || planType === "LIFETIME") {
        newPaidUntil.setDate(newPaidUntil.getDate() + 365);
      }

      const lineItemAmount = checkoutData?.attributes?.line_items?.[0]?.amount;
      const quantity = checkoutData?.attributes?.line_items?.[0]?.quantity || 1;
      const purchaseAmountCentavos = lineItemAmount ? lineItemAmount * quantity : 0;

      const [_, transaction] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            isPaid: true,
            planType,
            paidUntil: newPaidUntil,
          },
        }),
        prisma.transaction.upsert({
          where: { checkoutSessionId },
          update: { status: "PAID" },
          create: {
            userId,
            checkoutSessionId,
            amount: purchaseAmountCentavos ? Math.round(purchaseAmountCentavos / 100) : 0,
            planType,
            status: "PAID",
          },
        }),
      ]);

      const actualPaidCentavos = purchaseAmountCentavos || transaction.amount * 100;

      // 📊 1. Double-Entry Accounting Ledger (Idempotent)
      try {
        const { LedgerService } = await import("@/lib/accounting/ledgerService");
        await LedgerService.recordPaymentReceived({
          transactionId: transaction.id,
          amountCentavos: actualPaidCentavos,
          userId,
          planType,
        });
      } catch (ledgerErr) {
        console.error("[Accounting Ledger Verify Warning]:", ledgerErr);
      }

      // 🎁 2. Qualify Referral Reward (Idempotent)
      try {
        const { ReferralService } = await import("@/lib/referral/referralService");
        await ReferralService.qualifyReferralPayment({
          userId,
          transactionId: transaction.id,
          purchaseAmountCentavos: actualPaidCentavos,
          planType,
        });
      } catch (referralErr) {
        console.error("[Referral Verify Qualification Warning]:", referralErr);
      }

      // 🤝 3. Qualify Partner Commission (Idempotent)
      try {
        const { PartnerService } = await import("@/lib/accounting/partnerService");
        const partnerCode = checkoutData?.attributes?.metadata?.partnerCode;
        const campaignSource = checkoutData?.attributes?.metadata?.campaignSource || "direct";

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
        console.error("[Partner Verify Qualification Warning]:", partnerErr);
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
        console.error("[Tax Verify Warning]:", taxErr);
      }

      // ⚖️ 5. Auto Reconciliation
      try {
        const { ReconciliationService } = await import("@/lib/accounting/reconciliationService");
        await ReconciliationService.reconcileTransaction(transaction.id);
      } catch (recErr) {
        console.error("[Reconciliation Verify Warning]:", recErr);
      }

      cookieStore.delete("cse_checkout_id");
      cookieStore.delete("cse_checkout_plan");

      return NextResponse.json({ success: true, message: "Payment verified and duration calculated." });
    }

    return NextResponse.json({ success: false, message: "Payment pending or unpaid." });
  } catch (error) {
    console.error("[VERIFY_CATCH_ERROR]", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}