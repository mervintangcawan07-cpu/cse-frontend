// Relative Path: src/app/api/admin/accounting/partners/[id]/statement/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { PartnerStatementService } from "@/lib/accounting/partnerStatementService";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format")?.toLowerCase();
    const period = searchParams.get("period") || "THIS_MONTH";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;

    const dataset = await PartnerStatementService.getStatementDataset({
      partnerId: id,
      period,
      customStart,
      customEnd,
    });

    const safePartnerId = dataset.partner.partnerId || "PT-000000";
    const dateTag = new Date().toISOString().slice(0, 7);

    if (format === "csv") {
      const csvData = PartnerStatementService.generateStatementCSV(dataset);
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="Admin_Statement_${safePartnerId}_${dateTag}.csv"`,
        },
      });
    }

    if (format === "xlsx") {
      const xlsxBuffer = await PartnerStatementService.generateStatementXLSX(dataset);
      return new NextResponse(new Uint8Array(xlsxBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="Admin_Statement_${safePartnerId}_${dateTag}.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: dataset,
    });
  } catch (error) {
    console.error("[ADMIN_PARTNER_STATEMENT_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to generate statement" }, { status: 500 });
  }
}
