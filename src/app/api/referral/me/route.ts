// Relative Path: src/app/api/referral/me/route.ts
import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/serverAuth";
import { ReferralService } from "@/lib/referral/referralService";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAuthUser(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dashboardData = await ReferralService.getUserReferralDashboard(user.id);
    return NextResponse.json({ success: true, data: dashboardData });
  } catch (error) {
    console.error("[REFERRAL_ME_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to load referral information." },
      { status: 500 }
    );
  }
}
