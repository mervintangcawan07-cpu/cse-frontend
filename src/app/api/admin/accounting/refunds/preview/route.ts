import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import {
  RefundService,
  type PayMongoRefundResource,
} from "@/lib/payment/refundService";
import {
  REFUND_REASONS,
  calculateRefundPolicy,
  type RefundReason,
} from "@/lib/payment/refundPolicy";

function isRefundReason(value: unknown): value is RefundReason {
  return (
    typeof value === "string" &&
    REFUND_REASONS.includes(value as RefundReason)
  );
}

function sumSucceededRefunds(
  refunds: PayMongoRefundResource[]
): number {
  let total = 0;

  for (const refund of refunds) {
    if (refund.attributes?.status !== "succeeded") continue;

    const amount = refund.attributes?.amount;
    const currency = refund.attributes?.currency;

    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      currency !== "PHP"
    ) {
      throw new Error("INVALID_SUCCEEDED_REFUND_AMOUNT");
    }

    total += amount;

    if (!Number.isSafeInteger(total)) {
      throw new Error("REFUND_TOTAL_OVERFLOW");
    }
  }

  return total;
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } =
      await requireAdminAuth(request);

    if (errorResponse) return errorResponse;

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    const transactionId =
      typeof body?.transactionId === "string"
        ? body.transactionId.trim()
        : "";

    const reason = body?.reason;

    if (!transactionId) {
      return NextResponse.json(
        { error: "transactionId is required." },
        { status: 400 }
      );
    }

    if (!isRefundReason(reason)) {
      return NextResponse.json(
        {
          error: "Invalid refund reason.",
          allowedReasons: REFUND_REASONS,
        },
        { status: 400 }
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        userId: true,
        checkoutSessionId: true,
        grossAmountCentavos: true,
        feeAmountCentavos: true,
        status: true,
        planType: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found." },
        { status: 404 }
      );
    }

    if (
      transaction.status !== "PAID" &&
      transaction.status !== "REFUNDED"
    ) {
      return NextResponse.json(
        {
          error:
            "Only paid or previously refunded transactions can be evaluated for refund.",
          transactionStatus: transaction.status,
        },
        { status: 409 }
      );
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey?.trim()) {
      console.error(
        "[ADMIN_REFUND_PREVIEW] PAYMONGO_SECRET_KEY is missing."
      );

      return NextResponse.json(
        { error: "Payment provider configuration unavailable." },
        { status: 503 }
      );
    }

    const checkout =
      await RefundService.fetchPayMongoCheckoutSession(
        transaction.checkoutSessionId,
        secretKey
      );

    if (!checkout) {
      return NextResponse.json(
        {
          error:
            "Unable to retrieve the authoritative PayMongo Checkout Session.",
        },
        { status: 502 }
      );
    }

    const checkoutOwnerUserId =
      checkout.attributes?.metadata?.userId ??
      checkout.attributes?.metadata?.user_id;

    if (
      !checkoutOwnerUserId ||
      String(checkoutOwnerUserId) !== transaction.userId
    ) {
      console.error(
        `[ADMIN_REFUND_PREVIEW] Checkout ownership missing or mismatched for transaction ${transaction.id}`
      );

      return NextResponse.json(
        { error: "Checkout ownership verification failed." },
        { status: 409 }
      );
    }

    const payment =
      RefundService.resolvePaidPaymentFromCheckout(checkout);

    if (!payment) {
      return NextResponse.json(
        {
          error:
            "No authoritative paid PayMongo Payment was found for this Checkout Session.",
        },
        { status: 409 }
      );
    }

    const paymentAmountCentavos =
      payment.attributes?.amount;

    if (
      typeof paymentAmountCentavos !== "number" ||
      !Number.isInteger(paymentAmountCentavos) ||
      paymentAmountCentavos <= 0 ||
      payment.attributes?.currency !== "PHP"
    ) {
      return NextResponse.json(
        { error: "Invalid authoritative PayMongo payment amount." },
        { status: 409 }
      );
    }

    if (
      transaction.grossAmountCentavos &&
      transaction.grossAmountCentavos > 0 &&
      transaction.grossAmountCentavos !== paymentAmountCentavos
    ) {
      console.error(
        `[ADMIN_REFUND_PREVIEW] Payment amount mismatch for transaction ${transaction.id}`
      );

      return NextResponse.json(
        {
          error:
            "GovStudyX and PayMongo payment amounts do not match. Manual reconciliation is required.",
        },
        { status: 409 }
      );
    }

    const authoritativeFeeCentavos =
      payment.attributes?.fee;

    if (
      typeof authoritativeFeeCentavos !== "number" ||
      !Number.isInteger(authoritativeFeeCentavos) ||
      authoritativeFeeCentavos < 0 ||
      authoritativeFeeCentavos > paymentAmountCentavos
    ) {
      return NextResponse.json(
        {
          error:
            "Authoritative PayMongo processing fee is unavailable or invalid.",
        },
        { status: 409 }
      );
    }

    const storedFeeCentavos =
      transaction.feeAmountCentavos || 0;

    if (
      storedFeeCentavos > 0 &&
      storedFeeCentavos !== authoritativeFeeCentavos
    ) {
      console.error(
        `[ADMIN_REFUND_PREVIEW] Fee mismatch for transaction ${transaction.id}: stored=${storedFeeCentavos}, paymongo=${authoritativeFeeCentavos}`
      );

      return NextResponse.json(
        {
          error:
            "GovStudyX and PayMongo processing fees do not match. Manual reconciliation is required.",
        },
        { status: 409 }
      );
    }

    let allRefunds: PayMongoRefundResource[];

    try {
      allRefunds =
        await RefundService.fetchAllRefundsStrict(
          payment.id,
          secretKey
        );
    } catch (error) {
      console.error(
        "[ADMIN_REFUND_PREVIEW] Authoritative refund history unavailable:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Authoritative PayMongo refund history could not be completely verified.",
        },
        { status: 502 }
      );
    }

    const nonFinalRefunds = allRefunds.filter((refund) => {
      const status = String(
        refund.attributes?.status || ""
      ).toLowerCase();

      return status !== "succeeded" && status !== "failed";
    });

    if (nonFinalRefunds.length > 0) {
      return NextResponse.json(
        {
          error:
            "A PayMongo refund is already pending or processing. Wait for it to reach a final state before creating another refund.",
          activeRefunds: nonFinalRefunds.map((refund) => ({
            id: refund.id,
            status: refund.attributes?.status || "unknown",
            amountCentavos:
              refund.attributes?.amount ?? null,
          })),
        },
        { status: 409 }
      );
    }

    let cumulativeRefundedCentavos: number;

    try {
      cumulativeRefundedCentavos =
        sumSucceededRefunds(allRefunds);
    } catch (error) {
      console.error(
        "[ADMIN_REFUND_PREVIEW] Invalid refund history amount:",
        error
      );

      return NextResponse.json(
        {
          error:
            "PayMongo refund history contains an invalid financial amount.",
        },
        { status: 409 }
      );
    }

    if (
      cumulativeRefundedCentavos >
      paymentAmountCentavos
    ) {
      return NextResponse.json(
        {
          error:
            "Cumulative PayMongo refunds exceed the original payment. Manual reconciliation is required.",
        },
        { status: 409 }
      );
    }

    const paymentMethod =
      payment.attributes?.source?.type || "";

    const createdAtSeconds =
      payment.attributes?.created_at;

    const paymentCreatedAt =
      typeof createdAtSeconds === "number" &&
      Number.isFinite(createdAtSeconds) &&
      createdAtSeconds > 0
        ? new Date(createdAtSeconds * 1000)
        : undefined;

    const decision = calculateRefundPolicy({
      reason,
      paymentMethod,
      originalPaymentCentavos:
        paymentAmountCentavos,
      originalProcessingFeeCentavos:
        authoritativeFeeCentavos,
      cumulativeRefundedCentavos,
      paymentCreatedAt,
    });

    return NextResponse.json(
      {
        success: true,
        previewOnly: true,

        transaction: {
          id: transaction.id,
          checkoutSessionId:
            transaction.checkoutSessionId,
          status: transaction.status,
          planType: transaction.planType,
          customerName:
            transaction.user?.name || "Student",
          customerEmailMasked:
            transaction.user?.email
              ? transaction.user.email.replace(
                  /(.{2})(.*)(@.*)/,
                  "$1***$3"
                )
              : null,
        },

        paymongo: {
          paymentId: payment.id,
          paymentMethod:
            payment.attributes?.source?.type || null,
          originalPaymentCentavos:
            paymentAmountCentavos,
          originalProcessingFeeCentavos:
            authoritativeFeeCentavos,
          netSettlementCentavos:
            typeof payment.attributes?.net_amount ===
            "number"
              ? payment.attributes.net_amount
              : null,
          cumulativeRefundedCentavos,
          remainingRefundableCentavos:
            paymentAmountCentavos -
            cumulativeRefundedCentavos,
          successfulRefundCount:
            allRefunds.filter(
              (refund) =>
                refund.attributes?.status ===
                "succeeded"
            ).length,
        },

        policy: decision,

        warnings: [
          ...(storedFeeCentavos === 0 &&
          authoritativeFeeCentavos > 0
            ? [
                "The stored GovStudyX transaction fee is zero while PayMongo reports a processing fee. Preview uses PayMongo as authoritative; reconcile the stored accounting record before execution.",
              ]
            : []),
          ...(decision.refundProcessingFeeDeductionCentavos ===
          0
            ? [
                "No estimated or unknown refund-processing fee is deducted from the customer.",
              ]
            : []),
        ],
      },
      {
        status: decision.allowed ? 200 : 422,
      }
    );
  } catch (error) {
    console.error(
      "[ADMIN_REFUND_PREVIEW_ERROR]",
      error
    );

    return NextResponse.json(
      { error: "Failed to prepare refund preview." },
      { status: 500 }
    );
  }
}
