import { NextResponse } from "next/server";
import crypto from "crypto";

export interface ParsedPayMongoSignature {
  timestamp: string;
  testSignature: string;
  liveSignature: string;
}

interface PayMongoWebhookPayload {
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      type?: string;
      livemode?: boolean;
      data?: {
        id?: string;
        type?: string;
        attributes?: {
          amount?: number;
          currency?: string;
          fee?: number;
          livemode?: boolean;
          receipt_url?: string;
          payment_intent_id?: string;
          payment_intent?: { id?: string };
          line_items?: Array<{ amount?: number; quantity?: number; currency?: string }>;
          payments?: Array<{ attributes?: { status?: string; fee?: number } }>;
          fees?: Array<{ amount?: number }>;
          metadata?: {
            userId?: string;
            user_id?: string;
            planType?: string;
            partnerCode?: string;
            campaignSource?: string;
            expectedAmountCentavos?: string | number;
            expectedCurrency?: string;
          };
        };
      };
    };
  };
}

export function parsePayMongoSignatureHeader(header: string): ParsedPayMongoSignature {
  const parts = header.split(",");
  let timestamp = "";
  let testSignature = "";
  let liveSignature = "";

  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=");
    const key = rawKey?.trim();
    const value = rawValue?.trim() || "";
    if (key === "t") timestamp = value;
    else if (key === "te") testSignature = value;
    else if (key === "li") liveSignature = value;
  }

  return { timestamp, testSignature, liveSignature };
}

export function timingSafeSignatureEqual(expected: string, provided: string): boolean {
  if (!provided || typeof provided !== "string") return false;
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function verifyPayMongoSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  webhookSecret: string | undefined;
  nowSeconds?: number;
  maxAgeSeconds?: number;
  isProduction?: boolean;
}): { valid: boolean; error?: string; parsed?: ParsedPayMongoSignature } {
  const {
    rawBody,
    signatureHeader,
    webhookSecret,
    nowSeconds = Math.floor(Date.now() / 1000),
    maxAgeSeconds = 300,
    isProduction = process.env.NODE_ENV === "production",
  } = params;

  if (!webhookSecret) {
    return { valid: false, error: "PAYMONGO_WEBHOOK_SECRET is missing." };
  }

  if (!signatureHeader) {
    return { valid: false, error: "Missing paymongo-signature header." };
  }

  const parsed = parsePayMongoSignatureHeader(signatureHeader);
  const { timestamp, testSignature, liveSignature } = parsed;

  const timestampSeconds = Number(timestamp);
  if (
    !timestamp ||
    !Number.isInteger(timestampSeconds) ||
    timestampSeconds <= 0 ||
    Math.abs(nowSeconds - timestampSeconds) > maxAgeSeconds
  ) {
    return { valid: false, error: "Invalid or stale signature timestamp." };
  }

  const comparisonString = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(comparisonString)
    .digest("hex");

  // In production, strictly require live signature ('li') and reject test signature ('te')
  if (isProduction) {
    if (!liveSignature) {
      return { valid: false, error: "Missing live signature in production environment." };
    }
    if (!timingSafeSignatureEqual(expectedSignature, liveSignature)) {
      return { valid: false, error: "Invalid live signature." };
    }
  } else {
    // In test/development environment, accept matching live or test signature
    const isLiveValid = liveSignature ? timingSafeSignatureEqual(expectedSignature, liveSignature) : false;
    const isTestValid = testSignature ? timingSafeSignatureEqual(expectedSignature, testSignature) : false;
    if (!isLiveValid && !isTestValid) {
      return { valid: false, error: "Invalid signature verification." };
    }
  }

  return { valid: true, parsed };
}

/**
 * Authoritative canonical webhook handler for PayMongo events.
 * Used by both /api/paymongo/webhook and /api/webhooks/paymongo to ensure identical
 * signature, freshness, replay protection, and event handling semantics.
 */
export async function handlePaymongoWebhook(request: Request): Promise<NextResponse> {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("paymongo-signature");
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    const verification = verifyPayMongoSignature({
      rawBody,
      signatureHeader,
      webhookSecret,
    });

    if (!verification.valid) {
      const status =
        verification.error?.includes("missing") && verification.error?.includes("PAYMONGO_WEBHOOK_SECRET")
          ? 500
          : 400;
      return NextResponse.json({ error: verification.error }, { status });
    }

    let payload: PayMongoWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as PayMongoWebhookPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventType = payload?.data?.attributes?.type;
    const isProduction = process.env.NODE_ENV === "production";

    // Mode check: if provider event payload explicitly indicates livemode === false in production, reject
    if (isProduction) {
      const eventLivemode = payload?.data?.attributes?.livemode;
      const dataLivemode = payload?.data?.attributes?.data?.attributes?.livemode;
      if (eventLivemode === false || dataLivemode === false) {
        return NextResponse.json({ error: "Test mode events are not accepted in production" }, { status: 400 });
      }
    }

    if (eventType === "checkout_session.payment.paid") {
      const eventData = payload?.data?.attributes?.data;
      const attributes = eventData?.attributes;
      const metadata = attributes?.metadata || {};
      const userId = metadata.userId || metadata.user_id;
      const planType = metadata.planType;
      const supportedPlanTypes = new Set(["1_MONTH", "6_MONTHS", "1_YEAR"]);

      const checkoutSessionId = eventData?.id || payload?.data?.id;
      if (!userId || !checkoutSessionId || !planType || !supportedPlanTypes.has(planType)) {
        return NextResponse.json(
          { error: "Paid event rejected: missing or invalid userId, checkoutSessionId, or planType" },
          { status: 400 }
        );
      }

      const lineItemAmount = attributes?.line_items?.[0]?.amount;
      const quantity = attributes?.line_items?.[0]?.quantity || 1;
      const purchaseAmountCentavos = lineItemAmount
        ? lineItemAmount * quantity
        : (attributes?.amount || 0);

      const payments = attributes?.payments || [];
      const paidPayment = payments.find((p) => p?.attributes?.status === "paid") || payments[0];
      const feeCentavos = paidPayment?.attributes?.fee || attributes?.fee || attributes?.fees?.[0]?.amount || 0;

      const providerCurrency = (attributes?.line_items?.[0]?.currency || attributes?.currency || "PHP").toUpperCase();
      const expectedAmountCentavos = metadata?.expectedAmountCentavos
        ? Number(metadata.expectedAmountCentavos)
        : undefined;
      const expectedCurrency = metadata?.expectedCurrency ? String(metadata.expectedCurrency).toUpperCase() : undefined;

      const partnerCode = metadata?.partnerCode || null;
      const campaignSource = metadata?.campaignSource || "direct";
      const paymentIntentId = attributes?.payment_intent?.id || attributes?.payment_intent_id;
      const receiptUrl = attributes?.receipt_url || undefined;

      const { PaymentFinalizationService } = await import("@/lib/payment/paymentFinalizationService");
      const finalization = await PaymentFinalizationService.finalizeVerifiedPayment({
        userId: String(userId),
        checkoutSessionId: String(checkoutSessionId),
        planType,
        purchaseAmountCentavos,
        feeAmountCentavos: feeCentavos,
        partnerCode,
        campaignSource,
        paymentIntentId,
        receiptUrl,
        source: "WEBHOOK",
        expectedAmountCentavos,
        expectedCurrency,
        providerCurrency,
      });

      return NextResponse.json(
        {
          received: true,
          alreadyFinalized: finalization.alreadyFinalized,
          transactionId: finalization.transactionId,
        },
        { status: 200 }
      );
    } else if (eventType === "payment.refunded" || eventType === "payment.refund.updated") {
      const secretKey = process.env.PAYMONGO_SECRET_KEY;
      if (!secretKey) {
        return NextResponse.json({ error: "PAYMONGO_SECRET_KEY is missing for refund resolution" }, { status: 500 });
      }

      const { RefundService } = await import("@/lib/payment/refundService");
      const outcome = await RefundService.processPayMongoRefundWebhook({
        eventType,
        payload,
        secretKey,
      });

      if (!outcome.success) {
        return NextResponse.json({ error: outcome.message, status: outcome.status }, { status: 500 });
      }

      return NextResponse.json(
        {
          received: true,
          status: outcome.status,
          refundId: outcome.refundId,
          transactionId: outcome.transactionId,
        },
        { status: 200 }
      );
    }

    // Unhandled event types from allowlist
    return NextResponse.json({ received: true, ignored: true }, { status: 200 });
  } catch (error: unknown) {
    console.error("[PayMongo Webhook Error]:", error);
    const message = error instanceof Error ? error.message : String(error);
    const isConflict = message.includes("TERMINAL_STATE_CONFLICT");
    return NextResponse.json(
      { error: message },
      { status: isConflict ? 409 : 500 }
    );
  }
}
