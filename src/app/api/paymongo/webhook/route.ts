import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("paymongo-signature");

    // Verify HMAC SHA256 signature if webhook secret is set
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (webhookSecret && signatureHeader) {
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
        console.error("Invalid PayMongo signature verification");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
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
      const userId = attributes?.metadata?.userId || attributes?.metadata?.user_id;

      if (userId) {
        await prisma.user.update({
          where: { id: String(userId) },
          data: { isPaid: true },
        });
        console.log(`[PayMongo Webhook] User ID ${userId} automatically upgraded to PRO.`);
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