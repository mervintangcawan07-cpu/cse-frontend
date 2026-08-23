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

    if (eventType === "checkout_session.payment.paid") {
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

      if (userId && checkoutSessionId) {
        const feeCentavos = attributes?.fee || attributes?.fees?.[0]?.amount || 0;
        const partnerCode = metadata?.partnerCode;
        const campaignSource = metadata?.campaignSource || "direct";
        const paymentIntentId = attributes?.payment_intent?.id || attributes?.payment_intent_id;

        const { PaymentFinalizationService } = await import("@/lib/payment/paymentFinalizationService");
        const finalization = await PaymentFinalizationService.finalizeVerifiedPayment({
          userId: String(userId),
          checkoutSessionId: String(checkoutSessionId),
          planType: String(planType),
          purchaseAmountCentavos,
          feeAmountCentavos: feeCentavos,
          partnerCode,
          campaignSource,
          paymentIntentId,
          source: "WEBHOOK",
        });

        console.log(
          `[PayMongo Webhook Result]: Finalized payment for user ${userId} (${planType}) - AlreadyFinalized: ${finalization.alreadyFinalized}`
        );
      } else {
        console.warn("[PayMongo Webhook Warning]: Paid event received but userId or checkoutSessionId was missing.");
      }
    } else if (
      eventType === "payment.refunded" ||
      eventType === "payment.refund.updated"
    ) {
      // 💸 Payment Refund / Chargeback Handler (Hardened, Idempotent, Advisory-Locked)
      const secretKey = process.env.PAYMONGO_SECRET_KEY;
      if (!secretKey) {
        console.error("[PayMongo Webhook Error]: PAYMONGO_SECRET_KEY is missing for refund resolution.");
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
      }

      const { RefundService } = await import("@/lib/payment/refundService");
      const outcome = await RefundService.processPayMongoRefundWebhook({
        eventType,
        payload,
        secretKey,
      });

      console.log(
        `[PayMongo Webhook Refund Outcome]: status=${outcome.status}, refundId=${outcome.refundId || "N/A"}, transactionId=${outcome.transactionId || "N/A"}`
      );

      if (!outcome.success) {
        return NextResponse.json({ error: outcome.message, status: outcome.status }, { status: 500 });
      }

      return NextResponse.json(
        {
          received: true,
          status: outcome.status,
          refundId: outcome.refundId,
          transactionId: outcome.transactionId,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("PayMongo Webhook Error:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}