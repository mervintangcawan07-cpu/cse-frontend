import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("paymongo-signature");

    if (!signatureHeader) {
      return NextResponse.json({ error: "Missing signature header" }, { status: 400 });
    }

    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("PAYMONGO_WEBHOOK_SECRET is missing");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    // Parse signature header: "t=1234567,te=signature1,li=signature2"
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

    // Verify HMAC SHA256 signature
    const computedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const isValid = computedSignature === testSignature || computedSignature === liveSignature;

    if (!isValid) {
      console.error("Invalid PayMongo signature verification");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.data?.attributes?.type;

    if (eventType === "checkout_session.payment.paid") {
      const checkoutSession = event.data.attributes.data;
      const metadata = checkoutSession.attributes.metadata;
      const userId = metadata?.userId;

      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { isPaid: true },
        });
        console.log(`[PayMongo Webhook] Activated PRO account for user ID: ${userId}`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[PayMongo Webhook Error]:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}