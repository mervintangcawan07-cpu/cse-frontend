import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getOriginUrl(request: Request): string {
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

    const amountInCentavos = plan.price * 100;

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

    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            description: `Civil Service Exam Reviewer PRO - ${plan.name}`,
            line_items: [
              {
                currency: "PHP",
                amount: amountInCentavos,
                description: `Full access to mock exams, speed drills, and study notes.`,
                name: plan.name,
                quantity: 1,
              },
            ],
            payment_method_types: ["card", "gcash", "paymaya", "qrph"],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
              userId: String(session.userId),
              planType,
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
  } catch (error) {
    console.error("Checkout Catch Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}