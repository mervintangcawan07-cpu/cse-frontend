import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, userId } = body;

    if (!email || !userId) {
      return NextResponse.json({ error: "Missing user details" }, { status: 400 });
    }

    // PayMongo v2 Checkout Session API Payload
    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        // Base64-encode your PayMongo Secret Key or pass it directly using Basic Auth
        authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ":").toString("base64")}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: "Civil Service Exam Premium Reviewer Access",
                amount: 49900, // Amount in centavos (e.g., PHP 499.00)
                currency: "PHP",
                quantity: 1,
              },
            ],
            payment_method_types: ["card", "gcash", "qrph"],
            success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?canceled=true`,
            metadata: {
              userId: userId,
              email: email,
            },
          },
        },
      }),
    };

    const response = await fetch("https://api.paymongo.com/v2/checkout_sessions", options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.detail || "Failed to create checkout session");
    }

    // Return the checkout URL where the user will be redirected to pay
    return NextResponse.json({ checkoutUrl: data.data.attributes.checkout_url }, { status: 200 });
  } catch (error: any) {
    console.error("Checkout creation error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}