// Relative Path: src/app/api/admin/accounting/overview/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { WaterfallEngine } from "@/lib/accounting/waterfallEngine";
import { LedgerService } from "@/lib/accounting/ledgerService";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "all";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    const now = new Date();

    if (range === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (range === "yesterday") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
    } else if (range === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
    } else if (range === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
    } else if (range === "last_month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (range === "this_year") {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date();
    } else if (range === "custom" && startDateParam) {
      startDate = new Date(startDateParam);
      if (endDateParam) endDate = new Date(endDateParam);
    }

    const [waterfall, ledgerBalance] = await Promise.all([
      WaterfallEngine.computeWaterfall({ startDate, endDate }),
      LedgerService.verifyLedgerBalance(),
    ]);

    return NextResponse.json({
      success: true,
      range,
      waterfall,
      ledgerBalance,
    });
  } catch (error) {
    console.error("[ADMIN_ACCOUNTING_OVERVIEW_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch accounting overview" }, { status: 500 });
  }
}
