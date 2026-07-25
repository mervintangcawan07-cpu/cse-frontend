import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = String(session.userId);

    // 1. If user is already marked as PRO in database, skip PayMongo check
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPaid: true },
    });

    if (existingUser?.isPaid) {
      return NextResponse.json({ success: true, message: "User is already PRO." });
    }

    // 2. Retrieve the checkout session ID stored in the HTTP-only cookie
    const checkoutSessionId = cookieStore.get("cse_checkout_id")?.value;
    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json({ error: "PAYMONGO_SECRET_KEY missing" }, { status: 500 });
    }

    if (!checkoutSessionId) {
      return NextResponse.json({ success: false, message: "No checkout cookie found." });
    }

    const authHeader = Buffer.from(`${secretKey.trim()}:`).toString("base64");

    // 3. Directly query PayMongo API for session payment status
    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`, {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[VERIFY_PAYMONGO_ERROR]", data);
      return NextResponse.json({ success: false, error: "Failed to fetch session from PayMongo" }, { status: 400 });
    }

    const checkoutData = data?.data;
    const payments = checkoutData?.attributes?.payments || [];
    const paymentIntentStatus = checkoutData?.attributes?.payment_intent?.attributes?.status;

    const isPaid =
      payments.some((p: any) => p?.attributes?.status === "paid") ||
      paymentIntentStatus === "succeeded" ||
      checkoutData?.attributes?.status === "paid";

    // 4. Upgrade user in Neon DB upon confirmed payment
    if (isPaid) {
      await prisma.user.update({
        where: { id: userId },
        data: { isPaid: true },
      });

      // Clear the temporary checkout cookie
      cookieStore.delete("cse_checkout_id");

      console.log(`[PAYMONGO_VERIFY] User ID: ${userId} successfully upgraded to PRO!`);
      return NextResponse.json({ success: true, message: "Payment verified and account upgraded!" });
    }

    return NextResponse.json({ success: false, message: "Payment pending or unpaid." });
  } catch (error) {
    console.error("[VERIFY_CATCH_ERROR]", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}