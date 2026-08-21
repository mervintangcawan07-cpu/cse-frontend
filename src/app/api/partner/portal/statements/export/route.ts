// Relative Path: src/app/api/partner/portal/statements/export/route.ts
import { NextResponse } from "next/server";
import { requirePartnerAuth } from "@/lib/partnerAuth";
import { PartnerStatementService } from "@/lib/accounting/partnerStatementService";
import { PartnerAuditService } from "@/lib/accounting/partnerAuditService";

export async function GET(request: Request) {
  try {
    const { partner, errorResponse } = await requirePartnerAuth(request);
    if (errorResponse) return errorResponse;
    if (!partner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "xlsx").toLowerCase();
    const period = searchParams.get("period") || "THIS_MONTH";
    const customStart = searchParams.get("startDate") || undefined;
    const customEnd = searchParams.get("endDate") || undefined;

    const dataset = await PartnerStatementService.getStatementDataset({
      partnerId: partner.id,
      period,
      customStart,
      customEnd,
    });

    const safePartnerId = dataset.partner.partnerId || "PT-000000";
    const dateTag = new Date().toISOString().slice(0, 7); // YYYY-MM

    await PartnerAuditService.logEvent({
      action: "PARTNER_STATEMENT_EXPORTED",
      partnerId: partner.id,
      metadata: { format, period, statementRef: dataset.statementReference },
    });

    if (format === "csv") {
      const csvData = PartnerStatementService.generateStatementCSV(dataset);
      const filename = `GovStudyX_${safePartnerId}_Transactions_${dateTag}.csv`;

      return new NextResponse(csvData, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format === "pdf") {
      // Return structured printable HTML format optimized for instant browser/print PDF rendering
      const filename = `GovStudyX_${safePartnerId}_Statement_${dateTag}.pdf`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${dataset.statementReference}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #0f172a; background: #ffffff; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
            .brand { font-size: 24px; font-weight: 900; color: #0f172a; }
            .sub-brand { font-size: 11px; font-weight: 700; color: #059669; letter-spacing: 0.1em; text-transform: uppercase; }
            .meta { text-align: right; font-size: 12px; color: #475569; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
            .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
            .stat-value { font-size: 20px; font-weight: 900; color: #0f172a; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .text-right { text-align: right; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: #d1fae5; color: #065f46; }
            .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">GOVSTUDYX</div>
              <div class="sub-brand">PARTNER FINANCIAL STATEMENT</div>
            </div>
            <div class="meta">
              <div><strong>Ref:</strong> ${dataset.statementReference}</div>
              <div><strong>Period:</strong> ${dataset.period.label}</div>
              <div><strong>Partner ID:</strong> ${dataset.partner.partnerId}</div>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-title">Partner Account Details</div>
              <div style="font-size: 15px; font-weight: 800;">${dataset.partner.name}</div>
              <div style="font-size: 12px; color: #64748b;">${dataset.partner.contactEmail || "No email on record"}</div>
              <div style="margin-top: 8px; font-size: 12px;"><strong>Commission Model:</strong> ${dataset.partner.commissionModel.replace(/_/g, " ")} (${dataset.partner.commissionRate}%)</div>
            </div>
            <div class="card">
              <div class="card-title">Reconciliation &amp; Financial Settlement</div>
              <div class="stat-value" style="color: #059669;">${dataset.summary.formattedOutstanding}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Net Outstanding Available Commission</div>
              <div style="margin-top: 8px;"><span class="badge">${dataset.reconciliation.status}</span></div>
            </div>
          </div>

          <div class="card" style="margin-bottom: 24px;">
            <div class="card-title">Financial Summary (Integer Centavos Precision)</div>
            <table>
              <tr><td>Qualifying Customer Payments:</td><td class="text-right" style="font-weight: bold; font-family: monospace;">${dataset.summary.formattedQualifyingPayments}</td></tr>
              <tr><td>Gross Commission Earned:</td><td class="text-right" style="font-weight: bold; font-family: monospace; color: #059669;">${dataset.summary.formattedGrossCommission}</td></tr>
              <tr><td>Refund / Chargeback Reversals:</td><td class="text-right" style="font-weight: bold; font-family: monospace; color: #e11d48;">${dataset.summary.formattedRefundReversals}</td></tr>
              <tr><td>Net Commission:</td><td class="text-right" style="font-weight: bold; font-family: monospace;">${dataset.summary.formattedNetCommission}</td></tr>
              <tr><td>Total Paid Out:</td><td class="text-right" style="font-weight: bold; font-family: monospace;">${dataset.summary.formattedPaid}</td></tr>
              <tr><td>Reserved for Pending Payouts:</td><td class="text-right" style="font-weight: bold; font-family: monospace;">${dataset.summary.formattedReserved}</td></tr>
              <tr style="border-top: 2px solid #0f172a; font-size: 14px;"><td style="font-weight: 900;">Outstanding Balance:</td><td class="text-right" style="font-weight: 900; font-family: monospace; color: #059669;">${dataset.summary.formattedOutstanding}</td></tr>
            </table>
          </div>

          <div style="font-size: 14px; font-weight: 800; margin-bottom: 8px;">Referred Student Transactions (${dataset.transactions.length})</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction ID</th>
                <th>Plan Type</th>
                <th>Customer</th>
                <th class="text-right">Paid (PHP)</th>
                <th class="text-right">Commission (PHP)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${dataset.transactions.map((t) => `
                <tr>
                  <td>${t.date.slice(0, 10)}</td>
                  <td style="font-family: monospace;">${t.id.slice(0, 12)}...</td>
                  <td>${t.planType}</td>
                  <td>${t.customerMasked}</td>
                  <td class="text-right" style="font-family: monospace;">${t.formattedPurchase}</td>
                  <td class="text-right" style="font-family: monospace; font-weight: bold; color: #059669;">${t.formattedCommission}</td>
                  <td>${t.status}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="footer">
            GovStudyX Partner Portal &bull; Generated on ${new Date().toUTCString()} &bull; Authoritative Double-Entry Ledger Record
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
        </html>
      `;

      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    // Default: XLSX (6-sheet workbook)
    const xlsxBuffer = await PartnerStatementService.generateStatementXLSX(dataset);
    const filename = `GovStudyX_${safePartnerId}_Statement_${dateTag}.xlsx`;

    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[PARTNER_PORTAL_EXPORT_ERROR]", error);
    return NextResponse.json({ error: "Failed to generate statement export" }, { status: 500 });
  }
}
