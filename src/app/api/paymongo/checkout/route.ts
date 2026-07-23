import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (!secretKey) {
      return NextResponse.json({ error: "PayMongo secret key misconfigured" }, { status: 500 });
    }

    const authHeader = Buffer.from(`${secretKey}:`).toString("base64");

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
            description: "Civil Service Exam Reviewer PRO - Lifetime Pass",
            line_items: [
              {
                currency: "PHP",
                amount: 49900, // ₱499.00 in centavos
                description: "Full access to mock exams, category drills, and study notes.",
                name: "CSE Reviewer PRO Pass",
                quantity: 1,
              },
            ],
            payment_method_types: ["gcash", "paymaya", "card", "grab_pay"],
            success_url: `${appUrl}/dashboard?payment=success`,
            cancel_url: `${appUrl}/upgrade?payment=cancelled`,
            metadata: {
              userId: session.userId,
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PayMongo Checkout Error:", data);
      return NextResponse.json({ error: "Failed to create payment session" }, { status: response.status });
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    return NextResponse.json({ checkoutUrl }, { status: 200 });
  } catch (error) {
    console.error("Checkout API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}