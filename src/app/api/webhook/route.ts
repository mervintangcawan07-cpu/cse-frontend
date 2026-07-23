import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// Shared Prisma instance initialization
const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Extract event type from PayMongo payload
    const eventType = body?.data?.attributes?.type;

    // Process only successful payment events
    if (eventType === "checkout_session.payment.paid") {
      const checkoutSession = body?.data?.attributes?.data;
      const attributes = checkoutSession?.attributes;

      // 1. Try to extract userId from metadata
      const userId = attributes?.metadata?.userId;

      // 2. Fallback: Extract customer email from billing details or body
      const customerEmail =
        attributes?.billing?.email ||
        body?.data?.attributes?.billing?.email ||
        body?.email;

      if (userId) {
        // Upgrade user status using User ID
        await prisma.user.update({
          where: { id: userId },
          data: { isPaid: true },
        });
        console.log(`[PayMongo Webhook] User ID ${userId} upgraded to Premium!`);
      } else if (customerEmail) {
        // Fallback: Upgrade user status using Email
        await prisma.user.update({
          where: { email: customerEmail },
          data: { isPaid: true },
        });
        console.log(`[PayMongo Webhook] User Email ${customerEmail} upgraded to Premium!`);
      } else {
        console.warn("[PayMongo Webhook] No userId or customer email found in payload.");
        return NextResponse.json(
          { error: "User identity (userId or email) not found in payload" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error("[PayMongo Webhook Error]:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}