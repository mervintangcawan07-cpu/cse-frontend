import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("paymongo-signature");
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    // Verify cryptographic signature if secret is defined
    if (webhookSecret && signatureHeader) {
      const parts = signatureHeader.split(",");
      let t = "";
      let te = "";

      parts.forEach((part) => {
        const [key, value] = part.split("=");
        if (key.trim() === "t") t = value;
        if (key.trim() === "te") te = value;
      });

      const comparisonString = `${t}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(comparisonString)
        .digest("hex");

      if (te !== expectedSignature) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload?.data?.attributes?.type;

    if (eventType === "checkout_session.payment.paid") {
      const attributes = payload?.data?.attributes?.data?.attributes;
      const metadata = attributes?.metadata;
      const userId = metadata?.userId;
      const planType = metadata?.planType || "1_MONTH";
      const checkoutSessionId = payload?.data?.attributes?.data?.id;

      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const now = new Date();
        const baseDate = user?.paidUntil && user.paidUntil > now ? new Date(user.paidUntil) : new Date(now);
        let newPaidUntil: Date | null = new Date(baseDate);

        if (planType === "1_MONTH") newPaidUntil.setDate(newPaidUntil.getDate() + 30);
        else if (planType === "6_MONTHS") newPaidUntil.setDate(newPaidUntil.getDate() + 180);
        else if (planType === "LIFETIME") newPaidUntil = null;

        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: { isPaid: true, planType, paidUntil: newPaidUntil },
          }),
          prisma.transaction.upsert({
            where: { checkoutSessionId: checkoutSessionId || `txn_${Date.now()}` },
            update: { status: "PAID" },
            create: {
              userId,
              checkoutSessionId: checkoutSessionId || `txn_${Date.now()}`,
              amount: attributes?.amount ? attributes.amount / 100 : 0,
              planType,
              status: "PAID",
            },
          }),
        ]);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error("PayMongo Webhook Error:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}