import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const eventType = body?.data?.attributes?.type;
    const checkoutData = body?.data?.attributes?.data;

    if (eventType === "checkout_session.payment.paid") {
      const userId = checkoutData?.attributes?.metadata?.userId;

      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: { isPaid: true },
        });

        console.log(`[PayMongo Webhook] Successfully upgraded user status: ${userId}`);
      } else {
        console.warn("[PayMongo Webhook] Missing userId in session metadata.");
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("PayMongo Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook event processing failed" },
      { status: 500 }
    );
  }
}