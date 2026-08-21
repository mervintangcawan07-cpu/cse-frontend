// Relative Path: src/app/api/partner/auth/me/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;

    return NextResponse.json({
      success: true,
      partner,
    });
  } catch (error) {
    console.error("[PARTNER_ME_ERROR]", error);
    return NextResponse.json({ error: "Failed to get partner profile" }, { status: 500 });
  }
}
