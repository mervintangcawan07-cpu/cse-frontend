// Relative Path: src/app/api/partner/portal/statements/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { PartnerStatementService } from "@/lib/accounting/partnerStatementService";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "THIS_MONTH";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;

    const dataset = await PartnerStatementService.getStatementDataset({
      partnerId: partner.id,
      period,
      customStart,
      customEnd,
    });

    return NextResponse.json({
      success: true,
      data: dataset,
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_STATEMENTS_ERROR]", error);
    return NextResponse.json({ error: "Failed to load partner statement" }, { status: 500 });
  }
}
