// Relative Path: src/app/api/admin/referrals/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { ReferralService } from "@/lib/referral/referralService";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || undefined;
    const status = searchParams.get("status") || undefined;
    const riskLevel = searchParams.get("risk") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const result = await ReferralService.getAdminReferralList({
      query,
      status,
      riskLevel,
      startDate,
      endDate,
      page,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[ADMIN_REFERRALS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch referrals" }, { status: 500 });
  }
}
