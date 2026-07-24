import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // PayMongo webhook structure: { data: { attributes: { type, data: { attributes: ... } } } }
    const eventType = body?.data?.attributes?.type;
    const eventData = body?.data?.attributes?.data;

    console.log(`[PayMongo Webhook Received]: ${eventType}`);

    // Listen for paid events
    if (
      eventType === "checkout_session.payment.paid" ||
      eventType === "payment.paid"
    ) {
      const attributes = eventData?.attributes;

      // Extract userId or email passed in checkout session metadata or billing info
      const userId = attributes?.metadata?.userId || attributes?.metadata?.user_id;
      const userEmail = attributes?.metadata?.email || attributes?.billing?.email;

      if (userId) {
        await prisma.user.update({
          where: { id: String(userId) },
          data: { isPaid: true },
        });
        console.log(`[PayMongo Webhook] User ID ${userId} upgraded to PRO via webhook.`);
      } else if (userEmail) {
        await prisma.user.update({
          where: { email: String(userEmail) },
          data: { isPaid: true },
        });
        console.log(`[PayMongo Webhook] User Email ${userEmail} upgraded to PRO via webhook.`);
      } else {
        console.warn("[PayMongo Webhook] Payment succeeded but no userId/email was found in payload metadata.");
      }
    }

    // Always respond with 200 OK so PayMongo knows the event was acknowledged
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[PAYMONGO_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}