import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("paymongo-signature");
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    // 🚨 STRICT SECURITY CHECK: Reject immediately if secret or signature is missing
    if (!webhookSecret) {
      console.error("[PayMongo Webhook Error]: PAYMONGO_WEBHOOK_SECRET is missing.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (!signatureHeader) {
      console.error("[PayMongo Webhook Error]: Missing paymongo-signature header.");
      return NextResponse.json({ error: "Missing signature header" }, { status: 400 });
    }

    // Verify HMAC SHA256 signature
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let testSignature = "";
    let liveSignature = "";

    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "t") timestamp = value;
      if (key === "te") testSignature = value;
      if (key === "li") liveSignature = value;
    }

    const computedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const isValid = computedSignature === testSignature || computedSignature === liveSignature;

    if (!isValid) {
      console.error("[PayMongo Webhook Error]: Invalid signature verification.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.data?.attributes?.type;
    const eventData = event?.data?.attributes?.data;

    console.log(`[PayMongo Webhook Received]: ${eventType}`);

    if (
      eventType === "checkout_session.payment.paid" ||
      eventType === "payment.paid"
    ) {
      const attributes = eventData?.attributes;
      const metadata = attributes?.metadata || {};
      const userId = metadata.userId || metadata.user_id;
      const planType = metadata.planType || "1_MONTH";

      const checkoutSessionId = eventData?.id || event?.data?.id;
      const purchaseAmountCentavos =
        attributes?.amount ||
        (attributes?.line_items?.[0]?.amount
          ? attributes.line_items[0].amount * (attributes.line_items[0].quantity || 1)
          : 0);

      if (userId) {
        // Fetch current user to compute accurate plan duration/extension
        const user = await prisma.user.findUnique({
          where: { id: String(userId) },
          select: { paidUntil: true },
        });

        const now = new Date();
        const baseDate = user?.paidUntil && user.paidUntil > now ? new Date(user.paidUntil) : new Date(now);
        let newPaidUntil: Date | null = new Date(baseDate);

        if (planType === "1_MONTH") {
          newPaidUntil.setDate(newPaidUntil.getDate() + 30);
        } else if (planType === "6_MONTHS") {
          newPaidUntil.setDate(newPaidUntil.getDate() + 180);
        } else if (planType === "1_YEAR" || planType === "LIFETIME") {
          newPaidUntil.setDate(newPaidUntil.getDate() + 365);
        }

        const [_, transaction] = await prisma.$transaction([
          prisma.user.update({
            where: { id: String(userId) },
            data: {
              isPaid: true,
              planType,
              paidUntil: newPaidUntil,
            },
          }),
          prisma.transaction.upsert({
            where: { checkoutSessionId: checkoutSessionId || `txn_${Date.now()}` },
            update: { status: "PAID" },
            create: {
              userId: String(userId),
              checkoutSessionId: checkoutSessionId || `txn_${Date.now()}`,
              amount: purchaseAmountCentavos ? Math.round(purchaseAmountCentavos / 100) : 0,
              planType,
              status: "PAID",
            },
          }),
        ]);

        console.log(`[PayMongo Webhook] User ID ${userId} upgraded to PRO (${planType}) until ${newPaidUntil.toISOString()}.`);

        // 🎁 Qualify Referral Reward
        try {
          const { ReferralService } = await import("@/lib/referral/referralService");
          await ReferralService.qualifyReferralPayment({
            userId: String(userId),
            transactionId: transaction.id,
            purchaseAmountCentavos: purchaseAmountCentavos || transaction.amount * 100,
            planType,
          });
        } catch (referralErr) {
          console.error("[Referral Webhook Qualification Warning]:", referralErr);
        }
      } else {
        console.warn("[PayMongo Webhook] Paid event received but userId missing in metadata.");
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[PayMongo Webhook Error]:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}