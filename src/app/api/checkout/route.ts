import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("cse_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const session = await verifyJWT(token);
    if (!session?.userId) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      console.error("PAYMONGO_SECRET_KEY environment variable is missing.");
      return NextResponse.json(
        { error: "Payment gateway configuration error." },
        { status: 500 }
      );
    }

    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;

    // Request PayMongo Checkout Session
    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                currency: "PHP",
                amount: 49900, // 499.00 PHP in centavos
                name: "Civil Service Exam Full Reviewer Access",
                quantity: 1,
                description: "Lifetime access to 500+ mock exam questions, explanations, and study guides.",
              },
            ],
            payment_method_types: ["gcash", "paymaya", "card", "grab_pay"],
            success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?payment=success`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?payment=cancelled`,
            metadata: {
              userId: session.userId,
              email: session.email,
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("PayMongo Checkout API Error:", data);
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || "Failed to create checkout session." },
        { status: response.status }
      );
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    return NextResponse.json({ checkoutUrl }, { status: 200 });
  } catch (error) {
    console.error("Checkout route error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}