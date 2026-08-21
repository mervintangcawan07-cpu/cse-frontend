// Relative Path: src/app/api/admin/accounting/deductions/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { formatCentavosToPesos } from "@/lib/accounting/money";
import { LedgerService } from "@/lib/accounting/ledgerService";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const deductions = await prisma.financialDeduction.findMany({
      orderBy: { date: "desc" },
      take: 100,
    });

    const formatted = deductions.map((d) => ({
      id: d.id,
      date: d.date.toISOString(),
      category: d.category,
      description: d.description,
      amountCentavos: d.amountCentavos,
      formattedAmount: formatCentavosToPesos(d.amountCentavos),
      reference: d.reference,
      status: d.status,
      notes: d.notes,
    }));

    return NextResponse.json({ success: true, deductions: formatted });
  } catch (error) {
    console.error("[ADMIN_DEDUCTIONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch deductions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { category, description, amountPesos, reference, notes } = body;

    if (!description || !amountPesos || amountPesos <= 0) {
      return NextResponse.json({ error: "Description and positive amount are required" }, { status: 400 });
    }

    const amountCentavos = Math.round(Number(amountPesos) * 100);

    const deduction = await prisma.financialDeduction.create({
      data: {
        category: category || "OTHER_EXPENSE",
        description: description.trim(),
        amountCentavos,
        reference: reference?.trim(),
        notes: notes?.trim(),
        createdBy: user.id,
        approvedBy: user.id,
      },
    });

    // Post to double-entry ledger: Debit EXPENSE_OPERATIONAL, Credit CASH_PAYMONGO
    await LedgerService.postBalancedDoubleEntry({
      transactionType: "DEDUCTION_EXPENSE",
      debitCategory: "EXPENSE_OPERATIONAL",
      creditCategory: "CASH_PAYMONGO",
      amountCentavos,
      sourceEntity: "FinancialDeduction",
      sourceId: deduction.id,
      description: `Operational Expense (${deduction.category}): ${deduction.description}`,
      createdBy: user.id,
    });

    return NextResponse.json({
      success: true,
      deduction,
      message: "Operational deduction recorded in accounting ledger!",
    });
  } catch (error: any) {
    console.error("[ADMIN_DEDUCTIONS_POST_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to record deduction" }, { status: 500 });
  }
}
