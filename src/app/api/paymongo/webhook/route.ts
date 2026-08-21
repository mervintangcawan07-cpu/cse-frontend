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

      if (userId && checkoutSessionId) {
        const feeCentavos = attributes?.fee || attributes?.fees?.[0]?.amount || 0;
        const partnerCode = metadata.partnerCode;
        const campaignSource = metadata.campaignSource || "direct";
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
          `[PayMongo Webhook] User ID ${userId} finalized (${planType}) - AlreadyFinalized: ${finalization.alreadyFinalized}`
        );
      } else {
        console.warn("[PayMongo Webhook] Paid event received but userId or checkoutSessionId missing in metadata.");
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[PayMongo Webhook Error]:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}