import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";

export async function POST() {
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

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cseonlinereview.vercel.app";

    if (!secretKey) {
      return NextResponse.json(
        { error: "PAYMONGO_SECRET_KEY is missing in Vercel environment variables." },
        { status: 500 }
      );
    }

    const authHeader = Buffer.from(`${secretKey.trim()}:`).toString("base64");

    // PayMongo V2 Checkout Endpoint
    const response = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
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
            payment_method_types: ["gcash", "card", "paymaya"],
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
      console.error("PayMongo Error Details:", JSON.stringify(data, null, 2));
      const paymongoMsg =
        data?.errors?.[0]?.detail || data?.errors?.[0]?.code || "PayMongo API Error";
      return NextResponse.json(
        { error: `PayMongo rejected request: ${paymongoMsg}`, details: data },
        { status: response.status }
      );
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    return NextResponse.json({ checkoutUrl }, { status: 200 });
  } catch (error) {
    console.error("Checkout Catch Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}