// Relative Path: src/app/api/admin/accounting/adjustments/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { LedgerService } from "@/lib/accounting/ledgerService";
import { formatCentavosToPesos } from "@/lib/accounting/money";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const adjustments = await prisma.financialAdjustment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formatted = adjustments.map((a) => ({
      id: a.id,
      adjustmentNumber: a.adjustmentNumber,
      amountCentavos: a.amountCentavos,
      formattedAmount: formatCentavosToPesos(a.amountCentavos),
      direction: a.direction,
      category: a.category,
      reason: a.reason,
      reference: a.reference,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, adjustments: formatted });
  } catch (error) {
    console.error("[ADMIN_ADJUSTMENTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch adjustments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { amountPesos, direction, category, reason, reference } = body;

    if (!amountPesos || amountPesos <= 0 || !reason) {
      return NextResponse.json({ error: "Positive amount and reason are required" }, { status: 400 });
    }

    const count = await prisma.financialAdjustment.count();
    const adjustmentNumber = `ADJ-${(count + 1).toString().padStart(4, "0")}`;
    const amountCentavos = Math.round(Number(amountPesos) * 100);

    const adjustment = await prisma.financialAdjustment.create({
      data: {
        adjustmentNumber,
        amountCentavos,
        direction: direction || "DEBIT",
        category: category || "MANUAL_REVERSAL",
        reason: reason.trim(),
        reference: reference?.trim(),
        status: "APPROVED",
        createdBy: user.id,
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    });

    // Balanced double entry: ADJUSTMENT_SUSPENSE vs CASH_PAYMONGO
    const debitCat = direction === "DEBIT" ? "ADJUSTMENT_SUSPENSE" : "CASH_PAYMONGO";
    const creditCat = direction === "DEBIT" ? "CASH_PAYMONGO" : "ADJUSTMENT_SUSPENSE";

    await LedgerService.postBalancedDoubleEntry({
      transactionType: "MANUAL_ADJUSTMENT",
      debitCategory: debitCat,
      creditCategory: creditCat,
      amountCentavos,
      sourceEntity: "FinancialAdjustment",
      sourceId: adjustment.id,
      description: `Manual adjustment ${adjustmentNumber}: ${adjustment.reason}`,
      createdBy: user.id,
    });

    return NextResponse.json({
      success: true,
      adjustment,
      message: `Adjustment ${adjustmentNumber} created and posted to ledger!`,
    });
  } catch (error: any) {
    console.error("[ADMIN_ADJUSTMENTS_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to create adjustment" }, { status: 500 });
  }
}
