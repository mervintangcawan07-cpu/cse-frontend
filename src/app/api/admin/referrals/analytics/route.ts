// Relative Path: src/app/api/admin/referrals/analytics/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { ReferralService } from "@/lib/referral/referralService";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const analytics = await ReferralService.getAdminAnalytics();
    return NextResponse.json({ success: true, analytics });
  } catch (error) {
    console.error("[ADMIN_REFERRAL_ANALYTICS_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
