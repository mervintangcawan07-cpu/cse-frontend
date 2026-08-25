import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PAYMONGO_VERIFY_LIMITER,
  checkRateLimit,
  createRateLimitResponse,
} from "@/lib/ratelimit";

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

    const rateResult = await checkRateLimit(
      PAYMONGO_VERIFY_LIMITER,
      `paymongo:verify:${userId}`
    );
    if (!rateResult.success) {
      return createRateLimitResponse(
        rateResult,
        "Too many payment verification requests. Please wait a moment."
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPaid: true, paidUntil: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const checkoutSessionId = cookieStore.get("cse_checkout_id")?.value;
    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey || !checkoutSessionId) {
      return NextResponse.json({ success: false, message: "No active checkout cookie." });
    }

    const authHeader = Buffer.from(`${secretKey.trim()}:`).toString("base64");

    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`, {
      headers: { Authorization: `Basic ${authHeader}` },
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ success: false, error: "Failed to query PayMongo." }, { status: 400 });
    }

    const checkoutData = data?.data;
    const checkoutMetadata = checkoutData?.attributes?.metadata;
    const checkoutOwnerUserId =
      checkoutMetadata?.userId ?? checkoutMetadata?.user_id;
    const planType = checkoutMetadata?.planType;

    if (
      !checkoutOwnerUserId ||
      String(checkoutOwnerUserId) !== userId ||
      typeof planType !== "string" ||
      !["1_MONTH", "6_MONTHS", "1_YEAR"].includes(planType)
    ) {
      cookieStore.delete("cse_checkout_id");
      cookieStore.delete("cse_checkout_plan");

      return NextResponse.json(
        {
          success: false,
          error: "Checkout session ownership verification failed.",
        },
        { status: 403 }
      );
    }

    const payments = checkoutData?.attributes?.payments || [];
    const paymentIntentStatus = checkoutData?.attributes?.payment_intent?.attributes?.status;

    const isPaidConfirmed =
      payments.some((payment: { attributes?: { status?: string } }) => payment?.attributes?.status === "paid") ||
      paymentIntentStatus === "succeeded" ||
      checkoutData?.attributes?.status === "paid";

    if (isPaidConfirmed) {
      const lineItemAmount = checkoutData?.attributes?.line_items?.[0]?.amount;
      const quantity = checkoutData?.attributes?.line_items?.[0]?.quantity || 1;
      const purchaseAmountCentavos = lineItemAmount
        ? lineItemAmount * quantity
        : (checkoutData?.attributes?.amount || 0);

      const paidPayment =
        payments.find(
          (payment: { attributes?: { status?: string; fee?: number } }) =>
            payment?.attributes?.status === "paid"
        ) || payments[0];

      const feeCentavos =
        paidPayment?.attributes?.fee ||
        checkoutData?.attributes?.fee ||
        checkoutData?.attributes?.fees?.[0]?.amount ||
        0;

      const partnerCode = checkoutData?.attributes?.metadata?.partnerCode;
      const campaignSource = checkoutData?.attributes?.metadata?.campaignSource || "direct";
      const paymentIntentId = checkoutData?.attributes?.payment_intent?.id;

      const { PaymentFinalizationService } = await import("@/lib/payment/paymentFinalizationService");
      const finalization = await PaymentFinalizationService.finalizeVerifiedPayment({
        userId,
        checkoutSessionId,
        planType,
        purchaseAmountCentavos,
        feeAmountCentavos: feeCentavos,
        partnerCode,
        campaignSource,
        paymentIntentId,
        source: "VERIFY_POLL",
      });

      cookieStore.delete("cse_checkout_id");
      cookieStore.delete("cse_checkout_plan");

      return NextResponse.json({
        success: true,
        alreadyFinalized: finalization.alreadyFinalized,
        message: finalization.alreadyFinalized
          ? "Payment already processed and active."
          : "Payment verified and subscription activated.",
      });
    }

    return NextResponse.json({ success: false, message: "Payment pending or unpaid." });
  } catch (error) {
    console.error("[VERIFY_CATCH_ERROR]", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
