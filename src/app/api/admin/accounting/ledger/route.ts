// Relative Path: src/app/api/admin/accounting/ledger/route.ts
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/serverAuth";
import { prisma } from "@/lib/prisma";
import { LedgerService } from "@/lib/accounting/ledgerService";
import { formatCentavosToPesos } from "@/lib/accounting/money";

export async function GET(request: Request) {
  try {
    const { user, errorResponse } = await requireAdminAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const type = searchParams.get("type") || undefined;
    const entryType = searchParams.get("entryType") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (category && category !== "ALL") where.accountCategory = category;
    if (type && type !== "ALL") where.transactionType = type;
    if (entryType && entryType !== "ALL") where.entryType = entryType;

    const [total, entries, balance] = await Promise.all([
      prisma.financialLedgerEntry.count({ where }),
      prisma.financialLedgerEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { effectiveDate: "desc" },
      }),
      LedgerService.verifyLedgerBalance(),
    ]);

    const formatted = entries.map((e) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      effectiveDate: e.effectiveDate.toISOString(),
      transactionType: e.transactionType,
      accountCategory: e.accountCategory,
      entryType: e.entryType,
      amountCentavos: e.amountCentavos,
      formattedAmount: formatCentavosToPesos(e.amountCentavos),
      sourceEntity: e.sourceEntity,
      sourceId: e.sourceId,
      description: e.description,
      periodId: e.periodId,
    }));

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      balance,
      items: formatted,
    });
  } catch (error) {
    console.error("[ADMIN_LEDGER_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch ledger entries" }, { status: 500 });
  }
}
