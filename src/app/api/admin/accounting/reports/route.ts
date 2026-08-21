// Relative Path: src/app/api/admin/accounting/reports/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { AccountingReportService } from "@/lib/accounting/accountingReportService";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const exportType = searchParams.get("type") || "transactions";

    if (format === "csv") {
      let csvContent = "";
      let filename = `govstudyx_financial_${exportType}_${Date.now()}.csv`;

      if (exportType === "ledger") {
        csvContent = await AccountingReportService.exportLedgerCSV();
      } else {
        csvContent = await AccountingReportService.exportTransactionsCSV();
      }

      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const comparison = await AccountingReportService.getPeriodicComparison();
    return NextResponse.json({ success: true, comparison });
  } catch (error) {
    console.error("[ADMIN_REPORTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to generate reports" }, { status: 500 });
  }
}
