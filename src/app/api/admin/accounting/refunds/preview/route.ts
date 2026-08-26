import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { RefundService } from "@/lib/payment/refundService";
import {
  REFUND_REASONS,
  type RefundReason,
} from "@/lib/payment/refundPolicy";
import {
  prepareRefundExecution,
  type RefundExecutionPreparationDependencies,
} from "@/lib/payment/refundExecutionPreparation";

function isRefundReason(value: unknown): value is RefundReason {
  return (
    typeof value === "string" &&
    REFUND_REASONS.includes(value as RefundReason)
  );
}

const preparationDependencies: RefundExecutionPreparationDependencies = {
  async findTransaction(transactionId) {
    return prisma.transaction.findUnique({
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
  },

  fetchPayMongoCheckoutSession(checkoutSessionId, secretKey) {
    return RefundService.fetchPayMongoCheckoutSession(
      checkoutSessionId,
      secretKey
    );
  },

  resolvePaidPaymentFromCheckout(checkout) {
    return RefundService.resolvePaidPaymentFromCheckout(checkout);
  },

  fetchAllRefundsStrict(paymentId, secretKey) {
    return RefundService.fetchAllRefundsStrict(
      paymentId,
      secretKey
    );
  },
};
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

    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    const preparation = await prepareRefundExecution(
      preparationDependencies,
      {
        transactionId,
        reason,
        secretKey,
      }
    );

    if (!preparation.ok) {
      if (
        preparation.code ===
        "PAYMONGO_CONFIGURATION_UNAVAILABLE"
      ) {
        console.error(
          "[ADMIN_REFUND_PREVIEW] PAYMONGO_SECRET_KEY is missing."
        );
      }

      if (
        preparation.code ===
        "CHECKOUT_OWNERSHIP_MISMATCH"
      ) {
        console.error(
          `[ADMIN_REFUND_PREVIEW] Checkout ownership missing or mismatched for transaction ${transactionId}`
        );
      }

      if (
        preparation.code ===
        "PAYMENT_AMOUNT_MISMATCH"
      ) {
        console.error(
          `[ADMIN_REFUND_PREVIEW] Payment amount mismatch for transaction ${transactionId}`
        );
      }

      if (
        preparation.code ===
        "PAYMENT_FEE_MISMATCH"
      ) {
        console.error(
          `[ADMIN_REFUND_PREVIEW] Fee mismatch for transaction ${transactionId}`
        );
      }

      if (
        preparation.code ===
        "REFUND_HISTORY_UNAVAILABLE"
      ) {
        console.error(
          "[ADMIN_REFUND_PREVIEW] Authoritative refund history unavailable."
        );
      }

      if (
        preparation.code ===
        "SUCCEEDED_REFUND_AMOUNT_INVALID"
      ) {
        console.error(
          "[ADMIN_REFUND_PREVIEW] Invalid refund history amount."
        );
      }

      return NextResponse.json(
        preparation.body,
        { status: preparation.status }
      );
    }

    const {
      transaction,
      payment,
      paymentAmountCentavos,
      authoritativeFeeCentavos,
      storedFeeCentavos,
      cumulativeRefundedCentavos,
      successfulRefundCount,
      policy: decision,
    } = preparation;
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
          successfulRefundCount,
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
