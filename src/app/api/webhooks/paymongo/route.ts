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

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: String(userId) } });
        const now = new Date();
        const baseDate = user?.paidUntil && user.paidUntil > now ? new Date(user.paidUntil) : new Date(now);
        let newPaidUntil: Date | null = new Date(baseDate);

        if (planType === "1_MONTH") newPaidUntil.setDate(newPaidUntil.getDate() + 30);
        else if (planType === "6_MONTHS") newPaidUntil.setDate(newPaidUntil.getDate() + 180);
        else if (planType === "LIFETIME") newPaidUntil = null;

        await prisma.$transaction([
          prisma.user.update({
            where: { id: String(userId) },
            data: { isPaid: true, planType, paidUntil: newPaidUntil },
          }),
          prisma.transaction.upsert({
            where: { checkoutSessionId: checkoutSessionId || `txn_${Date.now()}` },
            update: { status: "PAID" },
            create: {
              userId: String(userId),
              checkoutSessionId: checkoutSessionId || `txn_${Date.now()}`,
              amount: attributes?.amount ? attributes.amount / 100 : 0,
              planType,
              status: "PAID",
            },
          }),
        ]);

        console.log(`[PayMongo Webhook Success]: Upgraded user ${userId} to ${planType}`);
      } else {
        console.warn("[PayMongo Webhook Warning]: Paid event received but userId was missing in metadata.");
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("PayMongo Webhook Error:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}