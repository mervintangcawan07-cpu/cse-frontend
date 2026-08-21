// Relative Path: src/app/api/partner/portal/overview/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { PartnerService } from "@/lib/accounting/partnerService";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const overview = await PartnerService.getPartnerFinancialOverview(partner.id);

    return NextResponse.json({
      success: true,
      ...overview,
      calculationExplanation: {
        formula: `Partner Commission = Qualifying Customer Purchase × ${overview.partner.commissionRate}%`,
        rule: `Commissions are accrued immediately upon student payment and held for ${overview.partner.holdingPeriodDays} days to ensure financial settlement. Minimum cash payout threshold is ${overview.metrics.formattedMinPayout}. Calculations are executed strictly server-side using exact integer centavos.`,
      },
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_OVERVIEW_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch partner overview" }, { status: 500 });
  }
}
