// Relative Path: src/app/api/paymongo/checkout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock, getClientIp } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/config/site";

function getOriginUrl(request: Request): string {
  // If in production, always resolve to canonical public site URL
  if (process.env.NODE_ENV === "production") {
    return getSiteUrl();
  }

  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost:3000";

  const cleanHost = host.replace(/^https?:\/\//, "").trim();
  const isLocalhost = cleanHost.includes("localhost") || cleanHost.includes("127.0.0.1");

  const protocol = isLocalhost ? "http" : "https";
  return `${protocol}://${cleanHost}`;
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const lockKey = `checkout:${clientIp}`;

  // 🔒 Enforce 1 active checkout request at a time per client IP
  if (!acquireLock(lockKey)) {
    return NextResponse.json(
      { error: "A payment transaction is already processing. Please wait..." },
      { status: 409 }
    );
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized: Please log in first." }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Invalid session: Please log in again." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({ planType: "1_MONTH" }));
    const planType = body.planType || "1_MONTH";

    // Fetch dynamic plan price set by Admin from Database
    let plan = await prisma.pricingPlan.findUnique({
      where: { planType },
    });

    if (!plan) {
      const defaults: Record<string, { price: number; name: string; durationDays: number }> = {
        "1_MONTH": { price: 99, name: "1-Month CSE PRO Access", durationDays: 30 },
        "6_MONTHS": { price: 199, name: "6-Month CSE PRO Access", durationDays: 180 },
        "1_YEAR": { price: 299, name: "1-Year CSE PRO Access", durationDays: 365 },
        "LIFETIME": { price: 299, name: "1-Year CSE PRO Access", durationDays: 365 },
      };

      const fallback = defaults[planType] || { price: 99, name: "CSE PRO Access", durationDays: 30 };

      plan = {
        id: "default",
        planType,
        name: fallback.name,
        price: fallback.price,
        durationDays: fallback.durationDays,
        updatedAt: new Date(),
      };
    }

    let amountInCentavos = plan.price * 100;

    // 🎁 Resolve Promo Code / Partner Code & Campaign Source
    const { PartnerService } = await import("@/lib/accounting/partnerService");
    const rawPromo = body.promoCode || body.refCode || cookieStore.get("cse_partner_ref")?.value || cookieStore.get("cse_ref")?.value;
    const campaignSource = body.campaignSource || body.src || cookieStore.get("cse_campaign_source")?.value || "direct";

    let matchedPartnerCode: string | null = null;
    let appliedDiscountNote = "";

    if (rawPromo) {
      const partner = await PartnerService.resolvePartnerByCodeOrSlug(rawPromo);
      if (partner) {
        matchedPartnerCode = partner.code;

        // Ensure attribution is registered for this user
        await PartnerService.recordPartnerAttributionOnSignup({
          referredUserId: String(session.userId),
          codeOrSlug: partner.code,
          campaignSource,
        }).catch(() => null);

        // Apply partner discount if configured
        if (partner.discountPercent && partner.discountPercent > 0) {
          const discountMultiplier = (100 - partner.discountPercent) / 100;
          amountInCentavos = Math.max(100, Math.round(amountInCentavos * discountMultiplier));
          appliedDiscountNote = ` (${partner.discountPercent}% Off via ${partner.name})`;
        }
      }
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "PAYMONGO_SECRET_KEY missing in environment variables." },
        { status: 500 }
      );
    }

    const origin = getOriginUrl(request);
    const successUrl = `${origin}/dashboard?payment=success`;
    const cancelUrl = `${origin}/dashboard?payment=cancelled`;

    const authHeader = Buffer.from(`${secretKey.trim()}:`).toString("base64");

    // ⏱️ Abort outbound PayMongo API request after 10 seconds if PayMongo hangs
    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            description: `GovStudyX PRO - ${plan.name}${appliedDiscountNote}`,
            line_items: [
              {
                currency: "PHP",
                amount: amountInCentavos,
                description: `Full access to mock exams, speed drills, and study notes.${appliedDiscountNote}`,
                name: `${plan.name}${appliedDiscountNote}`,
                quantity: 1,
              },
            ],
            payment_method_types: ["card", "gcash", "paymaya", "qrph"],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
              userId: String(session.userId),
              planType,
              partnerCode: matchedPartnerCode || "",
              campaignSource,
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[PayMongo API Error]:", JSON.stringify(data, null, 2));
      return NextResponse.json(
        { error: `PayMongo rejected request: ${data?.errors?.[0]?.detail || "API Error"}` },
        { status: response.status }
      );
    }

    const checkoutSessionId = data?.data?.id;
    const checkoutUrl = data?.data?.attributes?.checkout_url;

    if (checkoutSessionId) {
      cookieStore.set("cse_checkout_id", checkoutSessionId, {
        httpOnly: true,
        path: "/",
        maxAge: 86400,
        sameSite: "lax",
      });

      cookieStore.set("cse_checkout_plan", planType, {
        httpOnly: true,
        path: "/",
        maxAge: 86400,
        sameSite: "lax",
      });
    }

    return NextResponse.json({ checkoutUrl }, { status: 200 });
  } catch (error: any) {
    console.error("Checkout Catch Error:", error);

    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      return NextResponse.json(
        { error: "PayMongo API timed out after 10s. Please try again." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    // 🔓 Always release the concurrency lock after request processing completes
    releaseLock(lockKey);
  }
}